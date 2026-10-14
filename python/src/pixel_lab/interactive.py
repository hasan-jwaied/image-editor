"""An interactive editing session with undo/redo, for ``pixel-lab edit``."""

from __future__ import annotations

import contextlib
import json
import shlex
import time
from pathlib import Path

from . import registry
from .cli import describe_operations
from .image import Image
from .io import save_image, show_image
from .recipe import Step, parse_step, recipe_to_json

HISTORY_LIMIT = 12  # each 1-megapixel RGB snapshot costs ~25 MB as Python lists

HELP = """\
Commands:
  <op> [key=value ...]   apply an operation, e.g.  gaussian_blur sigma=2
  ops                    list every operation and its parameters
  undo / redo            step backwards or forwards
  history                show the steps applied so far
  show                   open the current image in your viewer
  save <path>            write the image (format from extension)
  recipe <path>          write the steps as a recipe JSON (replay with 'pixel-lab run -r')
  help / quit
"""


class Session:
    def __init__(self, image: Image, name: str) -> None:
        self.name = name
        self.undo_stack: list[tuple[Image, list[Step]]] = []
        self.redo_stack: list[tuple[Image, list[Step]]] = []
        self.image = image
        self.steps: list[Step] = []

    def status(self) -> str:
        img = self.image
        return f"[{len(self.steps)} steps] {img.width}x{img.height} {img.mode}"

    def apply(self, step: Step) -> None:
        started = time.perf_counter()
        result = registry.get(step.op).apply(self.image, step.params)
        elapsed = time.perf_counter() - started
        self.undo_stack.append((self.image, self.steps))
        del self.undo_stack[:-HISTORY_LIMIT]
        self.redo_stack.clear()
        self.image, self.steps = result, [*self.steps, step]
        print(f"applied {step} in {elapsed:.2f}s")

    def undo(self) -> None:
        if not self.undo_stack:
            print("nothing to undo")
            return
        self.redo_stack.append((self.image, self.steps))
        self.image, self.steps = self.undo_stack.pop()

    def redo(self) -> None:
        if not self.redo_stack:
            print("nothing to redo")
            return
        self.undo_stack.append((self.image, self.steps))
        self.image, self.steps = self.redo_stack.pop()

    def handle(self, line: str) -> bool:
        """Run one command; returns False when the session should end."""
        words = shlex.split(line)
        if not words:
            return True
        cmd, args = words[0].lower(), words[1:]
        if cmd in ("quit", "exit", "q"):
            return False
        if cmd in ("help", "?"):
            print(HELP)
        elif cmd == "ops":
            print(describe_operations())
        elif cmd == "undo":
            self.undo()
        elif cmd == "redo":
            self.redo()
        elif cmd == "history":
            print("\n".join(f"  {i + 1}. {s}" for i, s in enumerate(self.steps)) or "  (empty)")
        elif cmd == "show":
            show_image(self.image)
        elif cmd in ("save", "recipe"):
            if len(args) != 1:
                raise ValueError(f"usage: {cmd} <path>")
            if cmd == "save":
                print(f"saved {save_image(self.image, args[0])}")
            else:
                text = json.dumps(recipe_to_json(self.steps), indent=2)
                Path(args[0]).write_text(text + "\n", encoding="utf-8")
                print(f"wrote {args[0]}")
        else:
            self.apply(parse_step(f"{cmd}:{','.join(args)}" if args else cmd))
        return True

    def loop(self) -> None:
        with contextlib.suppress(ImportError):
            import readline  # noqa: F401  (line editing and history where available)
        print(f"Editing {self.name}. Type 'help' for commands.")
        while True:
            try:
                line = input(f"{self.status()} > ")
            except EOFError:
                print()
                return
            try:
                if not self.handle(line):
                    return
            except ValueError as exc:
                print(f"error: {exc}")

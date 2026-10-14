"""Command-line interface.

pixel-lab run photo.jpg -o out.png -s gaussian_blur:sigma=2 -s canny
pixel-lab run photo.jpg -o out.png --recipe recipe.json
pixel-lab edit photo.jpg          # interactive session with undo/redo
pixel-lab list                    # every operation and its parameters
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence

from . import __version__, registry
from .image import Image
from .io import load_image, save_image
from .ops import resize_to
from .recipe import Step, load_recipe, parse_step, run


def fit_within(image: Image, max_size: int) -> Image:
    longest = max(image.width, image.height)
    if longest <= max_size:
        return image
    scale = max_size / longest
    return resize_to(image, max(1, round(image.width * scale)), max(1, round(image.height * scale)))


def describe_operations() -> str:
    lines = []
    for cat_id, cat_label in registry.CATEGORIES.items():
        lines.append(f"\n{cat_label}")
        for op in registry.OPERATIONS.values():
            if op.category != cat_id:
                continue
            lines.append(f"  {op.id:<20} {op.summary}")
            for p in op.params:
                if p.type == "enum":
                    accepted = "|".join(p.options)
                elif p.type == "kernel":
                    accepted = "9 numbers, row by row"
                else:
                    accepted = f"{p.min:g}..{p.max:g}"
                default = (
                    ",".join(map(str, p.default)) if isinstance(p.default, list) else p.default
                )
                lines.append(f"  {'':<20}   {p.name}={accepted}  (default {default})")
    return "\n".join(lines).lstrip("\n")


def _cmd_run(args: argparse.Namespace) -> int:
    steps: list[Step] = []
    if args.recipe:
        steps += load_recipe(args.recipe)
    steps += [parse_step(s) for s in args.step]
    if not steps:
        raise ValueError("nothing to do: add --step or --recipe (see 'pixel-lab list')")

    image = load_image(args.input)
    if args.max_size:
        image = fit_within(image, args.max_size)

    def log(message: str) -> None:
        if not args.quiet:
            print(message, file=sys.stderr)

    log(f"{args.input}: {image.width}x{image.height} {image.mode}")

    total = 0.0

    def report(step: Step, result: Image, seconds: float) -> None:
        nonlocal total
        total += seconds
        log(f"  {step!s:<48} {seconds:7.2f}s  -> {result.width}x{result.height}")

    image = run(image, steps, report)
    path = save_image(image, args.output)
    log(f"saved {path} ({total:.2f}s of processing)")
    return 0


def _cmd_edit(args: argparse.Namespace) -> int:
    from .interactive import Session

    image = load_image(args.input)
    if args.max_size:
        image = fit_within(image, args.max_size)
    Session(image, args.input).loop()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pixel-lab",
        description="Image processing from first principles, in pure Python.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="apply operations and save the result")
    p_run.add_argument("input", help="input image (any format Pillow reads)")
    p_run.add_argument("-o", "--output", required=True, help="output path; format from extension")
    p_run.add_argument(
        "-s",
        "--step",
        action="append",
        default=[],
        metavar="OP[:K=V,...]",
        help="operation to apply; repeatable, runs in order",
    )
    p_run.add_argument("-r", "--recipe", help="recipe JSON exported from the web app")
    p_run.add_argument(
        "--max-size",
        type=int,
        metavar="PX",
        help="first downscale so the longest side is at most PX",
    )
    p_run.add_argument("-q", "--quiet", action="store_true", help="no progress output")
    p_run.set_defaults(func=_cmd_run)

    p_edit = sub.add_parser("edit", help="interactive session with undo/redo")
    p_edit.add_argument("input")
    p_edit.add_argument("--max-size", type=int, metavar="PX")
    p_edit.set_defaults(func=_cmd_edit)

    p_list = sub.add_parser("list", help="list operations and their parameters")
    p_list.set_defaults(func=lambda _a: print(describe_operations()) or 0)

    p_spec = sub.add_parser("spec", help="print the operation spec as JSON")
    p_spec.set_defaults(func=lambda _a: print(json.dumps(registry.spec(), indent=2)) or 0)
    return parser  # fmt: skip


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except (ValueError, FileNotFoundError, OSError) as exc:
        print(f"pixel-lab: error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())

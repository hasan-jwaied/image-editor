"""Recipes: an ordered list of operations, shared by the CLI and the web app.

The JSON form is the same one the web app exports, so a pipeline built in the
browser can be replayed by the Python reference implementation::

    {"version": 1, "steps": [{"op": "gaussian_blur", "params": {"sigma": 2}}]}
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import registry
from .image import Image

RECIPE_VERSION = 1


@dataclass(frozen=True)
class Step:
    op: str
    params: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True

    def validate(self) -> Step:
        """Return a copy with every parameter resolved and checked."""
        return Step(self.op, registry.get(self.op).resolve(self.params), self.enabled)

    def to_json(self) -> dict[str, Any]:
        data: dict[str, Any] = {"op": self.op, "params": self.params}
        if not self.enabled:
            data["enabled"] = False
        return data

    def __str__(self) -> str:
        args = ",".join(f"{k}={_format(v)}" for k, v in self.params.items())
        return f"{self.op}:{args}" if args else self.op


def _format(value: Any) -> str:
    if isinstance(value, list):
        return ",".join(_format(v) for v in value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def parse_step(text: str) -> Step:
    """Parse the CLI shorthand ``op`` or ``op:key=value,key=value``.

    A kernel value may itself contain commas: ``convolve:preset=custom,weights=0,-1,0,...``
    (bare numbers after ``weights=`` are appended to it).
    """
    op, _, rest = text.strip().partition(":")
    params: dict[str, Any] = {}
    last_key: str | None = None
    for part in filter(None, (p.strip() for p in rest.split(","))):
        key, sep, value = part.partition("=")
        if sep:
            params[key.strip()] = value.strip()
            last_key = key.strip()
        elif last_key is not None:
            params[last_key] = f"{params[last_key]},{part}"
        else:
            raise ValueError(f"cannot parse {part!r} in step {text!r}; expected key=value")
    return Step(op.strip(), params).validate()


def recipe_from_json(data: dict[str, Any]) -> list[Step]:
    if data.get("version", RECIPE_VERSION) != RECIPE_VERSION:
        raise ValueError(f"unsupported recipe version {data.get('version')!r}")
    steps = data.get("steps")
    if not isinstance(steps, list):
        raise ValueError("recipe must contain a 'steps' list")
    return [
        Step(s["op"], dict(s.get("params", {})), bool(s.get("enabled", True))).validate()
        for s in steps
    ]


def load_recipe(path: str | Path) -> list[Step]:
    return recipe_from_json(json.loads(Path(path).read_text(encoding="utf-8")))


def recipe_to_json(steps: list[Step]) -> dict[str, Any]:
    return {"version": RECIPE_VERSION, "steps": [s.to_json() for s in steps]}


def run(
    image: Image,
    steps: list[Step],
    on_step: Callable[[Step, Image, float], None] | None = None,
) -> Image:
    """Apply each enabled step in order; ``on_step`` receives the elapsed seconds."""
    for step in steps:
        if not step.enabled:
            continue
        started = time.perf_counter()
        image = registry.get(step.op).apply(image, step.params)
        if on_step:
            on_step(step, image, time.perf_counter() - started)
    return image

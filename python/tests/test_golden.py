"""Regression check against the committed golden outputs.

The same file is replayed by the TypeScript engine's tests, so a change here
that is not regenerated would also show up there.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

import pytest

from pixel_lab import Image
from pixel_lab.recipe import recipe_from_json, run

GOLDEN = json.loads(
    (Path(__file__).resolve().parents[2] / "spec" / "golden" / "golden.json").read_text("utf-8")
)


def _decode(data: dict[str, Any]) -> Image:
    w, h = data["width"], data["height"]
    planes = [
        [list(raw[y * w : (y + 1) * w]) for y in range(h)]
        for raw in (base64.b64decode(p) for p in data["planes"])
    ]
    n_color = 1 if data["mode"].startswith("L") else 3
    return Image(planes[:n_color], planes[n_color] if data["mode"].endswith("A") else None)


@pytest.mark.parametrize("case", GOLDEN["cases"], ids=lambda c: c["name"])
def test_golden_case(case: dict[str, Any]) -> None:
    source = _decode(GOLDEN["fixtures"][case["fixture"]])
    steps = recipe_from_json({"version": 1, "steps": case["steps"]})
    assert run(source, steps) == _decode(case["expected"])

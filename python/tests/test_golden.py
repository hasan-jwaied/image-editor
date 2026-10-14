"""Regression check against the committed golden outputs.

The same file is replayed by the TypeScript engine's tests, so a change here
that is not regenerated would also show up there.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

from pixel_lab.recipe import recipe_from_json, run

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python" / "scripts"))
from generate_golden import decode  # noqa: E402  (the generator is the one source of the format)

GOLDEN = json.loads((ROOT / "spec" / "golden" / "golden.json").read_text("utf-8"))


@pytest.mark.parametrize("case", GOLDEN["cases"], ids=lambda c: c["name"])
def test_golden_case(case: dict[str, Any]) -> None:
    source = decode(GOLDEN["fixtures"][case["fixture"]])
    steps = recipe_from_json({"version": 1, "steps": case["steps"]})
    assert run(source, steps) == decode(case["expected"])

"""The recipes in spec/recipes run in both engines."""

from __future__ import annotations

from pathlib import Path

import pytest

from pixel_lab import Image
from pixel_lab.cli import main
from pixel_lab.io import save_image
from pixel_lab.recipe import load_recipe, run

RECIPES = sorted((Path(__file__).resolve().parents[2] / "spec" / "recipes").glob("*.json"))


@pytest.mark.parametrize("path", RECIPES, ids=lambda p: p.stem)
def test_shared_recipe_runs(path: Path, tmp_path: Path) -> None:
    steps = load_recipe(path)
    assert steps
    out = run(Image.blank(12, 8, "RGB", 120), steps)
    assert out.width >= 1
    src = save_image(Image.blank(12, 8, "RGB", 120), tmp_path / "in.png")
    assert main(["run", str(src), "-o", str(tmp_path / "out.png"), "-r", str(path), "-q"]) == 0


def test_disabled_steps_are_skipped() -> None:
    steps = load_recipe(next(p for p in RECIPES if p.stem == "custom-kernel"))
    out = run(Image.blank(12, 8, "RGB", 120), steps)
    assert (out.width, out.height) == (8, 12)  # rotated, but not seam-carved

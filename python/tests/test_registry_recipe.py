from __future__ import annotations

import json
from pathlib import Path

import pytest

from pixel_lab import Image, registry
from pixel_lab.recipe import Step, parse_step, recipe_from_json, recipe_to_json, run

SPEC_PATH = Path(__file__).resolve().parents[2] / "spec" / "operations.json"


@pytest.mark.parametrize("op_id", list(registry.OPERATIONS))
@pytest.mark.parametrize("mode", ["L", "LA", "RGB", "RGBA"])
def test_every_operation_runs_with_defaults(op_id: str, mode: str) -> None:
    img = Image.blank(9, 7, mode, 90)
    img.color[0][3][4] = 250  # some structure for edge detectors to find
    out = registry.get(op_id).apply(img)
    assert isinstance(out, Image)
    assert all(0 <= v <= 255 for p in out.planes for row in p for v in row)
    assert (out.alpha is None) == (img.alpha is None)


def test_spec_file_is_up_to_date() -> None:
    committed = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    assert committed == registry.spec(), "run: python scripts/generate_spec.py"


def test_param_validation_messages() -> None:
    blur = registry.get("gaussian_blur")
    with pytest.raises(ValueError, match="between"):
        blur.resolve({"sigma": 100})
    with pytest.raises(ValueError, match="unknown parameter"):
        blur.resolve({"radius": 3})
    with pytest.raises(ValueError, match="one of"):
        registry.get("flip").resolve({"axis": "diagonal"})
    with pytest.raises(ValueError, match="invalid value"):
        registry.get("box_blur").resolve({"radius": 2.5})
    with pytest.raises(ValueError, match="unknown operation"):
        registry.get("blurr")


def test_params_are_coerced_from_strings() -> None:
    assert registry.get("box_blur").resolve({"radius": "3"}) == {"radius": 3}
    assert registry.get("canny").resolve({"low": "12.5"})["low"] == 12.5


def test_parse_step_shorthand() -> None:
    step = parse_step("gaussian_blur:sigma=1.5")
    assert step == Step("gaussian_blur", {"sigma": 1.5})
    assert parse_step("invert") == Step("invert", {})
    kernel = parse_step("convolve:preset=custom,weights=0,-1,0,-1,5,-1,0,-1,0")
    assert kernel.params["weights"] == [0, -1, 0, -1, 5, -1, 0, -1, 0]
    assert str(Step("gaussian_blur", {"sigma": 2.0})) == "gaussian_blur:sigma=2"
    with pytest.raises(ValueError):
        parse_step("box_blur:3")


def test_recipe_roundtrip_and_disabled_steps() -> None:
    data = {
        "version": 1,
        "steps": [
            {"op": "invert", "params": {}},
            {"op": "brightness", "params": {"amount": 50}, "enabled": False},
        ],
    }
    steps = recipe_from_json(data)
    assert recipe_from_json(json.loads(json.dumps(recipe_to_json(steps)))) == steps
    img = Image.blank(2, 2, "L", 10)
    assert run(img, steps).color[0] == [[245, 245], [245, 245]]


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"version": 99, "steps": []}, "version"),
        ({"version": 1}, "steps"),
        ({"version": 1, "steps": [{"params": {}}]}, "'op'"),
        ({"version": 1, "steps": [{"op": "invert", "params": [1]}]}, "object"),
        ({"version": 1, "steps": [{"op": "invert"}] * 33}, "at most 32"),
        ("invert", "JSON object"),
    ],
)
def test_recipe_rejects_bad_input(data: object, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        recipe_from_json(data)


def test_results_above_50_megapixels_are_refused() -> None:
    with pytest.raises(ValueError, match="50 megapixels"):
        registry.get("resize").apply(Image.blank(4000, 4000, "L"), {"scale": 200})

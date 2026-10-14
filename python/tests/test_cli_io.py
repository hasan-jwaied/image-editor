from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image as PILImage

from pixel_lab import Image, load_image, save_image
from pixel_lab.cli import main
from pixel_lab.interactive import Session


@pytest.fixture
def photo(tmp_path: Path) -> Path:
    pil = PILImage.new("RGB", (24, 16))
    for x in range(24):
        for y in range(16):
            pil.putpixel((x, y), (x * 10, y * 15, 128))
    path = tmp_path / "in.png"
    pil.save(path)
    return path


def test_png_roundtrip_keeps_alpha(tmp_path: Path) -> None:
    img = Image([[[1, 2], [3, 4]]] * 3, [[255, 128], [0, 255]])
    path = save_image(img, tmp_path / "a.png")
    assert load_image(path) == img


def test_opaque_alpha_is_dropped(tmp_path: Path) -> None:
    PILImage.new("RGBA", (3, 3), (10, 20, 30, 255)).save(tmp_path / "o.png")
    assert load_image(tmp_path / "o.png").alpha is None


def test_jpeg_flattens_alpha_over_white(tmp_path: Path) -> None:
    img = Image([[[0]], [[0]], [[0]]], [[0]])
    loaded = load_image(save_image(img, tmp_path / "x.jpg"))
    assert loaded.alpha is None and all(p[0][0] > 245 for p in loaded.color)


def test_unknown_extension_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unsupported output format"):
        save_image(Image.blank(1, 1), tmp_path / "out.xyz")


def test_dotted_paths_are_respected(tmp_path: Path) -> None:
    # v1 turned "./out.jpg" into ".png" and "my.photo.jpg" into "my.png".
    path = save_image(Image.blank(2, 2), tmp_path / "my.photo.png")
    assert path.name == "my.photo.png" and path.exists()


def test_run_steps(photo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "out.png"
    code = main(["run", str(photo), "-o", str(out), "-s", "grayscale", "-s", "resize:scale=50"])
    assert code == 0
    result = load_image(out)
    assert (result.width, result.height, result.mode) == (12, 8, "L")
    assert "resize:scale=50" in capsys.readouterr().err


def test_run_recipe_and_max_size(photo: Path, tmp_path: Path) -> None:
    recipe = tmp_path / "r.json"
    recipe.write_text(json.dumps({"version": 1, "steps": [{"op": "flip", "params": {}}]}))
    out = tmp_path / "out.png"
    assert (
        main(["run", str(photo), "-o", str(out), "-r", str(recipe), "--max-size", "12", "-q"]) == 0
    )
    assert (load_image(out).width, load_image(out).height) == (12, 8)


def test_errors_exit_with_code_2(
    photo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["run", str(photo), "-o", str(tmp_path / "o.png"), "-s", "nope"]) == 2
    assert "unknown operation" in capsys.readouterr().err
    assert main(["run", str(tmp_path / "missing.png"), "-o", "o.png", "-s", "invert"]) == 2
    assert main(["run", str(photo), "-o", str(tmp_path / "o.png")]) == 2


def test_list_and_spec(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["list"]) == 0
    assert "seam_carve" in capsys.readouterr().out
    assert main(["spec"]) == 0
    assert json.loads(capsys.readouterr().out)["version"] == 1


def test_interactive_session(tmp_path: Path) -> None:
    session = Session(Image.blank(4, 4, "RGB", 100), "test")
    session.handle("invert")
    session.handle("brightness amount=10")
    assert session.image.color[0][0][0] == 165
    session.handle("undo")
    assert session.image.color[0][0][0] == 155
    session.handle("redo")
    assert len(session.steps) == 2
    session.handle(f"recipe {tmp_path / 'r.json'}")
    saved = json.loads((tmp_path / "r.json").read_text())
    assert [s["op"] for s in saved["steps"]] == ["invert", "brightness"]
    assert session.handle("quit") is False

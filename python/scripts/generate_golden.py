"""Generate spec/golden/golden.json: reference outputs from the Python engine.

The TypeScript engine's test suite replays every case and must reproduce the
same pixels, which is how we know the two implementations agree.

    python scripts/generate_golden.py          # regenerate
    python scripts/generate_golden.py --check  # fail if the file is stale (CI)
"""

from __future__ import annotations

import base64
import json
import sys
from itertools import chain
from pathlib import Path
from typing import Any

from pixel_lab import Image, registry
from pixel_lab.recipe import Step, run

OUT = Path(__file__).resolve().parents[2] / "spec" / "golden" / "golden.json"


# --- deterministic fixtures ---------------------------------------------------


def _lcg(seed: int):  # type: ignore[no-untyped-def]
    state = seed
    while True:
        state = (state * 1103515245 + 12345) % 2**31
        yield state >> 16


def _fixture_rgb(width: int = 37, height: int = 23) -> Image:
    noise = _lcg(7)
    r, g, b = ([[0] * width for _ in range(height)] for _ in range(3))
    for y in range(height):
        for x in range(width):
            n = next(noise) % 41 - 20
            inside_box = 8 <= x < 19 and 5 <= y < 14
            inside_disc = (x - 27) ** 2 + (y - 15) ** 2 < 30
            base = 230 if inside_box else 25 if inside_disc else 70 + 3 * x
            r[y][x] = max(0, min(255, base + n))
            g[y][x] = max(0, min(255, (base + 9 * y) % 256))
            b[y][x] = max(0, min(255, 255 - base + n // 2))
    return Image([r, g, b])


def _fixture_rgba(width: int = 19, height: int = 15) -> Image:
    noise = _lcg(11)
    planes = [[[next(noise) % 256 for _ in range(width)] for _ in range(height)] for _ in range(3)]
    alpha = [[min(255, 20 * x + 5 * y) for x in range(width)] for y in range(height)]
    return Image(planes, alpha)


def _fixture_gray(width: int = 29, height: int = 21) -> Image:
    noise = _lcg(3)
    rows = [
        [
            max(0, min(255, (200 if x > y + 4 else 40) + (60 if 10 <= y < 15 else 0)
                       + next(noise) % 17 - 8))
            for x in range(width)
        ]
        for y in range(height)
    ]  # fmt: skip
    return Image([rows])


FIXTURES = {"rgb": _fixture_rgb(), "rgba": _fixture_rgba(), "gray": _fixture_gray()}

VARIANTS: dict[str, list[dict[str, Any]]] = {
    "brightness": [{"amount": -80}, {"amount": 200}],
    "contrast": [{"amount": -50}, {"amount": 85}],
    "flip": [{"axis": "vertical"}],
    "rotate": [{"direction": "ccw"}, {"direction": "180"}],
    "resize": [{"scale": 1}, {"scale": 173}, {"scale": 300}, {"scale": 33}],
    "box_blur": [{"radius": 1}, {"radius": 3}, {"radius": 30}],
    "gaussian_blur": [{"sigma": 0.3}, {"sigma": 1.0}, {"sigma": 4.5}],
    "sharpen": [{"amount": 2.5, "sigma": 0.6}],
    "convolve": [{"preset": p} for p in ("sharpen", "outline", "box", "gaussian")]
    + [{"preset": "custom", "weights": [1, 2, 1, 0, 0, 0, -1, -2, -1]}],
    "canny": [{"sigma": 0, "low": 20, "high": 60}, {"sigma": 2.5, "low": 10, "high": 30}],
    "adaptive_threshold": [
        {"blur_radius": 0, "block_radius": 3, "offset": 2},
        {"blur_radius": 4, "block_radius": 20, "offset": -5},
    ],
    "posterize": [{"levels": 2}, {"levels": 7}],
    "dither": [{"levels": 3}, {"levels": 16}],
    "seam_carve": [
        {"width_percent": 10, "height_percent": 20},
        {"width_percent": 60, "height_percent": 60},
    ],
}

PIPELINES: dict[str, list[Step]] = {
    "sketch": [Step("grayscale"), Step("gaussian_blur", {"sigma": 1.2}), Step("canny")],
    "print": [Step("seam_carve", {"width_percent": 20}), Step("posterize", {"levels": 5}),
              Step("dither", {"levels": 3})],
    "chain": [Step("resize", {"scale": 150}), Step("sharpen"), Step("equalize"),
              Step("rotate", {"direction": "ccw"}), Step("sepia")],
}  # fmt: skip


# --- encoding -----------------------------------------------------------------


def encode(image: Image) -> dict[str, Any]:
    return {
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "planes": [base64.b64encode(bytes(chain.from_iterable(p))).decode() for p in image.planes],
    }


def decode(data: dict[str, Any]) -> Image:
    w, h = data["width"], data["height"]
    planes = [
        [list(raw[y * w : (y + 1) * w]) for y in range(h)]
        for raw in (base64.b64decode(p) for p in data["planes"])
    ]
    n_color = 1 if data["mode"].startswith("L") else 3
    return Image(planes[:n_color], planes[n_color] if data["mode"].endswith("A") else None)


def build() -> dict[str, Any]:
    cases = []

    def add(name: str, fixture: str, steps: list[Step]) -> None:
        steps = [s.validate() for s in steps]
        result = run(FIXTURES[fixture], steps)
        cases.append({
            "name": name,
            "fixture": fixture,
            "steps": [s.to_json() for s in steps],
            "expected": encode(result),
        })  # fmt: skip

    for op in registry.OPERATIONS.values():
        for fixture in FIXTURES:
            add(f"{op.id}@{fixture}", fixture, [Step(op.id)])
        for params in VARIANTS.get(op.id, []):
            label = ",".join(f"{k}={v}" for k, v in params.items())
            add(f"{op.id}({label})@rgb", "rgb", [Step(op.id, params)])
    for name, steps in PIPELINES.items():
        add(f"pipeline:{name}@rgb", "rgb", steps)

    return {
        "version": 1,
        "generator": "python/scripts/generate_golden.py",
        "fixtures": {k: encode(v) for k, v in FIXTURES.items()},
        "cases": cases,
    }


def serialize(data: dict[str, Any]) -> str:
    """One case per line so diffs stay readable."""
    head = {k: v for k, v in data.items() if k != "cases"}
    body = ",\n".join("    " + json.dumps(c, separators=(",", ":")) for c in data["cases"])
    text = json.dumps(head, indent=2)[:-2]
    return f'{text},\n  "cases": [\n{body}\n  ]\n}}\n'


if __name__ == "__main__":
    text = serialize(build())
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("spec/golden/golden.json is stale: run python scripts/generate_golden.py")
        print("golden file is up to date")
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(text, encoding="utf-8")
        summary = {"cases": len(json.loads(text)["cases"]), "operations": len(registry.OPERATIONS)}
        (OUT.parent / "summary.json").write_text(json.dumps(summary) + "\n", encoding="utf-8")
        print(f"wrote {len(json.loads(text)['cases'])} cases to {OUT.relative_to(OUT.parents[2])}")

"""Benchmark the Python engine (and the original v1 code) for the case study.

    python scripts/benchmark.py path/to/photo.jpg

Writes bench/python.json plus bench/input.bin and bench/input_rgb.bin (the
exact pixels used, so web/bench/bench.ts times the TypeScript engine on
identical input).
"""

from __future__ import annotations

import json
import math
import platform
import sys
import time
from collections.abc import Callable
from copy import deepcopy
from pathlib import Path
from typing import Any

from PIL import Image as PILImage

from pixel_lab import Image, load_image, registry
from pixel_lab.cli import fit_within
from pixel_lab.io import to_pil
from pixel_lab.ops import box_blur_naive, gaussian_blur, luma, resize_to
from pixel_lab.ops.filters import box_blur

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "bench"


# --- v1, verbatim from the original image_editor.py / image_helper.py --------


def v1_pad_image(image: list[list[int]], pad_size: int) -> list[list[int]]:
    padded = []
    for _ in range(pad_size):
        padded.append([image[0][0]] * pad_size + image[0] + [image[0][-1]] * pad_size)
    for row in image:
        padded.append([row[0]] * pad_size + row + [row[-1]] * pad_size)
    for _ in range(pad_size):
        padded.append([image[-1][0]] * pad_size + image[-1] + [image[-1][-1]] * pad_size)
    return padded


def v1_apply_kernel(image: list[list[int]], kernel: list[list[float]]) -> list[list[int]]:
    height, width = len(image), len(image[0])
    kernel_size = len(kernel)
    pad_size = kernel_size // 2
    padded_img = v1_pad_image(image, pad_size)
    result = [[0] * width for _ in range(height)]
    for r in range(height):
        for c in range(width):
            the_sum = 0.0
            for kr in range(kernel_size):
                for kc in range(kernel_size):
                    the_sum += padded_img[r + kr][c + kc] * kernel[kr][kc]
            result[r][c] = min(255, max(0, round(the_sum)))
    return result


def v1_save(image_as_lists: list[list[list[int]]]) -> PILImage.Image:
    image_as_lists_copy = deepcopy(image_as_lists)
    height, width = len(image_as_lists_copy), len(image_as_lists_copy[0])
    for i in range(height):
        for j in range(width):
            image_as_lists_copy[i][j] = tuple(image_as_lists_copy[i][j])  # type: ignore[call-overload]
    im = PILImage.new("RGB", (width, height))
    for i in range(width):
        for j in range(height):
            im.putpixel((i, j), image_as_lists_copy[j][i])
    return im


# --- harness -------------------------------------------------------------------


def timed(fn: Callable[[], Any], repeat: int = 1) -> float:
    best = math.inf
    for _ in range(repeat):
        started = time.perf_counter()
        fn()
        best = min(best, time.perf_counter() - started)
    return round(best * 1000, 1)


def main(photo: str) -> None:
    rgb = load_image(photo)
    rgb = resize_to(rgb, 1000, round(1000 * rgb.height / rgb.width)) if rgb.width > 1000 else rgb
    gray = Image([luma(rgb)])
    plane = gray.color[0]
    w, h = gray.width, gray.height
    print(f"input: {w}x{h} ({w * h / 1e6:.2f} MP)", file=sys.stderr)
    OUT.mkdir(exist_ok=True)
    (OUT / "input.bin").write_bytes(
        w.to_bytes(4, "little") + h.to_bytes(4, "little") + bytes(v for row in plane for v in row)
    )

    radii = [1, 2, 4, 7, 12, 20]
    blur: dict[str, list[float | None]] = {"v1": [], "naive": [], "separable": [], "sat": []}
    for r in radii:
        k = 2 * r + 1
        kernel = [[1 / (k * k)] * k for _ in range(k)]
        v1 = timed(lambda kernel=kernel: v1_apply_kernel(plane, kernel)) if r <= 7 else None
        blur["v1"].append(v1)
        blur["naive"].append(timed(lambda r=r: box_blur_naive(gray, r)) if r <= 7 else None)
        blur["separable"].append(timed(lambda r=r: gaussian_blur(gray, r / 3)))
        blur["sat"].append(timed(lambda r=r: box_blur(gray, r), repeat=2))
        print(f"  blur r={r:<3} {[v[-1] for v in blur.values()]}", file=sys.stderr)

    small = fit_within(rgb, 640)
    (OUT / "input_rgb.bin").write_bytes(
        small.width.to_bytes(4, "little")
        + small.height.to_bytes(4, "little")
        + b"".join(bytes(v for row in p for v in row) for p in small.color)
    )
    ops: dict[str, float] = {}
    for op in registry.OPERATIONS.values():
        ops[op.id] = timed(lambda op=op: op.apply(small), repeat=1 if op.id == "seam_carve" else 2)
        print(f"  {op.id:<20} {ops[op.id]:>9} ms", file=sys.stderr)

    lists = [[[r, g, b] for r, g, b in zip(*rows)] for rows in zip(*rgb.color)]
    io = {"v1_save": timed(lambda: v1_save(lists)), "v2_save": timed(lambda: to_pil(rgb), 3)}
    print(f"  encode for saving: {io}", file=sys.stderr)

    result = {
        "engine": "python",
        "runtime": f"CPython {platform.python_version()}",
        "machine": platform.processor() or platform.machine(),
        "blur": {"image": [w, h], "radii": radii, "ms": blur},
        "ops": {"image": [small.width, small.height], "ms": ops},
        "io": {"image": [rgb.width, rgb.height], "ms": io},
    }
    (OUT / "python.json").write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {OUT / 'python.json'}", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

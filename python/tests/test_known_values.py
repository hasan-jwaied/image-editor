from __future__ import annotations

import math

from pixel_lab import Image, ops
from pixel_lab.ops.tone import equalization_lut

from .conftest import gray


def test_luma_weights() -> None:
    red = Image([[[255]], [[0]], [[0]]])
    assert ops.luma(red) == [[76]]  # round(255 * 0.299) = round(76.245)


def test_sepia_on_white() -> None:
    white = Image.blank(1, 1, "RGB", 255)
    assert [p[0][0] for p in ops.sepia(white).color] == [255, 255, 239]


def test_bilinear_upscale_interpolates_between_neighbors() -> None:
    out = ops.resize_to(gray([[0, 100]]), 4, 1)
    # pixel-center sample positions: 0 (clamped), 0.25, 0.75, 1 (clamped)
    assert out.color[0] == [[0, 25, 75, 100]]


def test_rotate_cw_moves_top_left_to_top_right() -> None:
    img = gray([[1, 2, 3], [4, 5, 6]])
    assert ops.rotate(img, "cw").color[0] == [[4, 1], [5, 2], [6, 3]]
    assert ops.rotate(img, "ccw").color[0] == [[3, 6], [2, 5], [1, 4]]


def test_convolution_flips_the_kernel() -> None:
    # A kernel with a single 1 to the right of center. As a true convolution
    # (flipped) it samples the pixel to the LEFT, shifting the image right.
    img = gray([[10, 20, 30, 40]])
    out = ops.convolve(img, "custom", [0, 0, 0, 0, 0, 1, 0, 0, 0])
    assert out.color[0] == [[10, 10, 20, 30]]


def test_sobel_on_a_vertical_step() -> None:
    img = gray([[0, 0, 255, 255]] * 3)
    gx, gy = ops.sobel_gradients(img.color[0])
    assert gx[1] == [0, 1020, 1020, 0]
    assert gy[1] == [0, 0, 0, 0]
    assert ops.sobel(img).color[0][1] == [0, 255, 255, 0]


def test_canny_finds_a_thin_vertical_edge() -> None:
    rows = [[0] * 6 + [255] * 6 for _ in range(10)]
    edges = ops.canny(gray(rows), 0, 50, 100).color[0]
    for row in edges[1:-1]:
        lit = [x for x, v in enumerate(row) if v]
        assert lit and len(lit) <= 2 and all(4 <= x <= 7 for x in lit)


def test_seam_carving_preserves_a_high_energy_object() -> None:
    # Flat background with a vertical stripe; carving must not cut the stripe.
    rows = [[200 if x in (10, 11) else 50 for x in range(20)] for _ in range(8)]
    out = ops.seam_carve(gray(rows), 50, 0).color[0]
    assert all(row.count(200) == 2 for row in out)


def test_equalization_lut_spreads_two_levels() -> None:
    counts = [0] * 256
    counts[100], counts[110] = 50, 50
    lut = equalization_lut(counts)
    assert lut[100] == 0 and lut[110] == 255


def test_gaussian_kernel_is_normalized_and_symmetric() -> None:
    k = ops.gaussian_kernel(1.5)
    assert len(k) == 2 * math.ceil(4.5) + 1
    assert math.isclose(sum(k), 1.0)
    assert k == k[::-1]


def test_dither_preserves_average_brightness() -> None:
    img = gray([[128] * 32 for _ in range(32)])
    out = ops.dither(img, 2).color[0]
    white = sum(v == 255 for row in out for v in row)
    assert abs(white / (32 * 32) - 128 / 255) < 0.02


def test_adaptive_threshold_marks_dark_detail() -> None:
    rows = [[200] * 9 for _ in range(9)]
    rows[4][4] = 20
    out = ops.adaptive_threshold(gray(rows), 0, 3, 5.0).color[0]
    assert out[4][4] == 0
    assert sum(v == 0 for row in out for v in row) == 1

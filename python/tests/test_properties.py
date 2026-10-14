"""Algebraic properties every correct implementation must satisfy."""

from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from pixel_lab import Image, ops
from pixel_lab._math import integral_image

from .conftest import constant, images


@given(images())
def test_four_quarter_turns_are_identity(img: Image) -> None:
    out = img
    for _ in range(4):
        out = ops.rotate(out, "cw")
    assert out == img


@given(images())
def test_rotations_compose(img: Image) -> None:
    assert ops.rotate(ops.rotate(img, "cw"), "ccw") == img
    assert ops.rotate(ops.rotate(img, "cw"), "cw") == ops.rotate(img, "180")


@given(images(), st.sampled_from(["horizontal", "vertical"]))
def test_flip_twice_is_identity(img: Image, axis: str) -> None:
    assert ops.flip(ops.flip(img, axis), axis) == img


@given(images())
def test_invert_twice_is_identity(img: Image) -> None:
    assert ops.invert(ops.invert(img)) == img


@given(images())
def test_neutral_parameters_are_identity(img: Image) -> None:
    assert ops.brightness(img, 0) == img
    assert ops.contrast(img, 0) == img
    assert ops.resize(img, 100) == img
    assert ops.box_blur(img, 0) == img
    assert ops.seam_carve(img, 0, 0) == img
    assert ops.convolve(img, "custom", [0, 0, 0, 0, 1, 0, 0, 0, 0]) == img


@given(images())
def test_grayscale_is_idempotent_and_keeps_alpha(img: Image) -> None:
    g = ops.grayscale(img)
    assert g.is_gray
    assert g.alpha == img.alpha
    assert ops.grayscale(g) == g


@given(st.integers(1, 9), st.integers(1, 9), st.integers(0, 255), st.integers(0, 6))
def test_blurs_leave_flat_images_unchanged(w: int, h: int, v: int, r: int) -> None:
    img = constant(w, h, v)
    assert ops.box_blur(img, r) == img
    assert ops.gaussian_blur(img, 0.5 + r) == img
    assert ops.sharpen(img, 2.0, 1.0) == img
    assert ops.convolve(img, "emboss") == img  # emboss weights sum to 1


@given(images(modes=("L", "RGB")), st.integers(1, 4))
def test_sat_box_blur_matches_naive_convolution(img: Image, radius: int) -> None:
    fast, slow = ops.box_blur(img, radius), ops.box_blur_naive(img, radius)
    for pf, ps in zip(fast.color, slow.color):
        for rf, rs in zip(pf, ps):
            assert all(abs(a - b) <= 1 for a, b in zip(rf, rs))


@given(images(max_side=7))
def test_integral_image_rectangle_sums(img: Image) -> None:
    plane = img.color[0]
    table = integral_image(plane)
    h, w = img.height, img.width
    for y0 in range(h):
        for y1 in range(y0 + 1, h + 1):
            for x0 in range(w):
                for x1 in range(x0 + 1, w + 1):
                    brute = sum(plane[y][x] for y in range(y0, y1) for x in range(x0, x1))
                    rect = table[y1][x1] - table[y0][x1] - table[y1][x0] + table[y0][x0]
                    assert rect == brute


def _all_seams(height: int, width: int) -> list[list[int]]:
    seams = [[x] for x in range(width)]
    for _ in range(height - 1):
        seams = [[*s, n] for s in seams for n in (s[-1] - 1, s[-1], s[-1] + 1) if 0 <= n < width]
    return seams


@given(st.integers(1, 5), st.integers(1, 5), st.data())
def test_find_seam_is_optimal(h: int, w: int, data: st.DataObject) -> None:
    energy = [data.draw(st.lists(st.integers(0, 50), min_size=w, max_size=w)) for _ in range(h)]
    seam = ops.find_seam(energy)
    assert len(seam) == h and all(abs(a - b) <= 1 for a, b in zip(seam, seam[1:]))
    cost = sum(energy[y][x] for y, x in enumerate(seam))
    assert cost == min(sum(energy[y][x] for y, x in enumerate(s)) for s in _all_seams(h, w))


@given(images(), st.integers(2, 12))
def test_posterize_uses_only_its_levels(img: Image, levels: int) -> None:
    allowed = {round(i * 255 / (levels - 1)) for i in range(levels)}
    out = ops.posterize(img, levels)
    assert {v for p in out.color for row in p for v in row} <= allowed


@given(images(), st.integers(2, 6))
def test_dither_uses_only_its_palette(img: Image, levels: int) -> None:
    allowed = {round(i * 255 / (levels - 1)) for i in range(levels)}
    out = ops.dither(img, levels)
    assert {v for p in out.color for row in p for v in row} <= allowed


@given(images())
def test_dither_leaves_palette_images_unchanged(img: Image) -> None:
    binary = ops.posterize(img, 2)
    assert ops.dither(binary, 2) == binary


@given(images(modes=("L",), max_side=12))
def test_equalize_spans_full_range(img: Image) -> None:
    values = {v for row in img.color[0] for v in row}
    out = {v for row in ops.equalize(img).color[0] for v in row}
    if len(values) > 1:
        assert min(out) == 0 and max(out) == 255
    else:
        assert out == values


@given(images(), st.integers(0, 60), st.integers(0, 60))
def test_seam_carve_removes_exact_counts(img: Image, wp: int, hp: int) -> None:
    out = ops.seam_carve(img, wp, hp)
    assert out.width == img.width - min(round(img.width * wp / 100), img.width - 1)
    assert out.height == img.height - min(round(img.height * hp / 100), img.height - 1)
    assert out.mode == img.mode


@given(images())
def test_binary_outputs(img: Image) -> None:
    for out in (ops.canny(img, 1.0, 20, 60), ops.adaptive_threshold(img, 1, 3, 2.0)):
        assert out.is_gray
        assert {v for row in out.color[0] for v in row} <= {0, 255}


@given(images(modes=("RGBA", "LA")))
def test_geometry_moves_alpha_with_color(img: Image) -> None:
    rotated = ops.rotate(img, "cw")
    assert rotated.alpha == ops.rotate(Image([img.alpha or []]), "cw").color[0]
    assert ops.invert(img).alpha == img.alpha  # color ops never touch alpha


@given(images(), st.integers(1, 300))
def test_resize_dimensions(img: Image, scale: int) -> None:
    out = ops.resize(img, scale)
    assert out.width == max(1, round(img.width * scale / 100))
    assert out.height == max(1, round(img.height * scale / 100))

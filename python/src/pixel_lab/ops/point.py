"""Point operations. Single-channel ones run through a 256-entry lookup table."""

from __future__ import annotations

import math

from ..image import Channel, Image, map_color

LUT = list[int]


def apply_lut(image: Image, lut: LUT) -> Image:
    return map_color(image, lambda plane: [[lut[p] for p in row] for row in plane])


def luma(image: Image) -> Channel:
    """Rec. 601 luma."""
    if image.is_gray:
        return image.color[0]
    r, g, b = image.color
    return [
        [round(rv * 0.299 + gv * 0.587 + bv * 0.114) for rv, gv, bv in zip(rr, gr, br)]
        for rr, gr, br in zip(r, g, b)
    ]


def grayscale(image: Image) -> Image:
    if image.is_gray:
        return image
    return Image([luma(image)], image.alpha)


def invert(image: Image) -> Image:
    return apply_lut(image, [255 - p for p in range(256)])


def brightness(image: Image, amount: int) -> Image:
    return apply_lut(image, [min(255, max(0, p + amount)) for p in range(256)])


def contrast(image: Image, amount: int) -> Image:
    """Scale distances from mid-gray by ``(100 + amount) / 100``."""
    factor = (100 + amount) / 100
    lut = [min(255, max(0, round((p - 128) * factor + 128))) for p in range(256)]
    return apply_lut(image, lut)


def posterize(image: Image, levels: int) -> Image:
    step = 255 / (levels - 1)
    return apply_lut(image, [round(math.floor(p * levels / 256) * step) for p in range(256)])


def sepia(image: Image) -> Image:
    """Grayscale input becomes RGB."""
    r, g, b = image.color * 3 if image.is_gray else image.color

    def mix(cr: float, cg: float, cb: float) -> Channel:
        return [
            [min(255, round(rv * cr + gv * cg + bv * cb)) for rv, gv, bv in zip(rr, gr, br)]
            for rr, gr, br in zip(r, g, b)
        ]

    return Image(
        [mix(0.393, 0.769, 0.189), mix(0.349, 0.686, 0.168), mix(0.272, 0.534, 0.131)],
        image.alpha,
    )

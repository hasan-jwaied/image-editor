"""Geometric transforms. These move pixels around, so alpha moves with them."""

from __future__ import annotations

from ..image import Channel, Image, map_planes


def flip(image: Image, axis: str) -> Image:
    if axis == "horizontal":
        return map_planes(image, lambda plane: [row[::-1] for row in plane])
    if axis == "vertical":
        return map_planes(image, lambda plane: [row[:] for row in reversed(plane)])
    raise ValueError(f"unknown axis {axis!r}")


def rotate(image: Image, direction: str) -> Image:
    """Rotate by a quarter or half turn using transposition (``zip(*rows)``)."""
    if direction == "cw":
        return map_planes(image, lambda plane: [list(col) for col in zip(*plane[::-1])])
    if direction == "ccw":
        return map_planes(image, lambda plane: [list(col) for col in zip(*plane)][::-1])
    if direction == "180":
        return map_planes(image, lambda plane: [row[::-1] for row in plane[::-1]])
    raise ValueError(f"unknown direction {direction!r}")


def _sample_positions(src: int, dst: int) -> tuple[list[int], list[int], list[float]]:
    """For each destination index, the two source indices and the blend weight.

    Uses pixel-centre alignment: destination pixel ``i`` covers the same
    fraction of the image as the source position ``(i + 0.5) * src / dst - 0.5``.
    """
    ratio = src / dst
    lo, hi, frac = [], [], []
    for i in range(dst):
        s = (i + 0.5) * ratio - 0.5
        if s < 0:
            s = 0.0
        elif s > src - 1:
            s = float(src - 1)
        i0 = int(s)
        lo.append(i0)
        hi.append(min(i0 + 1, src - 1))
        frac.append(s - i0)
    return lo, hi, frac


def resize_to(image: Image, width: int, height: int) -> Image:
    """Bilinear interpolation: blend the four nearest source pixels."""
    if width < 1 or height < 1:
        raise ValueError("target size must be at least 1x1")
    x0, x1, fx = _sample_positions(image.width, width)
    y0, y1, fy = _sample_positions(image.height, height)
    columns = list(zip(x0, x1, fx))

    def resample(plane: Channel) -> Channel:
        out = []
        for top_i, bot_i, wy in zip(y0, y1, fy):
            top, bot = plane[top_i], plane[bot_i]
            row = []
            for a, b, wx in columns:
                v = round(
                    (top[a] * (1 - wx) + top[b] * wx) * (1 - wy)
                    + (bot[a] * (1 - wx) + bot[b] * wx) * wy
                )
                row.append(0 if v < 0 else 255 if v > 255 else v)
            out.append(row)
        return out

    return map_planes(image, resample)


def resize(image: Image, scale: int) -> Image:
    """Resize by a percentage, keeping the aspect ratio."""
    width = max(1, round(image.width * scale / 100))
    height = max(1, round(image.height * scale / 100))
    return resize_to(image, width, height)

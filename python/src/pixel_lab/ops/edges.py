from __future__ import annotations

import math

from .._math import integral_image, pad_edge
from ..image import Channel, Image
from .filters import box_blur_channel, gaussian_channel
from .point import luma

Gradient = list[list[int]]


def sobel_gradients(channel: Channel) -> tuple[Gradient, Gradient]:
    p = pad_edge(channel, 1)
    width = len(channel[0])
    gx: Gradient = []
    gy: Gradient = []
    for y in range(len(channel)):
        a, b, c = p[y], p[y + 1], p[y + 2]
        gx.append(
            [(a[x + 2] + 2 * b[x + 2] + c[x + 2]) - (a[x] + 2 * b[x] + c[x]) for x in range(width)]
        )
        gy.append(
            [
                (c[x] + 2 * c[x + 1] + c[x + 2]) - (a[x] + 2 * a[x + 1] + a[x + 2])
                for x in range(width)
            ]
        )
    return gx, gy


def _magnitude(gx: Gradient, gy: Gradient) -> list[list[float]]:
    return [[math.sqrt(x * x + y * y) for x, y in zip(rx, ry)] for rx, ry in zip(gx, gy)]


def _to_bytes(values: list[list[float]]) -> Channel:
    return [[min(255, round(v)) for v in row] for row in values]


def sobel(image: Image) -> Image:
    gx, gy = sobel_gradients(luma(image))
    return Image([_to_bytes(_magnitude(gx, gy))], image.alpha)


# tan(22.5 deg) ~= 0.414, kept as an integer ratio so direction binning is exact.
_TAN_NUM, _TAN_DEN = 414, 1000


def _non_maximum_suppression(
    mag: list[list[float]], gx: Gradient, gy: Gradient
) -> list[list[float]]:
    """Thin edges to one pixel by keeping only local maxima along the gradient."""
    height, width = len(mag), len(mag[0])
    out = [[0.0] * width for _ in range(height)]
    for y in range(1, height - 1):
        above, row, below = mag[y - 1], mag[y], mag[y + 1]
        rx, ry, orow = gx[y], gy[y], out[y]
        for x in range(1, width - 1):
            m = row[x]
            if m == 0:
                continue
            dx, dy = rx[x], ry[x]
            ax, ay = abs(dx), abs(dy)
            if _TAN_DEN * ay <= _TAN_NUM * ax:  # gradient ~horizontal: edge runs vertically
                n1, n2 = row[x - 1], row[x + 1]
            elif _TAN_DEN * ax <= _TAN_NUM * ay:  # gradient ~vertical
                n1, n2 = above[x], below[x]
            elif (dx > 0) == (dy > 0):  # gradient points down-right or up-left
                n1, n2 = above[x - 1], below[x + 1]
            else:
                n1, n2 = above[x + 1], below[x - 1]
            if m >= n1 and m >= n2:
                orow[x] = m
    return out


def _hysteresis(nms: list[list[float]], low: float, high: float) -> Channel:
    """Keep strong edges, plus weak edges 8-connected to a strong one."""
    height, width = len(nms), len(nms[0])
    out = [[0] * width for _ in range(height)]
    stack = [(y, x) for y in range(height) for x in range(width) if nms[y][x] >= high]
    for y, x in stack:
        out[y][x] = 255
    while stack:
        y, x = stack.pop()
        for ny in (y - 1, y, y + 1):
            if ny < 0 or ny >= height:
                continue
            nrow, orow = nms[ny], out[ny]
            for nx in (x - 1, x, x + 1):
                if 0 <= nx < width and orow[nx] == 0 and nrow[nx] >= low:
                    orow[nx] = 255
                    stack.append((ny, nx))
    return out


def canny_stages(image: Image, sigma: float, low: float, high: float) -> dict[str, Channel]:
    """All four stages, for the explainer."""
    gray = luma(image)
    smoothed = gaussian_channel(gray, sigma) if sigma > 0 else gray
    gx, gy = sobel_gradients(smoothed)
    mag = _magnitude(gx, gy)
    nms = _non_maximum_suppression(mag, gx, gy)
    return {
        "smoothed": smoothed,
        "gradient": _to_bytes(mag),
        "suppressed": _to_bytes(nms),
        "edges": _hysteresis(nms, min(low, high), high),
    }


def canny(image: Image, sigma: float, low: float, high: float) -> Image:
    return Image([canny_stages(image, sigma, low, high)["edges"]], image.alpha)


def adaptive_threshold(image: Image, blur_radius: int, block_radius: int, offset: float) -> Image:
    """Black where a pixel is darker than its block's mean. Blocks are clipped at the border."""
    smoothed = box_blur_channel(luma(image), blur_radius)
    height, width = len(smoothed), len(smoothed[0])
    table = integral_image(smoothed)
    c0 = [max(0, x - block_radius) for x in range(width)]
    c1 = [min(width, x + block_radius + 1) for x in range(width)]
    out = []
    for y in range(height):
        r0, r1 = max(0, y - block_radius), min(height, y + block_radius + 1)
        top, bottom, rows = table[r0], table[r1], r1 - r0
        out.append(
            [
                0
                if v < (bottom[b] - top[b] - bottom[a] + top[a]) / (rows * (b - a)) - offset
                else 255
                for v, a, b in zip(smoothed[y], c0, c1)
            ]
        )
    return Image([out], image.alpha)

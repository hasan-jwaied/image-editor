"""Seam carving: content-aware resizing (Avidan & Shamir, 2007).

A *seam* is a connected path of pixels, one per row, from top to bottom.
Removing the seam with the least total "energy" (local contrast) shrinks the
image by one column while leaving important structure intact. The cheapest
seam is found with dynamic programming:

    M[y][x] = energy[y][x] + min(M[y-1][x-1], M[y-1][x], M[y-1][x+1])

then traced back from the smallest value in the last row. Ties always go to
the leftmost candidate so the result is deterministic across engines.
"""

from __future__ import annotations

from ..image import Channel, Image
from .point import luma

_INF = float("inf")


def energy_map(gray: Channel) -> list[list[int]]:
    """Dual-gradient energy: |dI/dx| + |dI/dy| with clamped borders."""
    height = len(gray)
    out = []
    for y in range(height):
        row = gray[y]
        up, down = gray[max(0, y - 1)], gray[min(height - 1, y + 1)]
        padded = [row[0], *row, row[-1]]
        out.append(
            [abs(padded[x + 2] - padded[x]) + abs(d - u) for x, (u, d) in enumerate(zip(up, down))]
        )
    return out


def find_seam(energy: list[list[int]]) -> list[int]:
    """Column index of the minimum-energy vertical seam, one per row."""
    cost: list[list[float]] = [list(map(float, energy[0]))]
    for erow in energy[1:]:
        prev = [_INF, *cost[-1], _INF]
        cost.append([e + min(prev[x], prev[x + 1], prev[x + 2]) for x, e in enumerate(erow)])

    last = cost[-1]
    x = last.index(min(last))
    seam = [x]
    width = len(last)
    for y in range(len(cost) - 2, -1, -1):
        row = cost[y]
        best = x
        if x > 0 and row[x - 1] <= row[best]:
            best = x - 1
        if x + 1 < width and row[x + 1] < row[best]:
            best = x + 1
        x = best
        seam.append(x)
    seam.reverse()
    return seam


def _carve_columns(planes: list[Channel], gray: Channel, count: int) -> None:
    """Remove ``count`` vertical seams from every plane, in place."""
    for _ in range(count):
        seam = find_seam(energy_map(gray))
        for plane in (*planes, gray):
            for row, x in zip(plane, seam):
                del row[x]


def _transpose(plane: Channel) -> Channel:
    return [list(col) for col in zip(*plane)]


def seam_carve(image: Image, width_percent: int, height_percent: int) -> Image:
    planes = [[row[:] for row in plane] for plane in image.planes]
    gray = [row[:] for row in luma(image)]

    columns = min(round(image.width * width_percent / 100), image.width - 1)
    _carve_columns(planes, gray, columns)

    rows = min(round(image.height * height_percent / 100), image.height - 1)
    if rows > 0:
        planes = [_transpose(p) for p in planes]
        gray = _transpose(gray)
        _carve_columns(planes, gray, rows)
        planes = [_transpose(p) for p in planes]

    n_color = len(image.color)
    alpha = planes[n_color] if image.alpha is not None else None
    return Image(planes[:n_color], alpha)

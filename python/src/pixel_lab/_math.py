"""Small numeric helpers shared by the operations.

Rounding note: Python's ``round`` rounds halves to even (``round(2.5) == 2``).
The TypeScript engine mirrors this exactly with ``roundHalfEven`` so that both
implementations produce identical pixels (see ``spec/golden``).
"""

from __future__ import annotations

from .image import Channel


def pad_edge(channel: Channel, pad: int) -> Channel:
    """Pad a plane by repeating its border pixels (clamp-to-edge).

    Padding once up front lets the inner loops of convolutions index the
    neighbourhood directly, with no per-pixel bounds checks.
    """
    if pad == 0:
        return channel
    top, bottom = channel[0], channel[-1]

    def widen(row: list[int]) -> list[int]:
        return [row[0]] * pad + row + [row[-1]] * pad

    return (
        [widen(top) for _ in range(pad)]
        + [widen(row) for row in channel]
        + [widen(bottom) for _ in range(pad)]
    )


def integral_image(channel: Channel) -> list[list[int]]:
    """Summed-area table with a leading row and column of zeros.

    ``table[y][x]`` is the sum of every pixel above and to the left of (y, x),
    so the sum over any rectangle costs four lookups::

        sum(y0..y1, x0..x1) = T[y1][x1] - T[y0][x1] - T[y1][x0] + T[y0][x0]
    """
    width = len(channel[0])
    table = [[0] * (width + 1)]
    previous = table[0]
    for row in channel:
        running = 0
        current = [0]
        for x, value in enumerate(row, start=1):
            running += value
            current.append(previous[x] + running)
        table.append(current)
        previous = current
    return table

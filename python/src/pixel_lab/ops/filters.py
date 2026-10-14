"""Blurs, sharpening and convolution.

convolve_channel   O(N*k^2)
gaussian_channel   O(N*k), two 1-D passes
box_blur_channel   O(N), summed-area table

Loops add one kernel tap at a time across a row, the same order the
TypeScript engine uses, so both give identical pixels.
"""

from __future__ import annotations

import math

from .._math import integral_image, pad_edge
from ..image import Channel, Image, map_color

Kernel = list[list[float]]

KERNEL_PRESETS: dict[str, Kernel] = {
    "sharpen": [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    "emboss": [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
    "outline": [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
    "box": [[1 / 9] * 3 for _ in range(3)],
    "gaussian": [[1 / 16, 2 / 16, 1 / 16], [2 / 16, 4 / 16, 2 / 16], [1 / 16, 2 / 16, 1 / 16]],
}


def _round_row(acc: list[float]) -> list[int]:
    return [0 if v < 0 else 255 if v > 255 else v for v in map(round, acc)]


def convolve_channel(channel: Channel, kernel: Kernel) -> Channel:
    """True convolution (kernel flipped) with clamp-to-edge borders."""
    size = len(kernel)
    if size % 2 == 0 or any(len(row) != size for row in kernel):
        raise ValueError("kernel must be square with an odd size")
    pad = size // 2
    flipped = [row[::-1] for row in kernel[::-1]]
    taps = [(ky, kx, w) for ky, row in enumerate(flipped) for kx, w in enumerate(row) if w != 0]
    padded = pad_edge(channel, pad)
    width = len(channel[0])
    out = []
    for y in range(len(channel)):
        acc = [0.0] * width
        for ky, kx, w in taps:
            src = padded[y + ky]
            acc = [a + v * w for a, v in zip(acc, src[kx : kx + width])]
        out.append(_round_row(acc))
    return out


def kernel_from_weights(weights: list[float]) -> Kernel:
    size = math.isqrt(len(weights))
    if size * size != len(weights) or size % 2 == 0:
        raise ValueError("custom kernel needs an odd square number of weights (9, 25, ...)")
    return [list(weights[i * size : (i + 1) * size]) for i in range(size)]


def convolve(image: Image, preset: str, weights: list[float] | None = None) -> Image:
    if preset == "custom":
        kernel = kernel_from_weights(weights or [0, 0, 0, 0, 1, 0, 0, 0, 0])
    else:
        kernel = KERNEL_PRESETS[preset]
    return map_color(image, lambda plane: convolve_channel(plane, kernel))


def box_blur_naive(image: Image, radius: int) -> Image:
    """O(N * k^2) baseline for the benchmark."""
    size = 2 * radius + 1
    kernel = [[1 / (size * size)] * size for _ in range(size)]
    return map_color(image, lambda plane: convolve_channel(plane, kernel))


def box_blur_channel(channel: Channel, radius: int) -> Channel:
    """Summed-area table: four lookups per pixel at any radius."""
    if radius <= 0:
        return [row[:] for row in channel]
    size = 2 * radius + 1
    area = size * size
    table = integral_image(pad_edge(channel, radius))
    width = len(channel[0])
    out = []
    for y in range(len(channel)):
        top, bottom = table[y], table[y + size]
        out.append(
            [
                round((bottom[x + size] - top[x + size] - bottom[x] + top[x]) / area)
                for x in range(width)
            ]
        )
    return out


def box_blur(image: Image, radius: int) -> Image:
    return map_color(image, lambda plane: box_blur_channel(plane, radius))


def gaussian_kernel(sigma: float) -> list[float]:
    """Normalized 1-D Gaussian weights covering +-3 sigma."""
    radius = max(1, math.ceil(3 * sigma))
    weights = [math.exp(-(i * i) / (2 * sigma * sigma)) for i in range(-radius, radius + 1)]
    total = 0.0
    for w in weights:  # explicit loop: sum() is compensated on 3.12+, JS has no equivalent
        total += w
    return [w / total for w in weights]


def gaussian_channel(channel: Channel, sigma: float) -> Channel:
    """Blur rows, then columns. The intermediate result stays in floats."""
    weights = gaussian_kernel(sigma)
    radius = len(weights) // 2
    height, width = len(channel), len(channel[0])

    rows: list[list[float]] = []
    for row in channel:
        padded = [row[0]] * radius + row + [row[-1]] * radius
        acc = [0.0] * width
        for i, w in enumerate(weights):
            acc = [a + v * w for a, v in zip(acc, padded[i : i + width])]
        rows.append(acc)

    out = []
    for y in range(height):
        acc = [0.0] * width
        for i, w in enumerate(weights):
            src = rows[min(height - 1, max(0, y + i - radius))]
            acc = [a + v * w for a, v in zip(acc, src)]
        out.append(_round_row(acc))
    return out


def gaussian_blur(image: Image, sigma: float) -> Image:
    return map_color(image, lambda plane: gaussian_channel(plane, sigma))


def sharpen(image: Image, amount: float, sigma: float) -> Image:
    """Unsharp mask."""

    def channel(plane: Channel) -> Channel:
        blurred = gaussian_channel(plane, sigma)
        return [
            [
                0 if v < 0 else 255 if v > 255 else v
                for v in (round(p + amount * (p - q)) for p, q in zip(row, brow))
            ]
            for row, brow in zip(plane, blurred)
        ]

    return map_color(image, channel)

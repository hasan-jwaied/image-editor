from __future__ import annotations

from ..image import Channel, Image


def histogram(channel: Channel) -> list[int]:
    counts = [0] * 256
    for row in channel:
        for v in row:
            counts[v] += 1
    return counts


def equalization_lut(counts: list[int]) -> list[int]:
    """Map each level through the normalised cumulative histogram."""
    total = sum(counts)
    cdf, running = [], 0
    for c in counts:
        running += c
        cdf.append(running)
    cdf_min = next(c for c in cdf if c > 0)
    if cdf_min == total:  # a single flat color has nothing to spread
        return list(range(256))
    return [max(0, round((c - cdf_min) * 255 / (total - cdf_min))) for c in cdf]


def equalize(image: Image) -> Image:
    """Equalise luma only (full-range YCbCr), so colors don't shift."""
    if image.is_gray:
        lut = equalization_lut(histogram(image.color[0]))
        return Image([[[lut[v] for v in row] for row in image.color[0]]], image.alpha)

    r, g, b = image.color
    ys: Channel = [
        [round(rv * 0.299 + gv * 0.587 + bv * 0.114) for rv, gv, bv in zip(rr, gr, br)]
        for rr, gr, br in zip(r, g, b)
    ]
    lut = equalization_lut(histogram(ys))
    out_r: Channel = []
    out_g: Channel = []
    out_b: Channel = []
    for rr, gr, br, yr in zip(r, g, b, ys):
        orr, ogr, obr = [], [], []
        for rv, gv, bv, yv in zip(rr, gr, br, yr):
            cb = -0.168736 * rv - 0.331264 * gv + 0.5 * bv
            cr = 0.5 * rv - 0.418688 * gv - 0.081312 * bv
            y = lut[yv]
            nr = round(y + 1.402 * cr)
            ng = round(y - 0.344136 * cb - 0.714136 * cr)
            nb = round(y + 1.772 * cb)
            orr.append(0 if nr < 0 else 255 if nr > 255 else nr)
            ogr.append(0 if ng < 0 else 255 if ng > 255 else ng)
            obr.append(0 if nb < 0 else 255 if nb > 255 else nb)
        out_r.append(orr)
        out_g.append(ogr)
        out_b.append(obr)
    return Image([out_r, out_g, out_b], image.alpha)

from __future__ import annotations

from ..image import Channel, Image, map_color


def _dither_channel(channel: Channel, levels: int) -> Channel:
    """Spread each pixel's rounding error to its unvisited neighbours:

           *    7/16
    3/16  5/16  1/16
    """
    steps = levels - 1
    palette = [round(q * 255 / steps) for q in range(levels)]
    height, width = len(channel), len(channel[0])
    buf = [[float(v) for v in row] for row in channel]
    out = []
    for y in range(height):
        row = buf[y]
        below = buf[y + 1] if y + 1 < height else None
        orow = [0] * width
        for x in range(width):
            old = row[x]
            q = round(old * steps / 255)
            q = 0 if q < 0 else steps if q > steps else q
            new = palette[q]
            orow[x] = new
            err = old - new
            if x + 1 < width:
                row[x + 1] += err * 7 / 16
            if below is not None:
                if x > 0:
                    below[x - 1] += err * 3 / 16
                below[x] += err * 5 / 16
                if x + 1 < width:
                    below[x + 1] += err * 1 / 16
        out.append(orow)
    return out


def dither(image: Image, levels: int) -> Image:
    return map_color(image, lambda plane: _dither_channel(plane, levels))

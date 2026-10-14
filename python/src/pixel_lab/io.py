"""Loading and saving. Pillow handles file formats only, never pixel work."""

from __future__ import annotations

from itertools import chain
from pathlib import Path
from typing import Any

from PIL import Image as PILImage
from PIL import ImageOps

from .image import Channel, Image

GRAY_MODES = {"1", "L", "LA", "I", "I;16", "F"}
WRITABLE = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".gif"}
NO_ALPHA = {".jpg", ".jpeg", ".bmp"}


def _rows(data: bytes, width: int, height: int) -> Channel:
    return [list(data[y * width : (y + 1) * width]) for y in range(height)]


def from_pil(pil: PILImage.Image) -> Image:
    has_alpha = pil.mode in ("RGBA", "LA", "PA") or "transparency" in pil.info
    gray = pil.mode in GRAY_MODES
    target = ("L" if gray else "RGB") + ("A" if has_alpha else "")
    pil = pil.convert(target)
    width, height = pil.size
    planes = [_rows(band.tobytes(), width, height) for band in pil.split()]
    color, alpha = (planes[:-1], planes[-1]) if has_alpha else (planes, None)
    if alpha is not None and all(v == 255 for row in alpha for v in row):
        alpha = None  # fully opaque: skip the extra plane
    return Image(color, alpha)


def to_pil(image: Image) -> PILImage.Image:
    size = (image.width, image.height)
    bands = [PILImage.frombytes("L", size, bytes(chain.from_iterable(p))) for p in image.planes]
    return bands[0] if len(bands) == 1 else PILImage.merge(image.mode, bands)


def load_image(path: str | Path) -> Image:
    """Load any format Pillow can read, honouring EXIF orientation."""
    with PILImage.open(path) as pil:
        return from_pil(ImageOps.exif_transpose(pil))


def save_image(image: Image, path: str | Path) -> Path:
    """Save, picking the format from the extension. Alpha is flattened onto white if needed."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix not in WRITABLE:
        supported = ", ".join(sorted(WRITABLE))
        raise ValueError(
            f"unsupported output format {suffix or '(none)'!r}; use one of {supported}"
        )
    pil = to_pil(image)
    if suffix in NO_ALPHA and image.alpha is not None:
        background = PILImage.new("RGBA", pil.size, "white")
        background.alpha_composite(pil.convert("RGBA"))
        pil = background.convert("L" if image.is_gray else "RGB")
    options: dict[str, Any] = {"quality": 92} if suffix in (".jpg", ".jpeg", ".webp") else {}
    pil.save(path, **options)
    return path


def show_image(image: Image) -> None:
    to_pil(image).show()

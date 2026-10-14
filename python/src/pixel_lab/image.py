"""Images as planes: lists of rows of ints in 0..255, with alpha kept separately."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

Channel = list[list[int]]

ChannelFn = Callable[[Channel], Channel]


@dataclass(frozen=True)
class Image:
    color: list[Channel]
    """One plane for grayscale, three for RGB."""
    alpha: Channel | None = None

    def __post_init__(self) -> None:
        if len(self.color) not in (1, 3):
            raise ValueError(f"expected 1 or 3 color planes, got {len(self.color)}")
        height, width = len(self.color[0]), len(self.color[0][0]) if self.color[0] else 0
        if height == 0 or width == 0:
            raise ValueError("image must be at least 1x1")
        for plane in self.planes:
            if len(plane) != height or any(len(row) != width for row in plane):
                raise ValueError("all planes must have the same dimensions")

    @property
    def height(self) -> int:
        return len(self.color[0])

    @property
    def width(self) -> int:
        return len(self.color[0][0])

    @property
    def is_gray(self) -> bool:
        return len(self.color) == 1

    @property
    def mode(self) -> str:
        """The matching Pillow mode: ``L``, ``LA``, ``RGB`` or ``RGBA``."""
        base = "L" if self.is_gray else "RGB"
        return base + ("A" if self.alpha is not None else "")

    @property
    def planes(self) -> list[Channel]:
        return [*self.color, self.alpha] if self.alpha is not None else list(self.color)

    @staticmethod
    def blank(width: int, height: int, mode: str = "RGB", fill: int = 0) -> Image:
        def plane(value: int) -> Channel:
            return [[value] * width for _ in range(height)]

        color = [plane(fill)] if mode.startswith("L") else [plane(fill) for _ in range(3)]
        alpha = plane(255) if mode.endswith("A") else None
        return Image(color, alpha)


def map_color(image: Image, fn: ChannelFn) -> Image:
    """Apply ``fn`` to every color plane, keeping alpha untouched."""
    return Image([fn(plane) for plane in image.color], image.alpha)


def map_planes(image: Image, fn: ChannelFn) -> Image:
    """Apply ``fn`` to every plane, alpha included (for geometric operations)."""
    alpha = fn(image.alpha) if image.alpha is not None else None
    return Image([fn(plane) for plane in image.color], alpha)

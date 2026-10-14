from __future__ import annotations

from hypothesis import HealthCheck, settings
from hypothesis import strategies as st

from pixel_lab import Image

settings.register_profile(
    "default", max_examples=60, deadline=None, suppress_health_check=[HealthCheck.too_slow]
)
settings.load_profile("default")


@st.composite
def images(
    draw: st.DrawFn, max_side: int = 10, modes: tuple[str, ...] = ("L", "LA", "RGB", "RGBA")
) -> Image:
    width = draw(st.integers(1, max_side))
    height = draw(st.integers(1, max_side))
    mode = draw(st.sampled_from(modes))
    pixel = st.integers(0, 255)

    def plane() -> list[list[int]]:
        return [draw(st.lists(pixel, min_size=width, max_size=width)) for _ in range(height)]

    color = [plane()] if mode.startswith("L") else [plane(), plane(), plane()]
    return Image(color, plane() if mode.endswith("A") else None)


def constant(width: int, height: int, value: int, mode: str = "RGB") -> Image:
    return Image.blank(width, height, mode, value)


def gray(rows: list[list[int]]) -> Image:
    return Image([rows])

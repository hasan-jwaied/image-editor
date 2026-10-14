"""Every operation and its parameters. Exported to spec/operations.json for the web app."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from . import ops
from .image import Image

ParamValue = int | float | str | list[float]


@dataclass(frozen=True)
class Param:
    name: str
    type: str  # "int" | "float" | "enum" | "kernel"
    default: ParamValue
    label: str
    min: float | None = None
    max: float | None = None
    step: float | None = None
    options: tuple[str, ...] = ()
    unit: str | None = None

    def coerce(self, raw: Any) -> ParamValue:
        """Convert ``raw`` (from JSON or a CLI string) and validate it."""
        try:
            if self.type == "int":
                number = float(raw)
                if not number.is_integer():
                    raise ValueError
                value: ParamValue = int(number)
            elif self.type == "float":
                value = float(raw)
            elif self.type == "enum":
                value = str(raw)
                if value not in self.options:
                    raise ValueError
            else:  # kernel
                items = raw.split(",") if isinstance(raw, str) else list(raw)
                value = [float(v) for v in items]
                if len(value) not in (9, 25, 49):
                    raise ValueError
        except (TypeError, ValueError):
            message = f"invalid value for {self.name!r}: {raw!r} ({self._describe()})"
            raise ValueError(message) from None
        if isinstance(value, int | float) and not (
            (self.min is None or value >= self.min) and (self.max is None or value <= self.max)
        ):
            raise ValueError(
                f"{self.name!r} must be between {self.min} and {self.max}, got {value}"
            )
        return value

    def _describe(self) -> str:
        if self.type == "enum":
            return "one of " + ", ".join(self.options)
        if self.type == "kernel":
            return "9, 25 or 49 comma-separated numbers"
        return f"{self.type} in [{self.min}, {self.max}]"

    def to_json(self) -> dict[str, Any]:
        data: dict[str, Any] = {"name": self.name, "type": self.type, "label": self.label}
        data["default"] = self.default
        for key in ("min", "max", "step", "unit"):
            if getattr(self, key) is not None:
                data[key] = getattr(self, key)
        if self.options:
            data["options"] = list(self.options)
        return data


@dataclass(frozen=True)
class Operation:
    id: str
    label: str
    category: str
    summary: str
    complexity: str
    fn: Callable[..., Image]
    params: tuple[Param, ...] = field(default_factory=tuple)

    def resolve(self, raw: Mapping[str, Any] | None = None) -> dict[str, ParamValue]:
        raw = dict(raw or {})
        known = {p.name for p in self.params}
        unknown = sorted(set(raw) - known)
        if unknown:
            hint = ", ".join(sorted(known)) or "none"
            raise ValueError(f"{self.id}: unknown parameter(s) {unknown}; accepted: {hint}")
        return {p.name: p.coerce(raw[p.name]) if p.name in raw else p.default for p in self.params}

    def apply(self, image: Image, raw: Mapping[str, Any] | None = None) -> Image:
        return self.fn(image, **self.resolve(raw))

    def to_json(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "category": self.category,
            "summary": self.summary,
            "complexity": self.complexity,
            "params": [p.to_json() for p in self.params],
        }


CATEGORIES: dict[str, str] = {
    "adjust": "Adjust",
    "transform": "Transform",
    "filter": "Blur & sharpen",
    "edges": "Edges",
    "stylize": "Stylize",
    "content_aware": "Content-aware",
}

_OPERATIONS = [
    # adjust
    Operation("grayscale", "Grayscale", "adjust",
              "Weighted sum of R, G, B by perceived brightness (Rec. 601 luma).",
              "O(N)", ops.grayscale),
    Operation("invert", "Invert", "adjust", "Photographic negative: every value v becomes 255 - v.",
              "O(N)", ops.invert),
    Operation("brightness", "Brightness", "adjust", "Add a constant to every channel.",
              "O(N)", ops.brightness,
              (Param("amount", "int", 30, "Amount", -255, 255, 1),)),
    Operation("contrast", "Contrast", "adjust",
              "Stretch or squeeze values around mid-gray.",
              "O(N)", ops.contrast,
              (Param("amount", "int", 30, "Amount", -100, 100, 1, unit="%"),)),
    Operation("equalize", "Equalize histogram", "adjust",
              "Remap brightness through its cumulative histogram to use the full range.",
              "O(N)", ops.equalize),
    Operation("sepia", "Sepia", "adjust", "A vintage brown tone from a 3x3 color matrix.",
              "O(N)", ops.sepia),
    # transform
    Operation("flip", "Flip", "transform", "Mirror the image.", "O(N)", ops.flip,
              (Param("axis", "enum", "horizontal", "Axis",
                     options=("horizontal", "vertical")),)),
    Operation("rotate", "Rotate", "transform", "Quarter or half turn via transposition.",
              "O(N)", ops.rotate,
              (Param("direction", "enum", "cw", "Direction", options=("cw", "ccw", "180")),)),
    Operation("resize", "Resize", "transform",
              "Bilinear interpolation between the four nearest source pixels.",
              "O(N)", ops.resize,
              (Param("scale", "int", 50, "Scale", 1, 400, 1, unit="%"),)),
    # filter
    Operation("box_blur", "Box blur", "filter",
              "Window mean from a summed-area table: four lookups per pixel at any radius.",
              "O(N)", ops.box_blur,
              (Param("radius", "int", 4, "Radius", 0, 100, 1, unit="px"),)),
    Operation("gaussian_blur", "Gaussian blur", "filter",
              "A 2-D Gaussian split into a horizontal and a vertical 1-D pass.",
              "O(N·σ)", ops.gaussian_blur,
              (Param("sigma", "float", 2.0, "Sigma", 0.3, 25, 0.1, unit="px"),)),
    Operation("sharpen", "Sharpen", "filter",
              "Unsharp mask: add back the detail that a Gaussian blur removes.",
              "O(N·σ)", ops.sharpen,
              (Param("amount", "float", 1.0, "Amount", 0, 5, 0.1),
               Param("sigma", "float", 1.0, "Radius", 0.3, 10, 0.1, unit="px"))),
    Operation("convolve", "Convolution kernel", "filter",
              "Slide a small weight matrix over the image and sum the products.",
              "O(N·k²)", ops.convolve,
              (Param("preset", "enum", "emboss", "Kernel",
                     options=(*ops.KERNEL_PRESETS, "custom")),
               Param("weights", "kernel", [0, 0, 0, 0, 1, 0, 0, 0, 0], "Custom weights"))),
    # edges
    Operation("sobel", "Sobel gradient", "edges",
              "Gradient magnitude from horizontal and vertical derivative kernels.",
              "O(N)", ops.sobel),
    Operation("canny", "Canny edges", "edges",
              "Smooth, take gradients, thin to one-pixel ridges, then link edges with "
              "hysteresis.",
              "O(N·σ)", ops.canny,
              (Param("sigma", "float", 1.4, "Smoothing", 0, 6, 0.1, unit="px"),
               Param("low", "float", 40.0, "Low threshold", 0, 1500, 1),
               Param("high", "float", 100.0, "High threshold", 0, 1500, 1))),
    Operation("adaptive_threshold", "Ink sketch", "edges",
              "Adaptive threshold: black where a pixel is darker than its local mean.",
              "O(N)", ops.adaptive_threshold,
              (Param("blur_radius", "int", 1, "Smoothing", 0, 20, 1, unit="px"),
               Param("block_radius", "int", 8, "Neighborhood", 1, 100, 1, unit="px"),
               Param("offset", "float", 10.0, "Sensitivity", -50, 50, 0.5))),
    # stylize
    Operation("posterize", "Posterize", "stylize",
              "Quantize every channel to a few evenly spaced levels.",
              "O(N)", ops.posterize,
              (Param("levels", "int", 4, "Levels", 2, 64, 1),)),
    Operation("dither", "Dither", "stylize",
              "Floyd-Steinberg: quantize, then diffuse each pixel's error to its neighbors.",
              "O(N)", ops.dither,
              (Param("levels", "int", 2, "Levels per channel", 2, 16, 1),)),
    # content-aware
    Operation("seam_carve", "Seam carving", "content_aware",
              "Shrink by repeatedly removing the lowest-energy path, found by dynamic "
              "programming.",
              "O(N·s)", ops.seam_carve,
              (Param("width_percent", "int", 25, "Narrower by", 0, 60, 1, unit="%"),
               Param("height_percent", "int", 0, "Shorter by", 0, 60, 1, unit="%"))),
]  # fmt: skip

OPERATIONS: dict[str, Operation] = {op.id: op for op in _OPERATIONS}


def get(op_id: str) -> Operation:
    try:
        return OPERATIONS[op_id]
    except KeyError:
        raise ValueError(f"unknown operation {op_id!r}; run 'pixel-lab list' to see them") from None


def spec() -> dict[str, Any]:
    return {
        "version": 1,
        "categories": [{"id": k, "label": v} for k, v in CATEGORIES.items()],
        "operations": [op.to_json() for op in _OPERATIONS],
    }

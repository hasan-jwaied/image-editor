"""Every image operation, as plain functions of ``Image -> Image``."""

from .dither import dither
from .edges import adaptive_threshold, canny, canny_stages, sobel, sobel_gradients
from .filters import (
    KERNEL_PRESETS,
    box_blur,
    box_blur_naive,
    convolve,
    convolve_channel,
    gaussian_blur,
    gaussian_kernel,
    sharpen,
)
from .geometry import flip, resize, resize_to, rotate
from .point import brightness, contrast, grayscale, invert, luma, posterize, sepia
from .seam import energy_map, find_seam, seam_carve
from .tone import equalize, histogram

__all__ = [
    "KERNEL_PRESETS",
    "adaptive_threshold",
    "box_blur",
    "box_blur_naive",
    "brightness",
    "canny",
    "canny_stages",
    "contrast",
    "convolve",
    "convolve_channel",
    "dither",
    "energy_map",
    "equalize",
    "find_seam",
    "flip",
    "gaussian_blur",
    "gaussian_kernel",
    "grayscale",
    "histogram",
    "invert",
    "luma",
    "posterize",
    "resize",
    "resize_to",
    "rotate",
    "seam_carve",
    "sepia",
    "sharpen",
    "sobel",
    "sobel_gradients",
]

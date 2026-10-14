"""Pixel Lab: image processing from first principles, in pure Python.

>>> from pixel_lab import load_image, save_image, ops
>>> img = load_image("photo.jpg")
>>> save_image(ops.canny(img, sigma=1.4, low=40, high=100), "edges.png")
"""

from . import ops
from .image import Channel, Image
from .io import load_image, save_image
from .recipe import Step, parse_step, run

__version__ = "2.0.0"

__all__ = ["Channel", "Image", "Step", "load_image", "ops", "parse_step", "run", "save_image"]

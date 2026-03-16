"""
=============================================================================
Image Processing CLI Tool
=============================================================================
Author: [hasan-jwaied]
Date: [16/03/2026]
Version: 1.0.0

A robust, dependency-free image processing engine built entirely from scratch 
in pure Python. This project demonstrates core computer science and electrical 
engineering principles, focusing on raw algorithmic efficiency rather than 
relying on external black-box libraries (like OpenCV or NumPy).

Key Optimizations:
- O(1) Adaptive Edge Detection via Summed Area Tables (Integral Images)
- O(1) Pixel mapping via pre-computed Look-Up Tables (LUTs)
- Boundary-free matrix convolutions via Clamp-to-Edge Padding
- C-level execution speeds utilizing nested list comprehensions

Usage: python3 image_editor.py <image_path>
=============================================================================
"""

from image_helper import *
from typing import List
import sys, math

def separate_channels(image: ColoredImage) -> List[SingleChannelImage]:
    """
    Separates color channels of a color image.
    :param image: a 3D list representing a color image (rows x columns x channels).
    :return: a 3D list with dimensions (channels x rows x columns),
    where each channel is a two-dimensional image representing a color channel.
    """
    separated_channels = list()
    channels = len(image[0][0]) # Number of color channels (e.g., 3 for RGB)

    # Extract each channel into its own 2D image
    for channels_index in range(channels):
        channel_image = [[pixel[channels_index] for pixel in row] for row in image]
        separated_channels.append(channel_image)
    return separated_channels

def combine_channels(channels: List[SingleChannelImage]) -> ColoredImage:
    """
    Combines individual color channels into a single image.
    Optimized with nested list comprehensions.
    """
    num_rows, num_cols, num_channels = len(channels[0]), len(channels[0][0]), len(channels)
    
    return [
        [
            [channels[c][row][col] for c in range(num_channels)] 
            for col in range(num_cols)
        ]
        for row in range(num_rows)
    ]

def RGB2grayscale(colored_image: ColoredImage) -> SingleChannelImage:
    """
    Converts a colored image (RGB) to a grayscale image.
    :param colored_image: A three-dimensional list representing a colored image.
    :return: A two-dimensional list representing a black-and-white image.
    """
    return [[round(p[0]*0.299 + p[1]*0.587 + p[2]*0.114) for p in row] for row in colored_image]

def blur_kernel(size: int) -> Kernel:
    """
    Generates a blur kernel of (1/size**2) as a list of lists.
    :param size: An integer representing the size of the kernel.
    :return: A division kernel for blurring.
    """
    KERNEL_CONSTANT = 1 / (math.pow(size, 2))
    return [[KERNEL_CONSTANT] * size for _ in range(size)]

def pad_image(image: SingleChannelImage, pad_size: int) -> SingleChannelImage:
    """Helper function to pad an image by repeating the edge pixels (clamp-to-edge)."""
    padded = []
    # Top padding
    for _ in range(pad_size):
        padded.append([image[0][0]] * pad_size + image[0] + [image[0][-1]] * pad_size)
        
    # Middle rows
    for row in image:
        padded.append([row[0]] * pad_size + row + [row[-1]] * pad_size)
        
    # Bottom padding
    for _ in range(pad_size):
        padded.append([image[-1][0]] * pad_size + image[-1] + [image[-1][-1]] * pad_size)
        
    return padded

def apply_kernel(image: SingleChannelImage, kernel: Kernel) -> SingleChannelImage:
    """Optimized convolution without inner bounds checking."""
    height, width = len(image), len(image[0])
    kernel_size = len(kernel)
    pad_size = kernel_size // 2
    
    # 1. Pad the image once
    padded_img = pad_image(image, pad_size)
    result = [[0] * width for _ in range(height)]
    
    # 2. Convolve without if/else statements
    for r in range(height):
        for c in range(width):
            the_sum = 0.0
            
            for kr in range(kernel_size):
                for kc in range(kernel_size):
                    # Direct mapping to the padded image
                    the_sum += padded_img[r + kr][c + kc] * kernel[kr][kc]
            
            result[r][c] = min(255, max(0, round(the_sum)))
            
    return result

def bilinear_interpolation(image: SingleChannelImage, y: float, x: float) -> int:
    """
    Performs bilinear-interpolation to get the pixel value at given coordinates.
    :param image: A 2D list representing a single-color channel image.
    :param y: The y-coordinate (row) in the image.
    :param x: The x-coordinate (column) in the image.
    :return: The interpolated pixel value.
    """
    height, width = len(image), len(image[0])

    # Indices of 4 nearest pixels in the source image.
    top_left_y, top_left_x = int(y), int(x)
    bottom_right_y, bottom_right_x = min(top_left_y + 1, height - 1), min(top_left_x + 1, width - 1)

    # Bilinear interpolation values
    delta_y, delta_x = (y - top_left_y), (x - top_left_x)
    A = image[top_left_y][top_left_x]
    B = image[bottom_right_y][top_left_x]
    C = image[top_left_y][bottom_right_x]
    D = image[bottom_right_y][bottom_right_x]

    # Bilinear interpolation FORMULA
    interpolated_value = round(A * (1 - delta_x) * (1 - delta_y) + 
                               B * delta_y * (1 - delta_x) + 
                               C * delta_x * (1 - delta_y) +
                               D * delta_x * delta_y)
    
    # To ensure we got a valid value (0 - 255 (included))
    interpolated_value = min(255, max(interpolated_value, 0))
    return interpolated_value

def resize(image: SingleChannelImage, new_height: int, new_width: int) -> SingleChannelImage:
    """
    Resizes the input image to the specified height and width using bilinear interpolation.
    Args:
    - image: A 2D list representing the input image.
    - new_height: The desired height of the resized image.
    - new_width: The desired width of the resized image.
    Returns:
    - A 2D list representing the resized image.
    """
    # Get the dimensions of the original image
    previous_height, previous_width = len(image), len(image[0])
    result_img = [[0] * new_width for _ in range(new_height)]

    # Loop through every pixel in the new image
    for y in range(new_height):
        for x in range(new_width):

            # Calculate the corresponding position in the source image
            source_y = (y / (new_height - 1)) * (previous_height - 1)
            source_x = (x / (new_width - 1)) * (previous_width - 1)

            # Perform bilinear interpolation to get the pixel value at the mapped position
            result_img[y][x] = bilinear_interpolation(image, source_y, source_x)
    
    return result_img

def rotate_90(image: Image, direction: str):
    """
    Rotates the image by 90 degrees to the right ('R') or left ('L').
    :param image: The input image (colored or single-channel).
    :param direction: The rotation direction, either 'R' or 'L'.
    :return: The rotated image.
    """
    # Rotate to the right:
    if direction == "R":
        # 1. Reverse the order of rows in the original image.
        # 2. Use the zip function to transpose rows and columns.
        # 3. Convert each transposed row to a list.
        return [list(row) for row in zip(*reversed(image))]

    # Rotate to the left:
    elif direction == "L":
        # 1. Use the zip function to transpose rows and columns.
        # 2. Reverse the order of rows in the transposed image.
        # 3. Convert each reversed row to a list.
        return [list(row) for row in reversed(list(zip(*image)))]

def compute_integral_image(image: SingleChannelImage) -> List[List[int]]:
    """Builds a Summed Area Table with an extra zero-padded row/col for easy boundary math."""
    height, width = len(image), len(image[0])
    # Add an extra row and column of zeros to avoid index out-of-bounds on the top/left edges
    integral = [[0] * (width + 1) for _ in range(height + 1)]
    
    for r in range(1, height + 1):
        for c in range(1, width + 1):
            integral[r][c] = (image[r-1][c-1] 
                              + integral[r-1][c] 
                              + integral[r][c-1] 
                              - integral[r-1][c-1])
    return integral

def get_edges(image: SingleChannelImage, blur_size: int, block_size: int, c: float) -> SingleChannelImage:
    """Optimized adaptive thresholding using an Integral Image."""
    blurred_image = apply_kernel(image, blur_kernel(blur_size))
    
    height, width = len(image), len(image[0])
    # 1. Compute the integral image ONCE
    integral_img = compute_integral_image(blurred_image)
    
    result = [[0] * width for _ in range(height)]
    half_block = block_size // 2
    
    for row in range(height):
        for col in range(width):
            # Block boundaries (exclusive upper bounds to match integral matrix shift)
            r_min = max(0, row - half_block)
            c_min = max(0, col - half_block)
            r_max = min(height, row + half_block + 1)
            c_max = min(width, col + half_block + 1)
            
            # 2. Calculate the block sum in exactly 4 operations! O(1)
            local_sum = (integral_img[r_max][c_max] 
                         - integral_img[r_min][c_max] 
                         - integral_img[r_max][c_min] 
                         + integral_img[r_min][c_min])
            
            pixels_num = (r_max - r_min) * (c_max - c_min)
            local_mean = local_sum / pixels_num
            
            # Apply the adaptive threshold
            result[row][col] = 0 if blurred_image[row][col] < local_mean - c else 255
            
    return result

def quantize(image: SingleChannelImage, N:int) -> SingleChannelImage:
    """
    Quantizes the pixel values of a single-channel image into a specified number of levels.
    :param image: A single-channel image represented as a 2D list of pixel values (0-255).
    :param num_levels: The number of quantization levels (N).
    :return: A quantized version of the image with pixel values mapped to the nearest quantization level.
    """
    # 1. Pre-calculate the mapping for all 256 possible pixel values
    multiplier = 255 / (N - 1)
    lut = [round(math.floor((p * N / 256)) * multiplier) for p in range(256)]
    
    # 2. Map the image pixels to the LUT using a list comprehension
    return [[lut[pixel] for pixel in row] for row in image]

def sharpen_kernel() -> Kernel:
    """Generates a sharpening kernel."""
    return [[ 0, -1,  0],
            [-1,  5, -1],
            [ 0, -1,  0]]
    
def emboss_kernel() -> Kernel:
    """Generates an emboss (3D shadow) kernel."""
    return [[-2, -1, 0],
            [-1,  1, 1],
            [ 0,  1, 2]]
    
def apply_sepia(colored_image: ColoredImage) -> ColoredImage:
    """Applies a vintage sepia tone filter to an RGB image."""
    sepia_img = []
    for row in colored_image:
        new_row = []
        for p in row:
            r, g, b = p[0], p[1], p[2]
            # Standard sepia matrix formulas, capped at 255
            new_r = min(255, round((r * 0.393) + (g * 0.769) + (b * 0.189)))
            new_g = min(255, round((r * 0.349) + (g * 0.686) + (b * 0.168)))
            new_b = min(255, round((r * 0.272) + (g * 0.534) + (b * 0.131)))
            new_row.append([new_r, new_g, new_b])
        sepia_img.append(new_row)
    return sepia_img

def invert_colors(image: SingleChannelImage) -> SingleChannelImage:
    """Inverts the colors of a single channel (creates a negative)."""
    return [[255 - pixel for pixel in row] for row in image]

def adjust_brightness(image: SingleChannelImage, factor: int) -> SingleChannelImage:
    """Adjusts the brightness of a single channel by a given factor."""
    return [[min(255, max(0, pixel + factor)) for pixel in row] for row in image]

def flip_image(image: Image, direction: str):
    """
    Flips the image horizontally ('H') or vertically ('V').
    Because of Python's list slicing, this automatically supports 
    both single-channel and full RGB colored images!
    """
    if direction == "H":
        # Reverses the pixels in every single row
        return [row[::-1] for row in image]
    elif direction == "V":
        # Reverses the order of the rows themselves
        return image[::-1]
    return image

##############################################################################
def main():
    """
    The main function to run our program
    """
    # Check if a valid image path is provided as an argument
    if len(sys.argv) != 2:
        print("To run your code: python3 image_editor.py <image_path>")
        return
    
    image_path = sys.argv[1]
    
    try:
        image = load_image(image_path)
    except FileNotFoundError:
        print(f"Error, File not found at: {image_path}")
        return
    except Exception as exc:
        print(f"Unexpected Error occured:, {exc}")
        return
    
    # Display a menu of operations and handle user's input
    while True:
        print("====================================================")
        print("Please choose a NUMBER for an operation to perform:\n")
        print("- [1] Convert your image to grayscale.")
        print("- [2] Blur your image.")
        print("- [3] Resize your image.")
        print("- [4] Rotate your image.")
        print("- [5] Detect edges in your image.")
        print("- [6] Quantize your image.")
        print("- [7] Sharpen your image.")
        print("- [8] Emboss your image.")
        print("- [9] Apply Sepia filter.")
        print("- [10] Invert colors.")
        print("- [11] Adjust brightness.")
        print("- [12] Flip your image.")
        print("- [13] Show your image.")
        print("- [14] Save and exit.")
        print("- [15] Exit without saving.")
        print("====================================================")

        try:
            user_input = int(input("Enter your choice [1 - 15]: "))
        except ValueError:
            print("Invalid input, please enter a number between 1 and 15.")
            continue

        if user_input == 1:
            # Convert image to grayscale if not already in grayscale
            if isinstance(image[0][0], int):
                print("The image is already in grayscale.")
            else:
                image = RGB2grayscale(image)
                print("Image converted to grayscale.")

        elif user_input == 2:
            # Blur the image using a kernel
            try:
                kernel_size = int(input("Enter the size of the blur kernel (positive and odd number (like 5), it may take some time): "))
                if kernel_size % 2 == 0 or kernel_size < 1:
                    raise ValueError("Kernel size must be a positive odd number!")

                # Apply the kernel to each channel if it's a color image
                kernel = blur_kernel(kernel_size)
                if isinstance(image[0][0], list):  # if image RGB
                    channels = separate_channels(image)
                    blurred_channels = [apply_kernel(channel, kernel) for channel in channels]
                    image = combine_channels(blurred_channels)
                else:
                    image = apply_kernel(image, kernel)
                print(f"Image blurred with kernel size {kernel_size}.")
            except ValueError as exc:
                print(f"Error: {exc}")

        elif user_input == 3:
            # Resize the image
            try:
                new_size = input("Enter new height and width SEPARATED by a comma (e.g., 150,150): ")
                
                # Validate input format
                if not new_size or "," not in new_size:
                    raise ValueError("Invalid format. please enter values separated by comma (e.g. 150,150) ")
                
                new_height, new_width = map(int, new_size.split(","))
                
                # Validate the height and width
                if new_height <= 1 or new_width <= 1:
                    raise ValueError("Height and width must be greater than 1!")
                
                # Resize each channel separately if it's a color image
                if isinstance(image[0][0], list):  # if image RGB
                    channels = separate_channels(image)
                    resized_channels = [resize(channel, new_height, new_width) for channel in channels]
                    image = combine_channels(resized_channels)
                else:
                    image = resize(image, new_height, new_width)
                print(f"Image resized to {new_height}x{new_width}.")
            
            except ValueError as ve:
                print(f"Invalid input. {ve}")
            except IndexError:
                print(f"Invalid input, please provide two positive integers separated by comma.")
            except Exception as exc:
                print(f"Unexpected error: {exc}")
                
        elif user_input == 4:
            # Rotate the image by 90 degrees
            direction = input("Enter the direction ('R' for right or 'L' for left): ")
            if direction not in ["R", "L"]:
                print("Invalid direction. Please enter 'R' for right or 'L' for left.")
            else:
                image = rotate_90(image, direction)
                print(f"Image rotated 90 degrees for the {direction}.")

        elif user_input == 5:
            # Detect edges in the image
            try:
                params = input("Enter the parameters (blur_size, block_size, c) separated by a comma (e.g., 11,21,2.0): ")
                
                # Check if the parameters are correctly formatted (no spaces, separated by commas)
                if not params or "," not in params or " " in params:
                    raise ValueError("Invalid format. Please enter values separated by commas with no spaces.")
                
                # split and parse inputs:
                values = params.split(",")
                
                # Check if exactly three values are provided
                if len(values) != 3:
                    raise ValueError("You must provide exactly three values: blur_size: int, block_size: int, and c:abs(int).")

                # Validate the first two values as positive odd integers
                blur_size, block_size = map(int, values[:2])
                if (blur_size < 1 or blur_size % 2 == 0) or (block_size < 1 or block_size % 2 == 0):
                    raise ValueError("blur_size and block_size must be positive odd integers.") 
                
                # Validate the third value as a positive float
                try:
                    c = float(values[2])
                    if c < 0:
                        raise ValueError("The third value must be a non-negative float.")
                except ValueError:
                    raise ValueError("The third value must be a valid positive float")

                # If the image is RGB, convert to grayscale
                if isinstance(image[0][0], list):
                    image = RGB2grayscale(image)

                # Apply edge detection
                image = get_edges(image, blur_size, block_size, c)
                print("Edges detected.")
                
            except ValueError as exc:
                print(f"Input Error: {exc}")
            except Exception as exc:
                print(f"Unexpected error: {exc}")

        elif user_input == 6:
            # Quantize the image to a specific number of levels
            try:
                num_levels = int(input("Enter the number of tunes (positive integer greater than 1): "))
                if num_levels <= 1:
                    raise ValueError("Number of levels must be greater than 1!")
                if isinstance(image[0][0], list):
                    channels = separate_channels(image)
                    quantized_channels = [quantize(channel, num_levels) for channel in channels]
                    image = combine_channels(quantized_channels)
                else:
                    image = quantize(image, num_levels)
                print(f"Image quantized to {num_levels} num_levels.")
            except ValueError:
                print("Invalid input. Please enter a positive integer greater than 1.")

        elif user_input == 7:
            # Sharpen the image using a kernel
            kernel = sharpen_kernel()
            if isinstance(image[0][0], list):
                channels = separate_channels(image)
                sharpened = [apply_kernel(c, kernel) for c in channels]
                image = combine_channels(sharpened)
            else:
                image = apply_kernel(image, kernel)
            print("Image sharpened.")

        elif user_input == 8:
            # Emboss the image using a kernel
            kernel = emboss_kernel()
            if isinstance(image[0][0], list):
                channels = separate_channels(image)
                embossed = [apply_kernel(c, kernel) for c in channels]
                image = combine_channels(embossed)
            else:
                image = apply_kernel(image, kernel)
            print("Emboss filter applied.")

        elif user_input == 9:
            # Apply Sepia (Requires color image)
            if isinstance(image[0][0], list):
                image = apply_sepia(image)
                print("Sepia filter applied.")
            else:
                print("Error: Sepia filter can only be applied to color images.")

        elif user_input == 10:
            # Invert colors
            if isinstance(image[0][0], list):
                channels = separate_channels(image)
                inverted = [invert_colors(c) for c in channels]
                image = combine_channels(inverted)
            else:
                image = invert_colors(image)
            print("Colors inverted.")

        elif user_input == 11:
            # Adjust Brightness
            try:
                factor = int(input("Enter brightness factor (e.g., 50 to brighten, -50 to darken): "))
                if isinstance(image[0][0], list):
                    channels = separate_channels(image)
                    adjusted = [adjust_brightness(c, factor) for c in channels]
                    image = combine_channels(adjusted)
                else:
                    image = adjust_brightness(image, factor)
                print(f"Brightness adjusted by {factor}.")
            except ValueError:
                print("Invalid input. Please enter an integer.")

        elif user_input == 12:
            # Flip the image
            direction = input("Enter direction ('H' for horizontal, 'V' for vertical): ").strip().upper()
            if direction in ["H", "V"]:
                image = flip_image(image, direction)
                print(f"Image flipped {'horizontally' if direction == 'H' else 'vertically'}.")
            else:
                print("Invalid direction. Please enter 'H' or 'V'.")

        elif user_input == 13:
            show_image(image)

        elif user_input == 14:
            # Save the image to a specified path and exit the program
            save_path = input("Give it a new name such as output.png: ").strip()
            save_image(image, save_path)
            print(f"Image saved to {save_path}. Exiting program.")
            break

        elif user_input == 15:
            print("Exiting without saving. Goodbye!")
            break
        
        else:
            print("Invalid choice. Please enter an integer between 1 and 15.")
##############################################################################
if __name__ == '__main__':
    main()
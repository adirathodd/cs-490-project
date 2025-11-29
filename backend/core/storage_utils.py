"""
Local file storage utilities for profile picture uploads.
Uses Django's media storage - free and simple for development/MVP.
Can be easily swapped for cloud storage (Cloudinary, AWS S3) later.
"""
import os
import logging
import io
from typing import Optional, Tuple
from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings

logger = logging.getLogger(__name__)

# Image processing settings
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB in bytes
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'GIF'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}
PROFILE_PICTURE_SIZE = (400, 400)  # Standard size for profile pictures


def validate_image_file(file_obj, max_size: int = MAX_IMAGE_SIZE) -> Tuple[bool, Optional[str]]:
    """
    Validate uploaded image file.
    
    Args:
        file_obj: Uploaded file object
        max_size: Maximum file size in bytes
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check file size
    if hasattr(file_obj, 'size') and file_obj.size > max_size:
        size_mb = max_size / (1024 * 1024)
        return False, f"File size exceeds maximum allowed size of {size_mb}MB"
    
    # Check file extension
    file_ext = os.path.splitext(file_obj.name)[1].lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        return False, f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
    
    # Try to open and verify it's a valid image
    try:
        img = Image.open(file_obj)
        img.verify()
        
        # Check image format
        if img.format not in ALLOWED_IMAGE_FORMATS:
            return False, f"Invalid image format. Allowed formats: {', '.join(ALLOWED_IMAGE_FORMATS)}"
        
        # Reset file pointer after verify
        file_obj.seek(0)
        
        return True, None
    except Exception as e:
        logger.error(f"Image validation failed: {e}")
        return False, "Invalid or corrupted image file"


def resize_image(image: Image.Image, size: Tuple[int, int]) -> Image.Image:
    """
    Resize image to specified dimensions while maintaining aspect ratio.
    
    Args:
        image: PIL Image object
        size: Target size as (width, height)
        
    Returns:
        Resized PIL Image
    """
    # Convert RGBA to RGB if needed (for JPEG compatibility)
    if image.mode in ('RGBA', 'LA', 'P'):
        # Create a white background
        background = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode == 'P':
            image = image.convert('RGBA')
        background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
        image = background
    
    # Calculate aspect ratio and resize
    image.thumbnail(size, Image.Resampling.LANCZOS)
    
    # Create a new image with the target size and paste the resized image centered
    new_img = Image.new('RGB', size, (255, 255, 255))
    
    # Calculate position to paste (center)
    paste_x = (size[0] - image.width) // 2
    paste_y = (size[1] - image.height) // 2
    
    new_img.paste(image, (paste_x, paste_y))
    
    return new_img


def process_profile_picture(file_obj) -> Tuple[Optional[ContentFile], Optional[str]]:
    """
    Process uploaded profile picture: validate, resize, and optimize.
    
    Args:
        file_obj: Uploaded file object
        
    Returns:
        Tuple of (processed_file, error_message)
    """
    # Validate image
    is_valid, error_msg = validate_image_file(file_obj)
    if not is_valid:
        return None, error_msg
    
    try:
        # Open image
        img = Image.open(file_obj)
        
        # Get original format
        original_format = img.format
        
        # Resize image
        resized_img = resize_image(img, PROFILE_PICTURE_SIZE)
        
        # Save to bytes buffer
        output = io.BytesIO()
        
        # Save as JPEG with good quality (better compression than PNG for photos)
        resized_img.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)
        
        # Create Django ContentFile
        file_name = f"{os.path.splitext(file_obj.name)[0]}.jpg"
        processed_file = ContentFile(output.read(), name=file_name)
        
        return processed_file, None
    
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        return None, f"Failed to process image: {str(e)}"


def delete_old_picture(file_path: str) -> bool:
    """
    Delete old profile picture file.
    
    Args:
        file_path: Path to file in media storage
        
    Returns:
        True if deleted or didn't exist, False on error
    """
    if not file_path:
        return True
    
    try:
        if default_storage.exists(file_path):
            default_storage.delete(file_path)
            logger.info(f"Deleted old profile picture: {file_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete old profile picture: {e}")
        return False


def get_default_avatar_url() -> str:
    """
    Get URL for default avatar image.
    
    Returns:
        URL to default avatar
    """
    # You can return a URL to a default avatar image or a data URI
    # For now, return empty string and handle on frontend
    return ""


"""
File storage utilities for profile picture uploads and document handling.
Supports both local storage (development) and Cloudinary (production).
Uses Django's default_storage which automatically switches based on settings.
"""
import os
import logging
import io
import requests
from typing import Optional, Tuple, BinaryIO, Union
from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.http import HttpResponse, FileResponse

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


def is_cloudinary_storage() -> bool:
    """
    Check if we're using Cloudinary storage.
    
    Returns:
        True if Cloudinary is configured as default storage
    """
    return hasattr(default_storage, 'cloudinary') or \
           'cloudinary' in str(type(default_storage)).lower() or \
           getattr(settings, 'DEFAULT_FILE_STORAGE', '').startswith('cloudinary')


def is_cloudinary_url(url: str) -> bool:
    """
    Check if a URL is a Cloudinary URL.
    
    Args:
        url: The URL to check
        
    Returns:
        True if the URL is a Cloudinary URL
    """
    if not url:
        return False
    return 'cloudinary.com' in url or 'res.cloudinary.com' in url


def get_file_url(file_field) -> Optional[str]:
    """
    Get the URL for a file field, handling both local and Cloudinary storage.
    
    Args:
        file_field: Django FileField or ImageField
        
    Returns:
        URL string or None if no file
    """
    if not file_field:
        return None
    try:
        return file_field.url
    except Exception as e:
        logger.error(f"Failed to get file URL: {e}")
        return None


def file_exists(file_field) -> bool:
    """
    Check if a file exists, handling both local and Cloudinary storage.
    
    Args:
        file_field: Django FileField or ImageField
        
    Returns:
        True if file exists
    """
    if not file_field:
        return False
    
    try:
        file_name = file_field.name
        if not file_name:
            return False
        
        # For Cloudinary, check if we can get the URL
        if is_cloudinary_storage():
            try:
                url = file_field.url
                return bool(url)
            except Exception:
                return False
        
        # For local storage, use default_storage.exists
        return default_storage.exists(file_name)
    except Exception as e:
        logger.error(f"Failed to check file existence: {e}")
        return False


def download_file_response(file_field, filename: Optional[str] = None, as_attachment: bool = True) -> HttpResponse:
    """
    Create an HTTP response for downloading a file, handling both local and Cloudinary storage.
    
    Args:
        file_field: Django FileField or ImageField
        filename: Optional filename for the download (defaults to original name)
        as_attachment: If True, sets Content-Disposition to attachment (download); otherwise inline (view)
        
    Returns:
        HttpResponse with the file content
    """
    if not file_field:
        from rest_framework.response import Response
        from rest_framework import status
        return Response(
            {'error': {'code': 'no_file', 'message': 'No file attached'}},
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        file_url = file_field.url
        file_name = filename or os.path.basename(file_field.name)
        
        # Determine content type
        content_type = _guess_content_type(file_name)
        disposition = 'attachment' if as_attachment else 'inline'
        
        # Check if file is stored in Cloudinary (remote URL)
        if is_cloudinary_url(file_url):
            # Fetch file from Cloudinary URL
            try:
                response = requests.get(file_url, stream=True, timeout=30)
                response.raise_for_status()
                
                # Use content-type from Cloudinary response if available
                if 'content-type' in response.headers:
                    content_type = response.headers['content-type']
                
                http_response = HttpResponse(
                    response.content,
                    content_type=content_type
                )
                http_response['Content-Disposition'] = f'{disposition}; filename="{file_name}"'
                return http_response
                
            except requests.RequestException as e:
                logger.error(f"Failed to fetch file from Cloudinary: {e}")
                from rest_framework.response import Response
                from rest_framework import status
                return Response(
                    {'error': {'code': 'fetch_failed', 'message': 'Failed to retrieve file from storage'}},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Local file - check if path exists
        try:
            file_path = file_field.path
            if os.path.exists(file_path):
                return FileResponse(
                    open(file_path, 'rb'),
                    content_type=content_type,
                    as_attachment=as_attachment,
                    filename=file_name
                )
        except (NotImplementedError, AttributeError):
            # .path not available for cloud storage, try opening through storage
            pass
        
        # Try to open through default storage
        try:
            file_obj = default_storage.open(file_field.name, 'rb')
            content = file_obj.read()
            file_obj.close()
            
            http_response = HttpResponse(content, content_type=content_type)
            http_response['Content-Disposition'] = f'{disposition}; filename="{file_name}"'
            return http_response
            
        except Exception as e:
            logger.error(f"Failed to open file from storage: {e}")
            from rest_framework.response import Response
            from rest_framework import status
            return Response(
                {'error': {'code': 'file_not_found', 'message': 'File not found on server'}},
                status=status.HTTP_404_NOT_FOUND
            )
    
    except Exception as e:
        logger.error(f"Error in download_file_response: {e}")
        from rest_framework.response import Response
        from rest_framework import status
        return Response(
            {'error': {'code': 'internal_error', 'message': 'Failed to download file'}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _guess_content_type(filename: str) -> str:
    """
    Guess the content type based on file extension.
    
    Args:
        filename: The filename to check
        
    Returns:
        MIME type string
    """
    ext = os.path.splitext(filename.lower())[1]
    content_types = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.txt': 'text/plain',
        '.html': 'text/html',
    }
    return content_types.get(ext, 'application/octet-stream')


def delete_file(file_field) -> bool:
    """
    Delete a file from storage, handling both local and Cloudinary storage.
    
    Args:
        file_field: Django FileField or ImageField
        
    Returns:
        True if deleted successfully or file didn't exist
    """
    if not file_field:
        return True
    
    try:
        file_name = file_field.name
        if not file_name:
            return True
        
        # For Cloudinary, django-cloudinary-storage handles deletion automatically
        # when the model instance is deleted or the file field is cleared
        if is_cloudinary_storage():
            try:
                # Cloudinary storage may require explicit delete
                default_storage.delete(file_name)
                logger.info(f"Deleted file from Cloudinary: {file_name}")
            except Exception as e:
                logger.warning(f"Failed to delete from Cloudinary (may already be deleted): {e}")
            return True
        
        # Local storage
        if default_storage.exists(file_name):
            default_storage.delete(file_name)
            logger.info(f"Deleted local file: {file_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        return False


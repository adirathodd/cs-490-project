"""
Custom exception handlers for consistent API error responses.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error response format.
    
    Returns:
        Response with format:
        {
            "error": {
                "code": "error_code",
                "message": "User-friendly error message",
                "details": {...}  # Optional field-specific errors
            }
        }
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Customize the response format
        custom_response_data = {
            'error': {
                'code': get_error_code(exc, response.status_code),
                'message': get_error_message(exc, response.data),
            }
        }
        
        # Add field-specific errors if available
        if isinstance(response.data, dict):
            details = {}
            for field, errors in response.data.items():
                if isinstance(errors, list):
                    details[field] = errors[0] if errors else 'Invalid value'
                else:
                    details[field] = str(errors)
            
            if details:
                custom_response_data['error']['details'] = details
        
        response.data = custom_response_data
    else:
        # Log unhandled exceptions
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        
        # Return generic 500 error
        response = Response(
            {
                'error': {
                    'code': 'internal_server_error',
                    'message': 'An unexpected error occurred. Please try again later.',
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response


def get_error_code(exc, status_code):
    """Generate error code from exception."""
    if hasattr(exc, 'default_code'):
        return exc.default_code
    
    code_map = {
        400: 'bad_request',
        401: 'unauthorized',
        403: 'forbidden',
        404: 'not_found',
        405: 'method_not_allowed',
        409: 'conflict',
        422: 'validation_error',
        429: 'too_many_requests',
        500: 'internal_server_error',
    }
    
    return code_map.get(status_code, 'error')


def get_error_message(exc, response_data):
    """Extract user-friendly error message."""
    if hasattr(exc, 'detail'):
        detail = exc.detail
        if isinstance(detail, dict):
            # Return first error message from dict
            for value in detail.values():
                if isinstance(value, list) and value:
                    return str(value[0])
                return str(value)
        return str(detail)
    
    if isinstance(response_data, dict):
        # Try to extract message from response data
        if 'detail' in response_data:
            return str(response_data['detail'])
        
        # Get first error from any field
        for value in response_data.values():
            if isinstance(value, list) and value:
                return str(value[0])
            return str(value)
    
    return 'An error occurred'

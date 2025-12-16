"""
Custom exception handlers for consistent API error responses.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status, exceptions as drf_exceptions
import logging

logger = logging.getLogger(__name__)


def _collect_messages_from_response_data(response_data):
    """Build a list of human-readable messages from DRF error response data."""
    messages = []
    try:
        if isinstance(response_data, dict):
            # DRF often returns {'field': ['msg']} or {'detail': 'msg'}
            if 'detail' in response_data and not isinstance(response_data.get('detail'), (dict, list)):
                messages.append(str(response_data['detail']))
            for field, value in response_data.items():
                if field == 'detail':
                    continue
                if isinstance(value, (list, tuple)) and value:
                    msg = str(value[0])
                else:
                    msg = str(value)
                field_label = str(field).replace('_', ' ').capitalize()
                messages.append(f"{field_label}: {msg}")
        elif isinstance(response_data, (list, tuple)):
            for v in response_data:
                if v:
                    messages.append(str(v))
        elif response_data:
            messages.append(str(response_data))
    except Exception:
        pass
    return messages


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
    # Log exception type and context for easier debugging of converted 404/403 errors
    try:
        logger.debug(f"custom_exception_handler invoked: exc={exc!r}, context_keys={list(context.keys()) if isinstance(context, dict) else context}")
    except Exception:
        pass
    try:
        import traceback as _tb
        tb = ''.join(_tb.format_tb(exc.__traceback__)) if getattr(exc, '__traceback__', None) else ''
        if tb:
            logger.debug(f"Exception traceback:\n{tb}")
    except Exception:
        pass

    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Ensure auth failures consistently return 401 so clients can re-auth.
        if isinstance(exc, (drf_exceptions.NotAuthenticated, drf_exceptions.AuthenticationFailed)):
            response.status_code = status.HTTP_401_UNAUTHORIZED

        # Customize the response format
        messages = _collect_messages_from_response_data(response.data)
        custom_response_data = {
            'error': {
                'code': get_error_code(exc, response.status_code),
                'message': (messages[0] if messages else get_error_message(exc, response.data)),
            }
        }
        if messages:
            custom_response_data['error']['messages'] = messages
        
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

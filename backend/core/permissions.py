from rest_framework import permissions

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow owners of a profile or admin users to view/edit it.
    """
    
    def has_object_permission(self, request, view, obj):
        # Always allow admin users
        if request.user.is_staff or request.user.is_superuser:
            return True
            
        # Check if the object has a user field and if it matches the request user
        if hasattr(obj, 'user'):
            return obj.user == request.user
            
        # For user objects, check if the object is the request user
        return obj == request.user
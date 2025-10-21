"""
Serializers for authentication and user management.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from core.models import CandidateProfile
import re

User = get_user_model()


class UserRegistrationSerializer(serializers.Serializer):
    """
    Serializer for UC-001: User Registration with Email.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)
    first_name = serializers.CharField(required=True, max_length=150)
    last_name = serializers.CharField(required=True, max_length=150)
    
    def validate_email(self, value):
        """Validate email format."""
        # Additional email validation
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            raise serializers.ValidationError("Please enter a valid email address.")
        
        return value.lower()
    
    def validate_password(self, value):
        """
        Validate password meets requirements:
        - Minimum 8 characters
        - At least 1 uppercase letter
        - At least 1 lowercase letter
        - At least 1 number
        """
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError("Password must contain at least one uppercase letter.")
        
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError("Password must contain at least one lowercase letter.")
        
        if not re.search(r'\d', value):
            raise serializers.ValidationError("Password must contain at least one number.")
        
        # Use Django's built-in password validators
        validate_password(value)
        
        return value
    
    def validate(self, data):
        """Validate that passwords match."""
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': "Passwords do not match."
            })
        return data
    
    def create(self, validated_data):
        """This will be handled by the view using Firebase."""
        pass


class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for UC-002: User Login with Email and Password.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    
    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.lower()


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile information.
    """
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', max_length=150)
    last_name = serializers.CharField(source='user.last_name', max_length=150)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CandidateProfile
        fields = [
            'email', 'first_name', 'last_name', 'full_name',
            'headline', 'location', 'summary', 'years_experience',
            'preferred_roles', 'portfolio_url', 'visibility'
        ]
    
    def get_full_name(self, obj):
        """Get user's full name."""
        return f"{obj.user.first_name} {obj.user.last_name}".strip()
    
    def update(self, instance, validated_data):
        """Update user and profile information."""
        user_data = validated_data.pop('user', {})
        
        # Update user fields
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save()
        
        # Update profile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        return instance


class UserSerializer(serializers.ModelSerializer):
    """
    Basic user serializer for user information.
    """
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'date_joined']
        read_only_fields = ['id', 'email', 'date_joined']
    
    def get_full_name(self, obj):
        """Get user's full name."""
        return f"{obj.first_name} {obj.last_name}".strip()


class FirebaseTokenSerializer(serializers.Serializer):
    """
    Serializer for Firebase ID token.
    """
    id_token = serializers.CharField(required=True)


class AuthResponseSerializer(serializers.Serializer):
    """
    Serializer for authentication response.
    """
    user = UserSerializer(read_only=True)
    profile = UserProfileSerializer(read_only=True)
    token = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)

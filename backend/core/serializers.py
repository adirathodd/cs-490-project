"""
Serializers for authentication and user management.
"""
import os
import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from core.models import CandidateProfile, Skill, CandidateSkill, Education, Certification, Project, ProjectMedia

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
    full_location = serializers.SerializerMethodField()
    
    class Meta:
        model = CandidateProfile
        fields = [
            'email', 'first_name', 'last_name', 'full_name',
            'phone', 'city', 'state', 'full_location',
            'headline', 'summary', 'industry', 'experience_level',
            'location', 'years_experience', 'preferred_roles', 
            'portfolio_url', 'visibility'
        ]
    
    def get_full_name(self, obj):
        """Get user's full name with sensible fallback to email/username."""
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        if not name:
            return obj.user.email or obj.user.username or ""
        return name
    
    def get_full_location(self, obj):
        """Get formatted location."""
        return obj.get_full_location()
    
    def validate_summary(self, value):
        """Validate summary is within 500 character limit."""
        if len(value) > 500:
            raise serializers.ValidationError("Summary must not exceed 500 characters.")
        return value
    
    def validate_phone(self, value):
        """Validate phone number format."""
        if value:
            # Remove common formatting characters
            cleaned = re.sub(r'[\s\-\(\)\.]', '', value)
            if not re.match(r'^\+?1?\d{10,15}$', cleaned):
                raise serializers.ValidationError("Please enter a valid phone number.")
        return value
    
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


class BasicProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for UC-021: Basic Profile Information Form.
    Handles basic profile information including name, contact, and professional details.
    """
    first_name = serializers.CharField(source='user.first_name', max_length=150, required=False)
    last_name = serializers.CharField(source='user.last_name', max_length=150, required=False)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    full_location = serializers.SerializerMethodField(read_only=True)
    character_count = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = CandidateProfile
        fields = [
            'email', 'first_name', 'last_name', 'full_name',
            'phone', 'city', 'state', 'full_location',
            'headline', 'summary', 'character_count',
            'industry', 'experience_level'
        ]
    
    def get_full_name(self, obj):
        """Get user's full name."""
        return f"{obj.user.first_name} {obj.user.last_name}".strip()
    
    def get_full_location(self, obj):
        """Get formatted location."""
        return obj.get_full_location()
    
    def get_character_count(self, obj):
        """Get current character count for summary."""
        return len(obj.summary) if obj.summary else 0
    
    def validate_summary(self, value):
        """Validate summary is within 500 character limit."""
        if value and len(value) > 500:
            raise serializers.ValidationError("Summary must not exceed 500 characters.")
        return value
    
    def validate_phone(self, value):
        """Validate phone number format."""
        if value:
            # Remove common formatting characters
            cleaned = re.sub(r'[\s\-\(\)\.]', '', value)
            if not re.match(r'^\+?1?\d{10,15}$', cleaned):
                raise serializers.ValidationError("Please enter a valid phone number.")
        return value
    
    def validate_headline(self, value):
        """Validate headline length."""
        if value and len(value) > 160:
            raise serializers.ValidationError("Headline must not exceed 160 characters.")
        return value
    
    def update(self, instance, validated_data):
        """Update user and profile information."""
        user_data = validated_data.pop('user', {})
        
        # Update user fields (first_name, last_name)
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
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name', 'date_joined',
            'is_staff', 'is_superuser'
        ]
        read_only_fields = ['id', 'email', 'date_joined', 'is_staff', 'is_superuser']
    
    def get_full_name(self, obj):
        """Get user's full name with sensible fallback to email/username."""
        name = f"{obj.first_name} {obj.last_name}".strip()
        if not name:
            return obj.email or obj.username or ""
        return name


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


class ProfilePictureUploadSerializer(serializers.Serializer):
    """
    Serializer for UC-022: Profile Picture Upload.
    Handles profile picture file upload with validation.
    """
    profile_picture = serializers.ImageField(
        required=True,
        help_text="Profile picture image file (JPG, PNG, or GIF, max 5MB)"
    )
    
    def validate_profile_picture(self, value):
        """
        Validate profile picture file.
        """
        # Check file size (5MB max)
        max_size = 5 * 1024 * 1024  # 5MB in bytes
        if value.size > max_size:
            raise serializers.ValidationError(
                "Profile picture file size must not exceed 5MB."
            )
        
        # Check file extension
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
        file_ext = os.path.splitext(value.name)[1].lower()
        if file_ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Validate it's a valid image
        try:
            from PIL import Image
            img = Image.open(value)
            img.verify()
            # Reset file pointer after verify
            value.seek(0)
        except Exception as e:
            raise serializers.ValidationError(
                "Invalid or corrupted image file."
            )
        
        return value


class ProfilePictureSerializer(serializers.ModelSerializer):
    """
    Serializer for profile picture information.
    """
    profile_picture_url = serializers.SerializerMethodField(read_only=True)
    has_profile_picture = serializers.SerializerMethodField(read_only=True)
    profile_picture_uploaded_at = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = CandidateProfile
        fields = [
            'profile_picture_url',
            'has_profile_picture',
            'profile_picture_uploaded_at'
        ]
    
    def get_profile_picture_url(self, obj):
        """Get the full URL for the profile picture."""
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None
    
    def get_has_profile_picture(self, obj):
        """Check if user has uploaded a profile picture."""
        return bool(obj.profile_picture)


# ======================
# UC-026: SKILLS SERIALIZERS
# ======================

class SkillSerializer(serializers.ModelSerializer):
    """Serializer for Skill model - represents available skills."""
    class Meta:
        model = Skill
        fields = ['id', 'name', 'category']
        read_only_fields = ['id']


class CandidateSkillSerializer(serializers.ModelSerializer):
    """
    Serializer for UC-026: Add and Manage Skills.
    UC-027: Enhanced with ordering support for category organization.
    Handles adding, updating, and displaying user skills with proficiency levels.
    """
    skill_name = serializers.CharField(source='skill.name', read_only=True)
    skill_category = serializers.CharField(source='skill.category', read_only=True)
    skill_id = serializers.IntegerField(write_only=True, required=False)
    name = serializers.CharField(write_only=True, required=False, help_text="Skill name for creating new skill")
    category = serializers.CharField(write_only=True, required=False, help_text="Skill category")
    
    class Meta:
        model = CandidateSkill
        fields = [
            'id', 'skill_id', 'skill_name', 'skill_category',
            'name', 'category', 'level', 'years', 'order'
        ]
        read_only_fields = ['id']
    
    def validate_level(self, value):
        """Validate proficiency level."""
        valid_levels = ['beginner', 'intermediate', 'advanced', 'expert']
        if value.lower() not in valid_levels:
            raise serializers.ValidationError(
                f"Invalid proficiency level. Must be one of: {', '.join(valid_levels)}"
            )
        return value.lower()
    
    def validate(self, data):
        """Validate that either skill_id or name is provided."""
        skill_id = data.get('skill_id')
        name = data.get('name')
        
        if not skill_id and not name:
            raise serializers.ValidationError(
                "Either skill_id or name must be provided."
            )
        
        return data
    
    def create(self, validated_data):
        """Create or get skill, then create candidate skill."""
        candidate = validated_data.get('candidate')
        skill_id = validated_data.pop('skill_id', None)
        skill_name = validated_data.pop('name', None)
        skill_category = validated_data.pop('category', '')
        
        # Get or create skill
        if skill_id:
            try:
                skill = Skill.objects.get(id=skill_id)
            except Skill.DoesNotExist:
                raise serializers.ValidationError({"skill_id": "Skill not found."})
        else:
            # Create or get skill by name
            skill, created = Skill.objects.get_or_create(
                name__iexact=skill_name,
                defaults={'name': skill_name, 'category': skill_category}
            )
        
        # Check for duplicates
        if CandidateSkill.objects.filter(candidate=candidate, skill=skill).exists():
            raise serializers.ValidationError(
                {"skill": "You have already added this skill."}
            )
        
        # Create candidate skill
        validated_data['skill'] = skill
        return super().create(validated_data)


class SkillAutocompleteSerializer(serializers.Serializer):
    """Serializer for skill autocomplete suggestions."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.CharField()
    usage_count = serializers.IntegerField(required=False)


# ======================
# UC-027: SKILLS CATEGORY ORGANIZATION SERIALIZERS
# ======================

class SkillReorderSerializer(serializers.Serializer):
    """Serializer for reordering skills within or between categories."""
    skill_id = serializers.IntegerField(required=True)
    new_order = serializers.IntegerField(required=True, min_value=0)
    new_category = serializers.CharField(required=False, allow_blank=True)


class BulkSkillReorderSerializer(serializers.Serializer):
    """Serializer for bulk reordering of skills."""
    skills = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        help_text="List of {skill_id, order} objects"
    )


class CategorySummarySerializer(serializers.Serializer):
    """Serializer for category-based skill summaries."""
    category = serializers.CharField()
    count = serializers.IntegerField()
    proficiency_distribution = serializers.DictField()
    avg_years = serializers.FloatField()


# ======================
# Education serializers
# ======================

class EducationSerializer(serializers.ModelSerializer):
    """Serializer for educational background entries"""
    graduation_date = serializers.DateField(source='end_date', allow_null=True, required=False)

    class Meta:
        model = Education
        fields = [
            'id',
            'institution',
            'degree_type',
            'field_of_study',
            'start_date',
            'graduation_date',
            'currently_enrolled',
            'gpa',
            'gpa_private',
            'honors',
            'achievements',
            'description',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        data = super().validate(attrs)

        institution = data.get('institution') or getattr(self.instance, 'institution', None)
        degree_type = data.get('degree_type') or getattr(self.instance, 'degree_type', None)
        end_date = data.get('end_date') or getattr(self.instance, 'end_date', None)
        start_date = data.get('start_date') or getattr(self.instance, 'start_date', None)
        currently_enrolled = data.get('currently_enrolled')
        if currently_enrolled is None and self.instance is not None:
            currently_enrolled = self.instance.currently_enrolled

        errors = {}
        # Required fields
        if not institution:
            errors['institution'] = 'Institution name is required.'
        if not degree_type:
            errors['degree_type'] = 'Education level is required.'

        # GPA bounds (0.0 - 4.0 typical but allow up to 9.99 by DB; enforce 0-4 for UX)
        gpa = data.get('gpa')
        if gpa is not None:
            try:
                if gpa < 0 or gpa > 4:
                    errors['gpa'] = 'GPA must be between 0.00 and 4.00.'
            except Exception:
                errors['gpa'] = 'Invalid GPA value.'

        # Date logic
        if not currently_enrolled and not end_date:
            errors['graduation_date'] = 'Graduation date is required unless currently enrolled.'
        if start_date and end_date and start_date > end_date:
            errors['start_date'] = 'Start date cannot be after graduation date.'

        if errors:
            raise serializers.ValidationError(errors)

        return data


# ======================
# UC-030: CERTIFICATIONS SERIALIZERS
# ======================

class CertificationSerializer(serializers.ModelSerializer):
    """Serializer for professional certifications"""
    does_not_expire = serializers.BooleanField(source='never_expires', required=False)
    document_url = serializers.SerializerMethodField(read_only=True)
    is_expired = serializers.SerializerMethodField(read_only=True)
    days_until_expiration = serializers.SerializerMethodField(read_only=True)
    reminder_date = serializers.DateField(read_only=True)

    class Meta:
        model = Certification
        fields = [
            'id', 'name', 'issuing_organization', 'issue_date', 'expiry_date',
            'does_not_expire', 'credential_id', 'credential_url', 'category',
            'verification_status', 'document_url', 'is_expired', 'days_until_expiration',
            'renewal_reminder_enabled', 'reminder_days_before', 'reminder_date',
        ]
        read_only_fields = ['id', 'document_url', 'is_expired', 'days_until_expiration', 'reminder_date']

    def get_document_url(self, obj):
        request = self.context.get('request')
        if obj.document:
            url = obj.document.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_is_expired(self, obj):
        return obj.is_expired

    def get_days_until_expiration(self, obj):
        return obj.days_until_expiration

    def validate(self, attrs):
        data = super().validate(attrs)
        never_expires = data.get('never_expires')
        expiry_date = data.get('expiry_date')
        if never_expires and expiry_date:
            # If does not expire, ignore provided expiry_date
            data['expiry_date'] = None
        if not never_expires:
            # When it expires, expiry_date can be optional, but we'll allow null (user may add later)
            pass
        return data


# ======================
# UC-031: PROJECTS SERIALIZERS
# ======================

class ProjectMediaSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectMedia
        fields = ['id', 'image_url', 'caption', 'order', 'uploaded_at']
        read_only_fields = ['id', 'image_url', 'uploaded_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for project entries."""
    # Accept and return technologies as a list of skill names
    technologies = serializers.ListField(child=serializers.CharField(), required=False)
    status = serializers.ChoiceField(choices=[('completed','Completed'),('ongoing','Ongoing'),('planned','Planned')])
    media = ProjectMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'role', 'start_date', 'end_date',
            'project_url', 'team_size', 'collaboration_details', 'outcomes',
            'industry', 'category', 'status', 'technologies', 'media',
        ]
        read_only_fields = ['id', 'media']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Derive technologies from linked skills if not explicitly set
        data['technologies'] = [s.name for s in instance.skills_used.all()]
        return data

    def validate(self, attrs):
        data = super().validate(attrs)
        start_date = data.get('start_date') or getattr(self.instance, 'start_date', None)
        end_date = data.get('end_date') or getattr(self.instance, 'end_date', None)
        status_val = data.get('status') or getattr(self.instance, 'status', None)

        errors = {}
        if start_date and end_date and start_date > end_date:
            errors['start_date'] = 'Start date cannot be after end date.'

        # Team size validation
        team_size = data.get('team_size')
        if team_size is not None and team_size <= 0:
            errors['team_size'] = 'Team size must be a positive number.'

        if errors:
            raise serializers.ValidationError(errors)

        return data

    def _sync_technologies(self, project: Project, technologies):
        if technologies is None:
            return
        # Map list of names to Skill instances
        names = [str(n).strip() for n in technologies if str(n).strip()]
        if not names:
            project.skills_used.clear()
            return
        skills = []
        for name in names:
            # get_or_create case-insensitive
            existing = Skill.objects.filter(name__iexact=name).first()
            if existing:
                skills.append(existing)
            else:
                skills.append(Skill.objects.create(name=name, category=''))
        project.skills_used.set(skills)

    def create(self, validated_data):
        technologies = validated_data.pop('technologies', None)
        project = Project.objects.create(**validated_data)
        self._sync_technologies(project, technologies)
        return project

    def update(self, instance, validated_data):
        technologies = validated_data.pop('technologies', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if technologies is not None:
            self._sync_technologies(instance, technologies)
        return instance



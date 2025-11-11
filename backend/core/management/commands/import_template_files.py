from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import CoverLetterTemplate
import os
import glob

class Command(BaseCommand):
    help = 'Import cover letter templates from files in template_files directory'

    def add_arguments(self, parser):
        parser.add_argument(
            '--directory',
            type=str,
            default='template_files',
            help='Directory containing template files'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='User ID to assign as template owner (optional)'
        )

    def handle(self, *args, **options):
        User = get_user_model()
        
        # Get user (default to first user if not specified)
        if options['user_id']:
            try:
                user = User.objects.get(id=options['user_id'])
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User with ID {options["user_id"]} not found'))
                return
        else:
            user = User.objects.first()
            if not user:
                self.stdout.write(self.style.ERROR('No users found. Please create a user first.'))
                return

        directory = options['directory']
        if not os.path.exists(directory):
            self.stdout.write(self.style.ERROR(f'Directory {directory} does not exist'))
            return

        # Supported file extensions
        file_patterns = ['*.txt', '*.docx']
        template_files = []
        
        for pattern in file_patterns:
            template_files.extend(glob.glob(os.path.join(directory, pattern)))

        if not template_files:
            self.stdout.write(self.style.WARNING(f'No template files found in {directory}'))
            return

        imported_count = 0
        skipped_count = 0

        for file_path in template_files:
            filename = os.path.basename(file_path)
            name = os.path.splitext(filename)[0]
            
            # Skip if template already exists
            if CoverLetterTemplate.objects.filter(name=name).exists():
                self.stdout.write(self.style.WARNING(f'Skipped: {name} (already exists)'))
                skipped_count += 1
                continue

            try:
                # Read file content
                file_extension = filename.split('.')[-1].lower()
                
                if file_extension == 'txt':
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                elif file_extension == 'docx':
                    from docx import Document
                    doc = Document(file_path)
                    content = '\n'.join([paragraph.text for paragraph in doc.paragraphs])
                else:
                    self.stdout.write(self.style.WARNING(f'Skipped: {filename} (unsupported format)'))
                    skipped_count += 1
                    continue

                # Determine template type based on filename or content
                template_type = 'custom'
                industry = ''
                
                # Simple heuristics for categorization
                filename_lower = filename.lower()
                if any(word in filename_lower for word in ['tech', 'software', 'developer', 'engineer']):
                    template_type = 'technical'
                    industry = 'Technology'
                elif any(word in filename_lower for word in ['creative', 'design', 'art']):
                    template_type = 'creative'
                    industry = 'Design'
                elif any(word in filename_lower for word in ['executive', 'manager', 'director']):
                    template_type = 'formal'
                    industry = 'Executive'
                elif any(word in filename_lower for word in ['entry', 'graduate', 'junior']):
                    template_type = 'formal'
                    industry = 'Entry Level'

                # Create template
                template = CoverLetterTemplate.objects.create(
                    name=name,
                    content=content,
                    template_type=template_type,
                    industry=industry,
                    description=f'Imported from {filename}',
                    sample_content=content[:200] + '...' if len(content) > 200 else content,
                    owner=user,
                    is_shared=True,
                    imported_from=f'file:{filename}'
                )
                
                self.stdout.write(self.style.SUCCESS(f'✓ Imported: {name}'))
                imported_count += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to import {filename}: {str(e)}'))
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nImport complete!\n'
                f'Imported: {imported_count} templates\n'
                f'Skipped: {skipped_count} templates\n'
                f'Total templates in database: {CoverLetterTemplate.objects.count()}'
            )
        )
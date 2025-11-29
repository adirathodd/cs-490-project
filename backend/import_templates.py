#!/usr/bin/env python
"""
Script to import professional cover letter templates
"""
import os
import sys
import django

# Add the project directory to Python path
sys.path.append('/app')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import CoverLetterTemplate
from django.contrib.auth import get_user_model

def import_professional_templates():
    User = get_user_model()
    user = User.objects.first()
    
    if not user:
        print("No users found. Please create a user first.")
        return
    
    templates = [
        {
            'name': 'Modern Tech Professional',
            'content': '''[Your Name]
[Your Email] | [Your Phone] | [Your LinkedIn] | [Your Portfolio]
[City, State]

[Date]

[Hiring Manager Name]
[Company Name]
[Company Address]

Dear Hiring Manager,

I am excited to apply for the [Position Title] role at [Company Name]. As a passionate software developer with [X years] of experience building scalable applications, I am drawn to [Company Name]'s innovative approach to [specific technology/product].

Key highlights of my experience include:
• Developed [specific project] using [technologies], resulting in [quantifiable impact]
• Led cross-functional team of [number] to deliver [specific outcome]
• Optimized application performance by [percentage/metric], improving user experience
• Contributed to open-source projects including [project names]

I am particularly impressed by [Company Name]'s recent [specific achievement/product launch] and would love to contribute my expertise in [relevant technologies] to help drive your continued innovation.

Thank you for considering my application. I look forward to discussing how my technical skills and passion for [relevant area] can contribute to your team.

Best regards,
[Your Name]''',
            'template_type': 'technical',
            'industry': 'Technology',
            'description': 'Modern, results-focused template for software engineers and tech professionals'
        },
        {
            'name': 'Executive Leadership',
            'content': '''[Your Name]
[Your Title]
[Your Email] | [Your Phone]
[City, State]

[Date]

[Board Member/CEO Name]
[Company Name]
[Company Address]

Dear [Hiring Manager Name],

I am writing to express my strong interest in the [Executive Position] role at [Company Name]. With over [X years] of progressive leadership experience and a proven track record of driving organizational growth, I am confident in my ability to contribute to [Company Name]'s strategic objectives.

Throughout my career, I have consistently delivered exceptional results:
• Scaled [previous company] from [starting point] to [end point], achieving [growth metric]
• Built and led high-performing teams of [number] across [departments/regions]
• Implemented strategic initiatives that resulted in [specific business outcomes]
• Successfully navigated [specific challenges] while maintaining [key metrics]

My leadership philosophy centers on [leadership approach], which aligns perfectly with [Company Name]'s values of [company values]. I am particularly excited about the opportunity to [specific contribution to role/company].

I would welcome the opportunity to discuss how my executive experience and strategic vision can help [Company Name] achieve its ambitious goals.

Sincerely,
[Your Name]''',
            'template_type': 'formal',
            'industry': 'Executive',
            'description': 'Professional template for C-level and senior executive positions'
        },
        {
            'name': 'Creative Professional',
            'content': '''Hi [Hiring Manager Name],

I hope this message finds you well! I am reaching out about the [Creative Position] opportunity at [Company Name], and I couldn't be more excited about the possibility of joining your innovative team.

As a [your creative role] with [X years] of experience, I thrive on transforming ideas into compelling visual stories. My passion for [specific creative area] perfectly aligns with [Company Name]'s mission to [company mission/recent project].

Here's what I bring to the table:
• Created [specific project] that achieved [measurable impact/recognition]
• Collaborated with diverse teams to deliver [number] successful campaigns
• Expert in [creative tools/software] with a portfolio spanning [types of work]
• Recipient of [awards/recognition] for [specific achievements]

I've been following [Company Name]'s work, particularly [specific project/campaign], and I'm inspired by your approach to [specific aspect]. I would love to contribute my creative vision and technical expertise to help push boundaries even further.

I'd be thrilled to show you my portfolio and discuss how we can create something amazing together!

Creatively yours,
[Your Name]

P.S. You can view my portfolio at [portfolio URL]''',
            'template_type': 'creative',
            'industry': 'Design',
            'description': 'Engaging, personality-driven template for creative and design roles'
        },
        {
            'name': 'Entry Level Graduate',
            'content': '''[Your Name]
[Your Email] | [Your Phone] | [Your LinkedIn]
[City, State]

[Date]

[Hiring Manager Name]
[Company Name]
[Company Address]

Dear [Hiring Manager Name],

As a recent [Degree] graduate from [University], I am excited to apply for the [Entry-Level Position] at [Company Name]. While I may be new to the professional world, I bring fresh perspectives, enthusiasm, and a strong foundation in [relevant field].

During my academic journey, I have:
• Maintained a [GPA] while completing coursework in [relevant subjects]
• Completed [internship/project] where I [specific achievement]
• Developed proficiency in [relevant tools/technologies]
• Led [student organization/project] resulting in [specific outcome]

What excites me most about [Company Name] is [specific reason]. I am eager to apply my academic knowledge to real-world challenges and contribute to your team's success while continuing to learn and grow.

I am particularly drawn to this role because [specific reason related to position]. I would love the opportunity to discuss how my fresh perspective and dedication can benefit your organization.

Thank you for considering my application. I look forward to hearing from you.

Sincerely,
[Your Name]''',
            'template_type': 'formal',
            'industry': 'Entry Level',
            'description': 'Perfect template for new graduates and entry-level positions'
        },
        {
            'name': 'Career Change Professional',
            'content': '''[Your Name]
[Your Email] | [Your Phone]
[City, State]

[Date]

[Hiring Manager Name]
[Company Name]
[Company Address]

Dear [Hiring Manager Name],

I am writing to express my interest in the [New Field Position] at [Company Name]. While my background is in [Previous Field], I am excited to bring my transferable skills and fresh perspective to [New Field].

My diverse experience has equipped me with valuable skills that translate well to this role:
• [Transferable Skill 1]: Demonstrated through [specific example from previous field]
• [Transferable Skill 2]: Evidenced by [achievement from previous career]
• [Transferable Skill 3]: Proven by [relevant accomplishment]

To prepare for this career transition, I have:
• Completed [relevant certification/course] in [new field area]
• Volunteered/worked on [relevant project] to gain practical experience
• Networked with professionals in [new field] to understand industry trends

My unique combination of [previous field] expertise and passion for [new field] positions me to offer a fresh perspective and innovative solutions. I am committed to leveraging my proven track record of [relevant achievement] to drive success in this new capacity.

I would welcome the opportunity to discuss how my diverse background and enthusiasm can contribute to [Company Name]'s continued growth.

Best regards,
[Your Name]''',
            'template_type': 'formal',
            'industry': 'Career Change',
            'description': 'Strategic template for professionals transitioning between industries'
        }
    ]
    
    created_count = 0
    for template_data in templates:
        # Check if template already exists
        if not CoverLetterTemplate.objects.filter(name=template_data['name']).exists():
            CoverLetterTemplate.objects.create(
                name=template_data['name'],
                content=template_data['content'],
                template_type=template_data['template_type'],
                industry=template_data['industry'],
                description=template_data['description'],
                sample_content=f"Professional {template_data['industry']} template with modern formatting and strategic messaging.",
                owner=user,
                is_shared=True
            )
            created_count += 1
            print(f"✓ Created: {template_data['name']}")
        else:
            print(f"- Skipped: {template_data['name']} (already exists)")
    
    total_templates = CoverLetterTemplate.objects.count()
    print(f"\nImport complete!")
    print(f"Created: {created_count} new templates")
    print(f"Total templates in database: {total_templates}")

if __name__ == "__main__":
    import_professional_templates()
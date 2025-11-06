"""
Management command to enrich existing companies with missing data.
Updates companies that have incomplete information.

Usage: python manage.py enrich_companies
or: docker-compose exec backend python manage.py enrich_companies
"""

import random
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from core.models import Company, CompanyResearch
from decimal import Decimal


class Command(BaseCommand):
    help = 'Enriches existing companies with missing data using intelligent defaults'

    def generate_linkedin_url(self, company_name):
        """Generate LinkedIn URL from company name"""
        slug = company_name.lower().replace(' & co.', '').replace('&', 'and').replace(' ', '-').replace('.', '')
        return f'https://www.linkedin.com/company/{slug}'

    def get_industry_mission_templates(self):
        """Mission statement templates by industry"""
        return {
            'Technology': [
                'To innovate and deliver cutting-edge technology solutions that empower businesses and individuals.',
                'To transform the digital landscape through innovative software and services.',
                'To make technology accessible and beneficial for everyone.',
                'To drive technological innovation and create value for our customers.',
            ],
            'Finance': [
                'To provide world-class financial services and help our clients achieve their goals.',
                'To deliver exceptional financial solutions and build lasting client relationships.',
                'To be the most trusted partner in financial services.',
                'To empower financial success through innovative solutions and expert guidance.',
            ],
            'E-commerce': [
                'To revolutionize online shopping and create exceptional customer experiences.',
                'To connect buyers and sellers through innovative e-commerce solutions.',
                'To make online shopping simple, convenient, and enjoyable.',
                'To build the world\'s most customer-centric marketplace.',
            ],
            'Healthcare': [
                'To improve lives through innovative healthcare solutions and services.',
                'To advance healthcare and make quality care accessible to all.',
                'To transform healthcare delivery through innovation and excellence.',
                'To be a leader in health and wellness solutions.',
            ],
            'Consulting': [
                'To help clients solve their most complex challenges and achieve exceptional results.',
                'To deliver strategic insights and transformative solutions.',
                'To be the trusted advisor for leading organizations worldwide.',
                'To drive innovation and create lasting value for our clients.',
            ],
            'Automotive': [
                'To design and build vehicles that inspire and move the world forward.',
                'To lead the automotive industry through innovation and sustainability.',
                'To create exceptional vehicles and advance sustainable transportation.',
                'To revolutionize mobility and shape the future of transportation.',
            ],
            'Retail': [
                'To provide exceptional value and service to our customers every day.',
                'To be the preferred shopping destination through quality products and service.',
                'To make everyday life better through accessible products and great experiences.',
                'To deliver outstanding value and convenience to our customers.',
            ],
            'Media': [
                'To create and deliver compelling content that entertains and inspires.',
                'To be the leading creator of world-class entertainment experiences.',
                'To tell stories that matter and connect with audiences worldwide.',
                'To entertain, inform, and inspire through exceptional content.',
            ],
        }

    def get_industry_tech_stacks(self):
        """Common tech stacks by industry"""
        return {
            'Technology': ['Python', 'JavaScript', 'React', 'Node.js', 'AWS', 'Docker'],
            'Finance': ['Java', 'Python', 'SQL', 'Oracle', 'Kubernetes', 'React'],
            'E-commerce': ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS', 'Redis'],
            'Healthcare': ['Python', 'Java', 'SQL Server', 'Azure', 'React', 'Angular'],
            'Consulting': ['Python', 'R', 'Tableau', 'Azure', 'AWS', 'PowerBI'],
            'Automotive': ['C++', 'Python', 'Linux', 'MATLAB', 'ROS', 'TensorFlow'],
            'Retail': ['Java', 'Python', 'React', 'SQL', 'AWS', 'Kafka'],
            'Media': ['JavaScript', 'Python', 'React', 'AWS', 'Node.js', 'FFmpeg'],
        }

    def get_industry_culture_keywords(self):
        """Culture keywords by industry"""
        return {
            'Technology': ['Innovation', 'Agile', 'Collaboration', 'Engineering Excellence', 'Data-Driven'],
            'Finance': ['Integrity', 'Client-First', 'Excellence', 'Risk Management', 'Innovation'],
            'E-commerce': ['Customer Obsession', 'Speed', 'Innovation', 'Data-Driven', 'Scale'],
            'Healthcare': ['Patient Care', 'Innovation', 'Compliance', 'Quality', 'Collaboration'],
            'Consulting': ['Client Success', 'Strategic Thinking', 'Excellence', 'Innovation', 'Teamwork'],
            'Automotive': ['Innovation', 'Quality', 'Safety', 'Sustainability', 'Engineering'],
            'Retail': ['Customer Service', 'Value', 'Efficiency', 'Community', 'Innovation'],
            'Media': ['Creativity', 'Innovation', 'Storytelling', 'Collaboration', 'Excellence'],
        }

    def estimate_employee_count(self, size_category, industry):
        """Estimate employee count based on size and industry"""
        if not size_category:
            size_category = 'Large (10,000+ employees)'
            
        if 'Large' in size_category or '10,000+' in size_category:
            if industry == 'Technology':
                return random.randint(15000, 50000)
            elif industry == 'Finance':
                return random.randint(30000, 80000)
            elif industry == 'Retail':
                return random.randint(50000, 150000)
            else:
                return random.randint(10000, 40000)
        elif '1,000+' in size_category:
            return random.randint(1000, 9999)
        else:
            return random.randint(500, 999)

    def generate_glassdoor_rating(self, industry):
        """Generate realistic Glassdoor rating based on industry averages"""
        base_ratings = {
            'Technology': 4.1,
            'Finance': 3.9,
            'E-commerce': 4.0,
            'Healthcare': 3.8,
            'Consulting': 4.0,
            'Automotive': 3.9,
            'Retail': 3.7,
            'Media': 3.9,
        }
        base = base_ratings.get(industry, 3.9)
        variance = random.uniform(-0.3, 0.3)
        rating = round(base + variance, 1)
        return max(3.5, min(4.5, rating))

    def generate_recent_news(self, company_name, industry):
        """Generate realistic news items based on company and industry"""
        news_templates = {
            'Technology': [
                {'title': f'{company_name} announces new product innovations', 'summary': f'{company_name} unveils latest technology advancements and product updates.'},
                {'title': f'{company_name} expands engineering team', 'summary': f'Company announces hiring initiatives to support growth and innovation.'},
            ],
            'Finance': [
                {'title': f'{company_name} reports strong quarterly results', 'summary': f'Financial services firm exceeds expectations with solid performance.'},
                {'title': f'{company_name} launches new digital banking platform', 'summary': f'Enhanced digital services and customer experience initiatives.'},
            ],
            'E-commerce': [
                {'title': f'{company_name} enhances customer experience', 'summary': f'New features and services improve shopping experience.'},
            ],
            'Healthcare': [
                {'title': f'{company_name} advances healthcare technology', 'summary': f'New solutions improve patient care and outcomes.'},
            ],
            'Consulting': [
                {'title': f'{company_name} named industry leader', 'summary': f'Recognition for excellence in consulting services.'},
            ],
            'Automotive': [
                {'title': f'{company_name} unveils new vehicle models', 'summary': f'Latest innovations in automotive design and technology.'},
            ],
            'Retail': [
                {'title': f'{company_name} opens new locations', 'summary': f'Expansion continues with new stores and markets.'},
            ],
            'Media': [
                {'title': f'{company_name} announces new content slate', 'summary': f'Exciting new shows and movies coming soon.'},
            ],
        }

        templates = news_templates.get(industry, news_templates['Technology'])
        selected_template = random.choice(templates)
        
        days_ago = random.randint(30, 90)
        news_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
        return [{
            'title': selected_template['title'],
            'date': news_date,
            'summary': selected_template['summary'],
            'url': f'https://www.{company_name.lower().replace(" ", "")}.com/news'
        }]

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting to enrich companies with missing data...'))
        
        # Get companies with missing data
        companies_to_update = Company.objects.filter(
            linkedin_url__in=['', None]
        ) | Company.objects.filter(
            industry__in=['', None]
        ) | Company.objects.filter(
            size__in=['', None]
        )
        
        updated_count = 0
        
        mission_templates = self.get_industry_mission_templates()
        tech_stacks = self.get_industry_tech_stacks()
        culture_keywords = self.get_industry_culture_keywords()
        
        for company in companies_to_update:
            try:
                # Determine industry (default to Technology if not set)
                industry = company.industry or 'Technology'
                
                # Update company fields
                if not company.linkedin_url:
                    company.linkedin_url = self.generate_linkedin_url(company.name)
                
                if not company.industry:
                    company.industry = 'Technology'
                    industry = 'Technology'
                
                if not company.size:
                    company.size = 'Large (10,000+ employees)'
                
                if not company.hq_location:
                    company.hq_location = 'United States'
                
                company.save()
                
                # Get or create research
                try:
                    research = company.research
                    needs_update = False
                    
                    if not research.mission_statement:
                        research.mission_statement = random.choice(mission_templates.get(industry, mission_templates['Technology']))
                        needs_update = True
                    
                    if not research.tech_stack or len(research.tech_stack) == 0:
                        research.tech_stack = tech_stacks.get(industry, tech_stacks['Technology'])
                        needs_update = True
                    
                    if not research.culture_keywords or len(research.culture_keywords) == 0:
                        research.culture_keywords = culture_keywords.get(industry, culture_keywords['Technology'])
                        needs_update = True
                    
                    if not research.employee_count:
                        research.employee_count = self.estimate_employee_count(company.size, industry)
                        needs_update = True
                    
                    if not research.glassdoor_rating:
                        research.glassdoor_rating = Decimal(str(self.generate_glassdoor_rating(industry)))
                        needs_update = True
                    
                    if not research.recent_news or len(research.recent_news) == 0:
                        research.recent_news = self.generate_recent_news(company.name, industry)
                        needs_update = True
                    
                    if not research.growth_rate:
                        research.growth_rate = Decimal(str(round(random.uniform(3.0, 15.0), 1)))
                        needs_update = True
                    
                    if needs_update:
                        research.save()
                    
                except CompanyResearch.DoesNotExist:
                    # Create new research
                    CompanyResearch.objects.create(
                        company=company,
                        description=f'{company.name} is a leading company in the {industry} industry.',
                        mission_statement=random.choice(mission_templates.get(industry, mission_templates['Technology'])),
                        tech_stack=tech_stacks.get(industry, tech_stacks['Technology']),
                        recent_news=self.generate_recent_news(company.name, industry),
                        culture_keywords=culture_keywords.get(industry, culture_keywords['Technology']),
                        funding_info={'stage': 'Private', 'status': 'Active'},
                        employee_count=self.estimate_employee_count(company.size, industry),
                        growth_rate=Decimal(str(round(random.uniform(3.0, 15.0), 1))),
                        glassdoor_rating=Decimal(str(self.generate_glassdoor_rating(industry))),
                    )
                
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Updated: {company.name}'))
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Error updating {company.name}: {e}'))
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n{"="*60}\n'
                f'✓ Enrichment complete!\n'
                f'  Updated: {updated_count} companies\n'
                f'  Total companies: {Company.objects.count()}\n'
                f'  Companies with LinkedIn: {Company.objects.exclude(linkedin_url="").exclude(linkedin_url__isnull=True).count()}\n'
                f'  Companies with research: {CompanyResearch.objects.count()}\n'
                f'{"="*60}'
            )
        )

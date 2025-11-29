"""
Management command to populate the database with top companies' information.
Usage: python manage.py populate_companies
or: docker-compose exec backend python manage.py populate_companies
"""

from django.core.management.base import BaseCommand
from core.models import Company, CompanyResearch


class Command(BaseCommand):
    help = 'Populates the database with top companies and their research data'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Starting to populate companies...'))
        
        companies_data = [
            {
                'name': 'Google',
                'domain': 'google.com',
                'industry': 'Technology',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Mountain View, CA',
                'linkedin_url': 'https://www.linkedin.com/company/google',
                'research': {
                    'description': 'Google is a multinational technology company that specializes in Internet-related services and products, including online advertising technologies, search engine, cloud computing, software, and hardware.',
                    'mission_statement': 'To organize the world\'s information and make it universally accessible and useful.',
                    'culture_keywords': ['Innovation', 'Collaboration', 'Data-driven', 'User-first', 'Engineering excellence'],
                    'recent_news': [
                        {
                            'title': 'Google announces new AI advancements',
                            'date': '2024-10-15',
                            'summary': 'Google unveils latest innovations in artificial intelligence and machine learning.',
                            'url': 'https://blog.google/technology/ai/'
                        },
                        {
                            'title': 'Google Cloud expansion',
                            'date': '2024-09-20',
                            'summary': 'Google Cloud announces new data centers and services.',
                            'url': 'https://cloud.google.com/blog'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'GOOGL', 'exchange': 'NASDAQ'},
                    'tech_stack': ['Python', 'Java', 'C++', 'Go', 'Kubernetes', 'TensorFlow'],
                    'employee_count': 150000,
                    'growth_rate': 5.5,
                    'glassdoor_rating': 4.4
                }
            },
            {
                'name': 'Microsoft',
                'domain': 'microsoft.com',
                'industry': 'Technology',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Redmond, WA',
                'linkedin_url': 'https://www.linkedin.com/company/microsoft',
                'research': {
                    'description': 'Microsoft is a leading technology company that develops, manufactures, licenses, supports, and sells computer software, consumer electronics, personal computers, and related services.',
                    'mission_statement': 'To empower every person and every organization on the planet to achieve more.',
                    'culture_keywords': ['Innovation', 'Diversity', 'Growth mindset', 'Customer obsession', 'One Microsoft'],
                    'recent_news': [
                        {
                            'title': 'Microsoft announces Azure AI updates',
                            'date': '2024-10-10',
                            'summary': 'New Azure AI services and capabilities released.',
                            'url': 'https://azure.microsoft.com/blog'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'MSFT', 'exchange': 'NASDAQ'},
                    'tech_stack': ['.NET', 'C#', 'TypeScript', 'Python', 'Azure', 'React'],
                    'employee_count': 220000,
                    'growth_rate': 8.2,
                    'glassdoor_rating': 4.3
                }
            },
            {
                'name': 'Amazon',
                'domain': 'amazon.com',
                'industry': 'E-commerce & Technology',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Seattle, WA',
                'linkedin_url': 'https://www.linkedin.com/company/amazon',
                'research': {
                    'description': 'Amazon is a multinational technology company focusing on e-commerce, cloud computing, digital streaming, and artificial intelligence.',
                    'mission_statement': 'To be Earth\'s most customer-centric company, where customers can find and discover anything they might want to buy online.',
                    'culture_keywords': ['Customer obsession', 'Innovation', 'Ownership', 'Bias for action', 'Frugality'],
                    'recent_news': [
                        {
                            'title': 'AWS announces new services',
                            'date': '2024-10-05',
                            'summary': 'Amazon Web Services launches new cloud computing services.',
                            'url': 'https://aws.amazon.com/blogs'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'AMZN', 'exchange': 'NASDAQ'},
                    'tech_stack': ['Java', 'Python', 'AWS', 'DynamoDB', 'Kubernetes', 'React'],
                    'employee_count': 1500000,
                    'growth_rate': 12.5,
                    'glassdoor_rating': 3.9
                }
            },
            {
                'name': 'Apple',
                'domain': 'apple.com',
                'industry': 'Technology',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Cupertino, CA',
                'linkedin_url': 'https://www.linkedin.com/company/apple',
                'research': {
                    'description': 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
                    'mission_statement': 'To bring the best user experience to customers through innovative hardware, software, and services.',
                    'culture_keywords': ['Innovation', 'Design excellence', 'Privacy', 'Sustainability', 'Quality'],
                    'recent_news': [
                        {
                            'title': 'Apple unveils new product lineup',
                            'date': '2024-09-15',
                            'summary': 'Latest iPhone, iPad, and Mac products announced.',
                            'url': 'https://www.apple.com/newsroom'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'AAPL', 'exchange': 'NASDAQ'},
                    'tech_stack': ['Swift', 'Objective-C', 'Python', 'C++', 'Metal', 'CloudKit'],
                    'employee_count': 164000,
                    'growth_rate': 4.8,
                    'glassdoor_rating': 4.2
                }
            },
            {
                'name': 'Meta',
                'domain': 'meta.com',
                'industry': 'Social Media & Technology',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Menlo Park, CA',
                'linkedin_url': 'https://www.linkedin.com/company/meta',
                'research': {
                    'description': 'Meta Platforms, Inc. operates social networking platforms including Facebook, Instagram, and WhatsApp, and is developing virtual reality and metaverse technologies.',
                    'mission_statement': 'To give people the power to build community and bring the world closer together.',
                    'culture_keywords': ['Move fast', 'Build social value', 'Be bold', 'Focus on impact', 'Be open'],
                    'recent_news': [
                        {
                            'title': 'Meta advances AI and VR technologies',
                            'date': '2024-10-01',
                            'summary': 'New developments in artificial intelligence and virtual reality platforms.',
                            'url': 'https://about.fb.com/news'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'META', 'exchange': 'NASDAQ'},
                    'tech_stack': ['Python', 'React', 'GraphQL', 'PyTorch', 'Hack', 'PHP'],
                    'employee_count': 67000,
                    'growth_rate': 7.3,
                    'glassdoor_rating': 4.3
                }
            },
            {
                'name': 'Netflix',
                'domain': 'netflix.com',
                'industry': 'Entertainment & Technology',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Los Gatos, CA',
                'linkedin_url': 'https://www.linkedin.com/company/netflix',
                'research': {
                    'description': 'Netflix is the world\'s leading streaming entertainment service with over 230 million paid memberships in over 190 countries.',
                    'mission_statement': 'To entertain the world.',
                    'culture_keywords': ['Freedom and responsibility', 'Innovation', 'Curiosity', 'Courage', 'Communication'],
                    'recent_news': [
                        {
                            'title': 'Netflix expands content library',
                            'date': '2024-09-25',
                            'summary': 'New original series and movies announced for upcoming season.',
                            'url': 'https://about.netflix.com/en/news'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'NFLX', 'exchange': 'NASDAQ'},
                    'tech_stack': ['Java', 'Python', 'JavaScript', 'React', 'Node.js', 'AWS'],
                    'employee_count': 12800,
                    'growth_rate': 6.1,
                    'glassdoor_rating': 4.1
                }
            },
            {
                'name': 'Tesla',
                'domain': 'tesla.com',
                'industry': 'Automotive & Energy',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Austin, TX',
                'linkedin_url': 'https://www.linkedin.com/company/tesla-motors',
                'research': {
                    'description': 'Tesla designs, develops, manufactures, and sells electric vehicles, battery energy storage, and solar energy generation systems.',
                    'mission_statement': 'To accelerate the world\'s transition to sustainable energy.',
                    'culture_keywords': ['Innovation', 'Sustainability', 'Fast-paced', 'Mission-driven', 'Engineering excellence'],
                    'recent_news': [
                        {
                            'title': 'Tesla announces new vehicle models',
                            'date': '2024-10-08',
                            'summary': 'New electric vehicle models and features unveiled.',
                            'url': 'https://www.tesla.com/blog'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'TSLA', 'exchange': 'NASDAQ'},
                    'tech_stack': ['Python', 'C++', 'JavaScript', 'Linux', 'ROS', 'TensorFlow'],
                    'employee_count': 127855,
                    'growth_rate': 18.7,
                    'glassdoor_rating': 3.6
                }
            },
            {
                'name': 'Salesforce',
                'domain': 'salesforce.com',
                'industry': 'Enterprise Software',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'San Francisco, CA',
                'linkedin_url': 'https://www.linkedin.com/company/salesforce',
                'research': {
                    'description': 'Salesforce is a leading cloud-based software company providing customer relationship management (CRM) service and complementary enterprise applications.',
                    'mission_statement': 'To help companies connect with their customers in a whole new way.',
                    'culture_keywords': ['Ohana', 'Trust', 'Innovation', 'Equality', 'Customer success'],
                    'recent_news': [
                        {
                            'title': 'Salesforce launches new AI features',
                            'date': '2024-09-30',
                            'summary': 'Einstein AI platform receives major updates.',
                            'url': 'https://www.salesforce.com/news'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'CRM', 'exchange': 'NYSE'},
                    'tech_stack': ['Java', 'Apex', 'JavaScript', 'React', 'Lightning', 'Heroku'],
                    'employee_count': 73000,
                    'growth_rate': 10.5,
                    'glassdoor_rating': 4.2
                }
            },
            {
                'name': 'Adobe',
                'domain': 'adobe.com',
                'industry': 'Software',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'San Jose, CA',
                'linkedin_url': 'https://www.linkedin.com/company/adobe',
                'research': {
                    'description': 'Adobe is a multinational computer software company known for its creative software products including Photoshop, Illustrator, and Premiere Pro.',
                    'mission_statement': 'To change the world through digital experiences.',
                    'culture_keywords': ['Creativity', 'Innovation', 'Authenticity', 'Excellence', 'Inclusion'],
                    'recent_news': [
                        {
                            'title': 'Adobe announces Creative Cloud updates',
                            'date': '2024-10-12',
                            'summary': 'New AI-powered features added to Creative Cloud suite.',
                            'url': 'https://blog.adobe.com'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'ADBE', 'exchange': 'NASDAQ'},
                    'tech_stack': ['JavaScript', 'C++', 'Python', 'React', 'Node.js', 'AWS'],
                    'employee_count': 29239,
                    'growth_rate': 5.9,
                    'glassdoor_rating': 4.3
                }
            },
            {
                'name': 'IBM',
                'domain': 'ibm.com',
                'industry': 'Technology & Consulting',
                'size': 'Large (10,000+ employees)',
                'hq_location': 'Armonk, NY',
                'linkedin_url': 'https://www.linkedin.com/company/ibm',
                'research': {
                    'description': 'IBM is a global technology and innovation company offering integrated solutions that leverage data, IT, cloud computing, and AI.',
                    'mission_statement': 'To be essential in helping our clients build smarter businesses and solve the world\'s most pressing problems.',
                    'culture_keywords': ['Innovation', 'Trust', 'Client success', 'Responsibility', 'Continuous learning'],
                    'recent_news': [
                        {
                            'title': 'IBM Watson advances in AI',
                            'date': '2024-09-18',
                            'summary': 'New AI capabilities and enterprise solutions announced.',
                            'url': 'https://newsroom.ibm.com'
                        }
                    ],
                    'funding_info': {'stage': 'Public', 'ticker': 'IBM', 'exchange': 'NYSE'},
                    'tech_stack': ['Java', 'Python', 'Node.js', 'Kubernetes', 'Red Hat', 'Watson'],
                    'employee_count': 288000,
                    'growth_rate': 3.2,
                    'glassdoor_rating': 4.0
                }
            }
        ]

        created_count = 0
        updated_count = 0

        for company_data in companies_data:
            research_data = company_data.pop('research')
            
            # Get or create company
            company, created = Company.objects.get_or_create(
                domain=company_data['domain'],
                defaults=company_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created company: {company.name}')
                )
            else:
                # Update existing company
                for key, value in company_data.items():
                    setattr(company, key, value)
                company.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated company: {company.name}')
                )
            
            # Get or create company research
            research, research_created = CompanyResearch.objects.get_or_create(
                company=company,
                defaults=research_data
            )
            
            if not research_created:
                # Update existing research
                for key, value in research_data.items():
                    setattr(research, key, value)
                research.save()
                self.stdout.write(
                    self.style.WARNING(f'Updated research for: {company.name}')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'Created research for: {company.name}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully populated {created_count} new companies and updated {updated_count} existing companies.'
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Total companies in database: {Company.objects.count()}'
            )
        )

"""
Skills Gap Analysis Generator for UC-066

Analyzes job requirements against candidate skills to identify gaps,
prioritize learning opportunities, and suggest resources.
"""
import re
import logging
from typing import Dict, List, Optional, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)


class SkillsGapAnalyzer:
    """Generate skills gap analysis for job opportunities."""
    
    # Skill level hierarchy for comparison
    LEVEL_HIERARCHY = {
        'beginner': 1,
        'intermediate': 2,
        'advanced': 3,
        'expert': 4,
    }
    
    @classmethod
    def analyze_job(
        cls,
        job,
        candidate_profile,
        include_similar_trends: bool = False
    ) -> Dict:
        """
        Analyze skills gap for a specific job and candidate.
        
        Args:
            job: JobEntry instance
            candidate_profile: CandidateProfile instance
            include_similar_trends: Whether to include analysis of similar jobs
            
        Returns:
            Dictionary with skills gap analysis results
        """
        from core.models import Skill, CandidateSkill, JobEntry, LearningResource
        
        # Extract required skills from job
        required_skills = cls._extract_job_requirements(job)
        
        # Get candidate's current skills
        candidate_skills = cls._get_candidate_skills(candidate_profile)
        
        # Compare and compute gaps
        skills_analysis = []
        for req_skill_data in required_skills:
            skill_id = req_skill_data['skill_id']
            skill_name = req_skill_data['name']
            
            # Find candidate's proficiency
            candidate_level = None
            candidate_years = None
            if skill_id in candidate_skills:
                candidate_level = candidate_skills[skill_id]['level']
                candidate_years = candidate_skills[skill_id]['years']
            
            # Compute gap
            gap_severity = cls._compute_gap_severity(
                required=req_skill_data.get('is_required', True),
                required_level=req_skill_data.get('level'),
                candidate_level=candidate_level,
                candidate_years=candidate_years,
                job_priority=req_skill_data.get('priority', 50)
            )
            
            # Get learning resources
            resources = cls._get_learning_resources(
                skill_id=skill_id,
                candidate_level=candidate_level,
                limit=3
            )
            
            # Build learning path
            learning_path = cls._build_learning_path(
                skill_name=skill_name,
                candidate_level=candidate_level,
                target_level=req_skill_data.get('level', 'intermediate'),
                resources=resources
            )
            
            skills_analysis.append({
                'skill_id': skill_id,
                'name': skill_name,
                'category': req_skill_data.get('category', ''),
                'importance_rank': req_skill_data.get('importance_rank', 0),
                'required': req_skill_data.get('is_required', True),
                'job_priority': req_skill_data.get('priority', 50),
                'candidate_level': candidate_level,
                'candidate_years': float(candidate_years) if candidate_years else None,
                'target_level': req_skill_data.get('level'),
                'gap_severity': gap_severity,
                'recommended_resources': resources,
                'suggested_learning_path': learning_path,
            })
        
        # Sort by gap severity and importance
        skills_analysis.sort(
            key=lambda x: (x['gap_severity'], -x['importance_rank']),
            reverse=True
        )
        
        # Add importance ranks after sorting
        for idx, skill in enumerate(skills_analysis, 1):
            skill['importance_rank'] = idx
        
        # Compute summary
        total_skills = len(skills_analysis)
        missing_skills = sum(1 for s in skills_analysis if s['candidate_level'] is None)
        matched_skills = total_skills - missing_skills
        
        # Get top gaps (severity > 60)
        top_gaps = [s['name'] for s in skills_analysis[:3] if s['gap_severity'] > 60]
        
        # Estimate time needed (rough heuristic: 2 weeks per major gap)
        high_gaps = sum(1 for s in skills_analysis if s['gap_severity'] > 70)
        medium_gaps = sum(1 for s in skills_analysis if 40 < s['gap_severity'] <= 70)
        estimated_weeks = (high_gaps * 2) + (medium_gaps * 1)
        
        summary = {
            'top_gaps': top_gaps,
            'total_skills_required': total_skills,
            'total_skills_matched': matched_skills,
            'total_skills_missing': missing_skills,
            'recommended_time_weeks': estimated_weeks,
        }
        
        result = {
            'job_id': job.id,
            'generated_at': None,  # Will be set by view
            'source': 'parsed',  # Will be updated if AI/requirements used
            'skills': skills_analysis,
            'summary': summary,
        }
        
        # Add trends if requested
        if include_similar_trends:
            trends = cls._analyze_similar_jobs(job, candidate_profile)
            result['trends'] = trends
        
        return result
    
    @classmethod
    def _extract_job_requirements(cls, job) -> List[Dict]:
        """
        Extract required skills from job description and requirements.
        
        Priority:
        1. JobRequirement records if available (structured data)
        2. Parse job description for skill keywords (existing skills)
        3. Extract common skill keywords from text (auto-create if needed)
        
        Returns list of dicts with skill info.
        """
        from core.models import Skill, JobRequirement
        
        skills = []
        found_skill_names = set()
        
        # Try structured requirements first (if job maps to JobOpportunity)
        # For now, we'll parse the description since JobEntry doesn't link to JobOpportunity
        
        # Parse description for skill keywords
        description = (job.description or '') + ' ' + (job.title or '')
        description_lower = description.lower()
        
        # Get all skills from database
        all_skills = Skill.objects.all().values('id', 'name', 'category')
        
        importance_rank = 1
        for skill_data in all_skills:
            skill_name = skill_data['name']
            skill_name_lower = skill_name.lower()
            
            # Simple keyword matching (case-insensitive, whole word)
            pattern = r'\b' + re.escape(skill_name_lower) + r'\b'
            if re.search(pattern, description_lower):
                skills.append({
                    'skill_id': skill_data['id'],
                    'name': skill_name,
                    'category': skill_data['category'] or 'Technical',
                    'is_required': True,
                    'priority': 50,  # Default medium priority
                    'importance_rank': importance_rank,
                    'level': 'intermediate',  # Default expected level
                })
                found_skill_names.add(skill_name_lower)
                importance_rank += 1
        
        # Extract additional skill keywords from description that aren't in DB yet
        extracted_keywords = cls._extract_skill_keywords(description)
        for keyword in extracted_keywords:
            keyword_lower = keyword.lower()
            # Skip if already found
            if keyword_lower in found_skill_names:
                continue
            
            # Try to find existing skill (case-insensitive)
            skill = Skill.objects.filter(name__iexact=keyword).first()
            
            # Create if doesn't exist
            if not skill:
                skill = Skill.objects.create(
                    name=keyword,
                    category='Technical',
                )
            
            skills.append({
                'skill_id': skill.id,
                'name': skill.name,
                'category': skill.category or 'Technical',
                'is_required': True,
                'priority': 45,  # Slightly lower priority for auto-detected
                'importance_rank': importance_rank,
                'level': 'intermediate',
                'auto_detected': True,  # Flag to indicate this was auto-created
            })
            found_skill_names.add(keyword_lower)
            importance_rank += 1
        
        # If no skills found, add some common ones based on job title
        if not skills:
            skills = cls._infer_skills_from_title(job.title)
        
        return skills
    
    @classmethod
    def _extract_skill_keywords(cls, text: str) -> List[str]:
        """
        Extract common technical skill keywords from job description text.
        
        Returns list of skill names that appear in the text.
        """
        # Common technical skills, frameworks, tools, and technologies
        # This is a curated list - could be expanded or moved to database
        common_skills = [
            # Programming Languages
            'Python', 'JavaScript', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust',
            'TypeScript', 'PHP', 'Swift', 'Kotlin', 'R', 'Scala', 'Perl', 'MATLAB',
            # Frontend
            'React', 'Angular', 'Vue.js', 'Vue', 'HTML', 'CSS', 'SCSS', 'Sass',
            'jQuery', 'Bootstrap', 'Tailwind', 'Next.js', 'Nuxt.js',
            # Backend
            'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
            'Ruby on Rails', 'ASP.NET', '.NET', 'Laravel', 'GraphQL', 'REST API',
            # Databases
            'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra',
            'Oracle', 'DynamoDB', 'Elasticsearch', 'SQLite',
            # DevOps & Cloud
            'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Jenkins',
            'GitLab', 'GitHub Actions', 'Terraform', 'Ansible', 'Linux',
            # Data Science & ML
            'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'scikit-learn',
            'Pandas', 'NumPy', 'Data Analysis', 'Statistics', 'NLP', 'Computer Vision',
            # Tools & Other
            'Git', 'Jira', 'Agile', 'Scrum', 'Excel', 'Tableau', 'Power BI',
            'Figma', 'Adobe Photoshop', 'UI/UX', 'API', 'Microservices',
        ]
        
        text_lower = text.lower()
        found_skills = []
        
        for skill in common_skills:
            # Case-insensitive whole word matching
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            if re.search(pattern, text_lower):
                found_skills.append(skill)
        
        return found_skills
    
    @classmethod
    def _infer_skills_from_title(cls, job_title: str) -> List[Dict]:
        """Infer common skills from job title when description parsing finds nothing."""
        from core.models import Skill
        
        title_lower = (job_title or '').lower()
        inferred = []
        
        # Common skill patterns by role
        role_skill_map = {
            'software engineer': ['Python', 'JavaScript', 'Git', 'SQL'],
            'data scientist': ['Python', 'SQL', 'Machine Learning', 'Statistics'],
            'frontend': ['JavaScript', 'React', 'CSS', 'HTML'],
            'backend': ['Python', 'SQL', 'API', 'Docker'],
            'full stack': ['JavaScript', 'Python', 'React', 'SQL'],
            'devops': ['Docker', 'Kubernetes', 'CI/CD', 'Linux'],
            'designer': ['Figma', 'Adobe Photoshop', 'UI/UX'],
            'product manager': ['Agile', 'Jira', 'Product Strategy'],
            'analyst': ['SQL', 'Excel', 'Tableau', 'Python'],
        }
        
        for role, skill_names in role_skill_map.items():
            if role in title_lower:
                for idx, skill_name in enumerate(skill_names, 1):
                    skill = Skill.objects.filter(name__iexact=skill_name).first()
                    if skill:
                        inferred.append({
                            'skill_id': skill.id,
                            'name': skill.name,
                            'category': skill.category or 'Technical',
                            'is_required': True,
                            'priority': 60 - (idx * 5),  # Decreasing priority
                            'importance_rank': idx,
                            'level': 'intermediate',
                        })
                break
        
        return inferred
    
    @classmethod
    def _get_candidate_skills(cls, candidate_profile) -> Dict[int, Dict]:
        """Get candidate's skills as dict keyed by skill_id."""
        from core.models import CandidateSkill
        
        skills = {}
        candidate_skills = CandidateSkill.objects.filter(
            candidate=candidate_profile
        ).select_related('skill')
        
        for cs in candidate_skills:
            skills[cs.skill.id] = {
                'level': cs.level,
                'years': cs.years,
                'name': cs.skill.name,
            }
        
        return skills
    
    @classmethod
    def _compute_gap_severity(
        cls,
        required: bool,
        required_level: Optional[str],
        candidate_level: Optional[str],
        candidate_years: Optional[Decimal],
        job_priority: int
    ) -> int:
        """
        Compute gap severity score (0-100).
        
        Higher score = bigger gap = more important to address.
        """
        if candidate_level is None:
            # Skill completely missing
            base_severity = 100 if required else 70
        else:
            # Skill present, compare levels
            req_level_num = cls.LEVEL_HIERARCHY.get(required_level or 'intermediate', 2)
            cand_level_num = cls.LEVEL_HIERARCHY.get(candidate_level, 1)
            
            level_gap = max(0, req_level_num - cand_level_num)
            
            # Normalize to 0-100 scale
            # 0 gap = 0 severity, 3 levels gap = 90 severity
            base_severity = min(90, level_gap * 30)
            
            # Reduce severity if candidate has experience
            if candidate_years and candidate_years > 0:
                experience_discount = min(20, float(candidate_years) * 5)
                base_severity = max(0, base_severity - experience_discount)
        
        # Adjust by priority (0-100 scale, default 50)
        priority_factor = job_priority / 50.0  # Normalize around 1.0
        final_severity = int(base_severity * priority_factor)
        
        return min(100, max(0, final_severity))
    
    @classmethod
    def _get_learning_resources(
        cls,
        skill_id: int,
        candidate_level: Optional[str],
        limit: int = 3
    ) -> List[Dict]:
        """Get recommended learning resources for a skill."""
        from core.models import LearningResource
        
        # Determine appropriate difficulty
        if candidate_level is None:
            target_difficulty = 'beginner'
        elif candidate_level == 'beginner':
            target_difficulty = 'intermediate'
        else:
            target_difficulty = 'advanced'
        
        # Query resources
        resources = LearningResource.objects.filter(
            skill_id=skill_id,
            is_active=True
        ).order_by('-credibility_score', '-rating')
        
        # Prefer matching difficulty
        matching = list(resources.filter(difficulty_level=target_difficulty)[:limit])
        
        # Fill with other difficulties if needed
        if len(matching) < limit:
            other = list(resources.exclude(difficulty_level=target_difficulty)[:limit - len(matching)])
            matching.extend(other)
        
        # Serialize
        result = []
        for res in matching:
            result.append({
                'id': res.id,
                'title': res.title,
                'provider': res.provider,
                'url': res.url,
                'type': res.resource_type,
                'duration_hours': float(res.duration_hours) if res.duration_hours else None,
                'cost': res.cost_type,
                'difficulty': res.difficulty_level,
                'rating': float(res.rating) if res.rating else None,
            })
        
        return result
    
    @classmethod
    def _build_learning_path(
        cls,
        skill_name: str,
        candidate_level: Optional[str],
        target_level: str,
        resources: List[Dict]
    ) -> List[Dict]:
        """Build a suggested learning path with specific, actionable steps."""
        path = []
        skill_lower = skill_name.lower()
        
        # Skill-specific learning paths with detailed steps
        skill_paths = {
            # Programming Languages
            'python': {
                'beginner_to_intermediate': [
                    ('Master Python syntax, data types, and control flow', 8),
                    ('Learn functions, modules, and OOP concepts', 12),
                    ('Work with file I/O, exceptions, and debugging', 8),
                    ('Build 3 small projects (calculator, todo list, web scraper)', 20),
                ],
                'intermediate_to_advanced': [
                    ('Study advanced OOP, decorators, and generators', 12),
                    ('Learn async programming and concurrency', 10),
                    ('Master testing frameworks (pytest, unittest)', 8),
                    ('Build a REST API with FastAPI or Flask', 25),
                ],
            },
            'javascript': {
                'beginner_to_intermediate': [
                    ('Learn ES6+ syntax, promises, and async/await', 10),
                    ('Master DOM manipulation and event handling', 8),
                    ('Understand closures, prototypes, and scope', 8),
                    ('Build 3 interactive web applications', 20),
                ],
                'intermediate_to_advanced': [
                    ('Deep dive into JS engine, event loop, and performance', 10),
                    ('Master functional programming patterns', 8),
                    ('Learn advanced async patterns and error handling', 8),
                    ('Build a full-stack application with Node.js', 30),
                ],
            },
            'react': {
                'beginner_to_intermediate': [
                    ('Learn React fundamentals: JSX, components, props, state', 10),
                    ('Master hooks (useState, useEffect, useContext, custom hooks)', 12),
                    ('Understand component lifecycle and event handling', 8),
                    ('Build 2-3 React applications (portfolio, dashboard)', 25),
                ],
                'intermediate_to_advanced': [
                    ('Learn state management (Redux, Zustand, or Context API)', 12),
                    ('Master React Router and advanced patterns', 8),
                    ('Optimize performance (memoization, code splitting)', 10),
                    ('Build production app with testing and CI/CD', 30),
                ],
            },
            'sql': {
                'beginner_to_intermediate': [
                    ('Master SELECT, WHERE, JOIN, and aggregation functions', 8),
                    ('Learn database design, normalization, and relationships', 10),
                    ('Practice subqueries, indexes, and query optimization', 10),
                    ('Complete 50+ SQL practice problems on LeetCode/HackerRank', 20),
                ],
                'intermediate_to_advanced': [
                    ('Study window functions, CTEs, and advanced joins', 12),
                    ('Learn stored procedures, triggers, and transactions', 10),
                    ('Master query performance tuning and execution plans', 12),
                    ('Design and implement a complex database schema', 20),
                ],
            },
            'docker': {
                'beginner_to_intermediate': [
                    ('Learn Docker basics: images, containers, Dockerfile', 8),
                    ('Master docker-compose for multi-container apps', 8),
                    ('Understand volumes, networks, and container orchestration', 8),
                    ('Containerize 2-3 existing applications', 15),
                ],
                'intermediate_to_advanced': [
                    ('Learn Docker security best practices', 8),
                    ('Master multi-stage builds and optimization', 8),
                    ('Study Docker in production environments', 10),
                    ('Set up CI/CD pipeline with Docker', 20),
                ],
            },
            'kubernetes': {
                'beginner_to_intermediate': [
                    ('Learn Kubernetes architecture: pods, services, deployments', 12),
                    ('Master kubectl commands and YAML manifests', 10),
                    ('Understand ConfigMaps, Secrets, and persistent volumes', 10),
                    ('Deploy and manage 2-3 applications on K8s', 25),
                ],
                'intermediate_to_advanced': [
                    ('Learn advanced networking and ingress controllers', 12),
                    ('Master Helm charts and package management', 10),
                    ('Study monitoring, logging, and observability', 12),
                    ('Implement production-grade K8s cluster', 30),
                ],
            },
            'git': {
                'beginner_to_intermediate': [
                    ('Master basic commands: clone, add, commit, push, pull', 4),
                    ('Learn branching, merging, and resolving conflicts', 6),
                    ('Understand git workflow and best practices', 5),
                    ('Contribute to 2-3 open source projects', 15),
                ],
                'intermediate_to_advanced': [
                    ('Learn advanced commands: rebase, cherry-pick, reset', 8),
                    ('Master git hooks and automation', 6),
                    ('Study large repository management strategies', 6),
                    ('Set up git workflow for team collaboration', 10),
                ],
            },
        }
        
        # Try to find skill-specific path
        matching_skill = None
        for skill_key in skill_paths.keys():
            if skill_key in skill_lower:
                matching_skill = skill_key
                break
        
        if matching_skill:
            skill_path_data = skill_paths[matching_skill]
            
            if candidate_level is None:
                # Complete beginner - use beginner_to_intermediate path
                steps = skill_path_data.get('beginner_to_intermediate', [])
                for idx, (desc, hours) in enumerate(steps, 1):
                    path.append({
                        'step': idx,
                        'description': desc,
                        'resource': resources[idx - 1] if idx <= len(resources) else None,
                        'estimated_hours': hours,
                    })
            elif candidate_level in ['beginner', 'intermediate']:
                # Use intermediate_to_advanced path
                steps = skill_path_data.get('intermediate_to_advanced', [])
                for idx, (desc, hours) in enumerate(steps, 1):
                    path.append({
                        'step': idx,
                        'description': desc,
                        'resource': resources[idx - 1] if idx <= len(resources) else None,
                        'estimated_hours': hours,
                    })
            else:
                # Advanced - just polish
                path.append({
                    'step': 1,
                    'description': f'Review latest {skill_name} features and best practices',
                    'resource': resources[0] if resources else None,
                    'estimated_hours': 5,
                })
                path.append({
                    'step': 2,
                    'description': f'Build advanced project showcasing {skill_name} expertise',
                    'resource': None,
                    'estimated_hours': 15,
                })
        else:
            # Generic path for skills without specific templates
            if candidate_level is None:
                path.append({
                    'step': 1,
                    'description': f'Complete comprehensive {skill_name} tutorial or course',
                    'resource': resources[0] if resources else None,
                    'estimated_hours': 12,
                })
                path.append({
                    'step': 2,
                    'description': f'Practice {skill_name} fundamentals through exercises',
                    'resource': resources[1] if len(resources) > 1 else None,
                    'estimated_hours': 15,
                })
                path.append({
                    'step': 3,
                    'description': f'Build 2-3 projects demonstrating {skill_name} proficiency',
                    'resource': None,
                    'estimated_hours': 20,
                })
                path.append({
                    'step': 4,
                    'description': f'Get certified or contribute to open source using {skill_name}',
                    'resource': None,
                    'estimated_hours': 15,
                })
            elif candidate_level == 'beginner':
                path.append({
                    'step': 1,
                    'description': f'Study intermediate {skill_name} concepts and patterns',
                    'resource': resources[0] if resources else None,
                    'estimated_hours': 15,
                })
                path.append({
                    'step': 2,
                    'description': f'Apply {skill_name} in real-world scenarios and projects',
                    'resource': None,
                    'estimated_hours': 20,
                })
                path.append({
                    'step': 3,
                    'description': f'Master advanced {skill_name} techniques',
                    'resource': resources[1] if len(resources) > 1 else None,
                    'estimated_hours': 15,
                })
            else:
                path.append({
                    'step': 1,
                    'description': f'Review and update {skill_name} knowledge with latest trends',
                    'resource': resources[0] if resources else None,
                    'estimated_hours': 8,
                })
                path.append({
                    'step': 2,
                    'description': f'Build complex project showcasing expert-level {skill_name} skills',
                    'resource': None,
                    'estimated_hours': 20,
                })
        
        return path
    
    @classmethod
    def _analyze_similar_jobs(cls, job, candidate_profile) -> Dict:
        """Analyze skill gaps across similar job postings."""
        from core.models import JobEntry, Skill
        from django.db.models import Count
        
        # Find similar jobs (same title or industry)
        similar_jobs = JobEntry.objects.filter(
            candidate=candidate_profile
        ).exclude(id=job.id)
        
        # Filter by title similarity (simple: same words in title)
        title_words = set((job.title or '').lower().split())
        similar_by_title = [
            j for j in similar_jobs
            if title_words.intersection(set((j.title or '').lower().split()))
        ]
        
        if not similar_by_title:
            # Fall back to industry
            similar_by_title = list(similar_jobs.filter(industry=job.industry)[:10])
        
        # Extract common skills from those jobs
        common_skills = {}
        for similar_job in similar_by_title[:10]:  # Limit to 10
            job_skills = cls._extract_job_requirements(similar_job)
            for skill in job_skills:
                skill_name = skill['name']
                if skill_name not in common_skills:
                    common_skills[skill_name] = 0
                common_skills[skill_name] += 1
        
        # Get candidate skills
        candidate_skills = cls._get_candidate_skills(candidate_profile)
        candidate_skill_names = {s['name'] for s in candidate_skills.values()}
        
        # Find commonly required but missing skills
        missing_common = []
        for skill_name, count in common_skills.items():
            if skill_name not in candidate_skill_names:
                prevalence = (count / len(similar_by_title)) * 100 if similar_by_title else 0
                missing_common.append({
                    'skill': skill_name,
                    'prevalence_percent': round(prevalence, 1),
                })
        
        # Sort by prevalence
        missing_common.sort(key=lambda x: x['prevalence_percent'], reverse=True)
        
        return {
            'similar_jobs_count': len(similar_by_title),
            'common_missing_skills': missing_common[:5],  # Top 5
        }

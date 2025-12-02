
import re
from dataclasses import dataclass

@dataclass
class Job:
    title: str
    company_name: str
    description: str
    department: str = ""
    role_type: str = ""
    role_title: str = ""

def _derive_role_context(job):
    title_parts = [
        getattr(job, "title", ""),
        getattr(job, "department", ""),
        getattr(job, "role_type", ""),
        getattr(job, "role_title", ""),
    ]
    title_blob = " ".join(part.strip() for part in title_parts if part).lower()
    description_blob = (getattr(job, "description", "") or "").lower()
    combined_blob = f"{title_blob}\n{description_blob}".strip()
    normalized_for_words = combined_blob.replace('-', ' ').replace('/', ' ')
    word_tokens = {
        token for token in re.split(r'[^a-z0-9+#]+', normalized_for_words) if token
    }

    def has_any(tokens):
        if not combined_blob:
            return False, None
        for token in tokens:
            candidate = (token or '').strip().lower()
            if not candidate:
                continue
            variants = {candidate}
            if '-' in candidate:
                variants.add(candidate.replace('-', ' '))
                variants.add(candidate.replace('-', ''))
            if '/' in candidate:
                variants.add(candidate.replace('/', ' '))
                variants.add(candidate.replace('/', ''))
            matched = False
            for variant in variants:
                if not variant:
                    continue
                if ' ' in variant:
                    if variant in combined_blob:
                        matched = True
                        break
                    continue
                
                if variant in word_tokens:
                    matched = True
                    break
                
                # Check for plural form if not found
                if variant + 's' in word_tokens:
                    matched = True
                    break
            if matched:
                return True, token
        return False, None

    backend_tokens = {"backend", "back-end", "api", "infrastructure", "microservice", "microservices", "distributed"}
    frontend_tokens = {"frontend", "front-end", "ui", "ux", "web developer", "web development", "javascript", "react", "angular", "vue", "client-side"}
    data_tokens = {"data engineer", "data platform", "data pipeline", "analytics engineer", "machine learning", "ml engineer", "ml scientist", "ai engineer", "ai scientist", "big data", "etl", "spark", "hadoop"}
    mobile_tokens = {"ios", "android", "mobile", "swift", "kotlin", "react native", "flutter"}
    devops_tokens = {"devops", "sre", "site reliability", "reliability engineer", "infrastructure", "kubernetes", "terraform", "ci/cd", "platform engineer", "observability"}
    security_tokens = {"security engineer", "application security", "appsec", "infosec", "cybersecurity", "penetration tester", "red team", "blue team", "security analyst"}

    engineering_title_tokens = {
        "software engineer",
        "software developer",
        "platform engineer",
        "backend engineer",
        "front end engineer",
        "frontend engineer",
        "full stack",
        "full-stack",
        "fullstack",
        "developer",
        "programmer",
        "coder",
        "devops engineer",
        "sre",
        "site reliability",
        "systems engineer",
        "technical lead",
        "tech lead",
        "architect",
        "solutions architect",
        "cloud engineer",
        "data engineer",
        "data scientist",
        "machine learning engineer",
        "ml engineer",
        "ml scientist",
        "ai engineer",
        "security engineer",
        "qa engineer",
        "sdet",
        "android engineer",
        "ios engineer",
        "mobile engineer",
        "firmware engineer",
        "embedded engineer",
        "technical product manager",
        "technical program manager",
        "technical project manager",
        "solutions engineer",
        "sales engineer",
        "forward deployed engineer",
    }

    non_technical_title_tokens = {
        "program manager",
        "project manager",
        "product manager",
        "business analyst",
        "marketing manager",
        "marketing analyst",
        "sales manager",
        "sales analyst",
        "operations manager",
        "operations analyst",
        "customer success",
        "account manager",
        "customer support",
        "talent acquisition",
        "human resources",
        "people operations",
        "recruiter",
        "scrum master",
        "agile coach",
        "product owner",
    }

    language_tokens = {
        "python",
        "java",
        "javascript",
        "typescript",
        "go",
        "golang",
        "ruby",
        "php",
        "c++",
        "c#",
        "rust",
        "scala",
        "kotlin",
        "swift",
        "react",
        "angular",
        "vue",
        "node.js",
        "nodejs",
        "django",
        "flask",
        "spring",
        "graphql",
        "rest api",
        "restful",
        "sql",
        "postgres",
        "mysql",
        "mongodb",
        "redis",
        "kafka",
        "spark",
        "hadoop",
        "docker",
        "kubernetes",
        "terraform",
        "aws",
        "azure",
        "gcp",
        "cloudformation",
    }

    build_tokens = {
        "build",
        "building",
        "software development",
        "application development",
        "system design",
        "api design",
        "implement",
        "implementing",
        "architect",
        "architecture",
        "code",
        "coding",
        "program",
        "programming",
        "debug",
        "debugging",
        "deploy",
        "deployment",
        "performance optimization",
        "scale systems",
        "automate",
        "automation",
        "microservice",
        "microservices",
        "api",
        "apis",
        "pipeline",
        "pipelines",
        "git",
        "version control",
    }

    non_technical_signal, non_technical_matches = has_any(non_technical_title_tokens)

    context = {
        "is_backend": has_any(backend_tokens)[0],
        "is_frontend": has_any(frontend_tokens)[0],
        "is_data": has_any(data_tokens)[0],
        "is_mobile": has_any(mobile_tokens)[0],
        "is_devops": has_any(devops_tokens)[0],
        "is_security": has_any(security_tokens)[0],
    }

    title_signal, title_matches = has_any(engineering_title_tokens)
    language_signal, language_matches = has_any(language_tokens)
    build_signal, build_matches = has_any(build_tokens)

    context["is_technical_title"] = title_signal
    context["is_technical_description"] = language_signal and build_signal
    functional_signals = any(
        context[key]
        for key in ("is_backend", "is_frontend", "is_data", "is_mobile", "is_devops", "is_security")
    )
    context["is_technical"] = bool(
        title_signal or context["is_technical_description"] or functional_signals
    )

    context["non_technical_title"] = non_technical_signal
    
    if non_technical_signal and not title_signal and not context["is_technical_description"]:
        context["is_technical_title"] = False
        context["is_technical_description"] = False
        context["is_technical"] = False
    
    print(f"Title Signal: {title_signal} Matches: {title_matches}")
    print(f"Language Signal: {language_signal} Matches: {language_matches}")
    print(f"Build Signal: {build_signal} Matches: {build_matches}")
    print(f"Non-Technical Signal: {non_technical_signal} Matches: {non_technical_matches}")
    print(f"Functional Signals: {functional_signals}")
    print(f"Is Technical: {context['is_technical']}")
    return context

description = """The Business Process Analyst will serve a key role in ensuring successful hardware support delivery. This individual will own design, documentation and implementation of collaborative processes within key strategic programs. They will immerse in the business functions of key stakeholders to ensure their requirements are met. They will coordinate documentation and communication to ensure stakeholder readiness. They will continuously audit existing workflows to identify opportunities for automation and other efficiencies. Ideal candidate has additional background in data analysis and application development to streamline delivery of actionable information and business insights. They must demonstrate the ability to communicate for impact at an executive level in both written and verbal form. They have demonstrated a willingness to embrace ambiguity as projects are processes are formed. Responsibilities Business Process Analysis & Optimization Analyze, document, and improve existing business processes across departments to enhance efficiency and effectiveness. Identify gaps, redundancies, and bottlenecks in workflows and recommend data-driven solutions. Program Management Lead cross-functional programs from initiation through execution, ensuring alignment with strategic goals. Develop and manage detailed project plans, timelines, and resource allocations. Monitor program performance and proactively address risks, issues, and dependencies. Successfully navigate reactive change management. Stakeholder Engagement & Communication Serve as a liaison between business units, technical teams, and leadership to ensure clear understanding of goals and requirements. Facilitate meetings and presentations to gather input, share progress, and drive consensus. Build stron"""

job = Job(title="Business Process Analyst", company_name="Test Company", description=description)
_derive_role_context(job)

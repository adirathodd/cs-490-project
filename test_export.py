#!/usr/bin/env python3
"""
Test script to check what's being extracted from LaTeX
"""

import re

# Sample LaTeX from Jake's Resume template
sample_latex = r"""
\documentclass[letterpaper,11pt]{article}

\begin{document}

\begin{center}
    \textbf{\Huge \scshape John Doe} \\ \vspace{1pt}
    {\small (555) 123-4567 $|$ \href{mailto:john@example.com}{\underline{john@example.com}} $|$ San Francisco, CA }
\end{center}

\section{Summary}
\resumeSubHeadingListStart
\resumeItem{\textbf{Senior Software Engineer} -- Experienced full-stack developer with 5+ years building scalable web applications}
\resumeSubHeadingListEnd

\section{Education}
\resumeSubHeadingListStart
\resumeSubheading{Stanford University}{2015 - 2019}{Bachelor of Science in Computer Science}{Stanford, CA}
\resumeSubHeadingListEnd

\section{Experience}
\resumeSubHeadingListStart
\resumeSubheading{Senior Software Engineer}{Jan 2020 - Present}{Tech Company}{San Francisco, CA}
\resumeItemListStart
\resumeItem{Built microservices architecture serving 1M+ users}
\resumeItem{Led team of 5 engineers in developing new features}
\resumeItem{Improved system performance by 40\% through optimization}
\resumeItemListEnd

\resumeSubheading{Software Engineer}{Jun 2019 - Dec 2019}{Startup Inc}{Palo Alto, CA}
\resumeItemListStart
\resumeItem{Developed RESTful APIs using Python and Django}
\resumeItem{Implemented automated testing reducing bugs by 30\%}
\resumeItemListEnd
\resumeSubHeadingListEnd

\section{Projects}
\resumeSubHeadingListStart
\resumeProjectHeading{\textbf{E-commerce Platform} $|$ \emph{React, Node.js, MongoDB}}{2024}
\resumeItemListStart
\resumeItem{Built full-stack e-commerce application with payment processing}
\resumeItem{Implemented real-time inventory management system}
\resumeItemListEnd
\resumeSubHeadingListEnd

\section{Technical Skills}
\resumeSubHeadingListStart
\resumeItem{Languages: Python, JavaScript, TypeScript, Java, SQL}
\resumeItem{Frameworks: React, Django, Node.js, Express, Spring Boot}
\resumeItem{Tools: Git, Docker, Kubernetes, AWS, PostgreSQL}
\resumeSubHeadingListEnd

\end{document}
"""

def clean_latex(text):
    """Remove LaTeX commands and clean text"""
    text = re.sub(r'\\textbf\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\textit\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\emph\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\underline\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\href\{[^}]*\}\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\scshape\s+', '', text)
    text = re.sub(r'\\Huge\s+', '', text)
    text = re.sub(r'\\Large\s+', '', text)
    text = re.sub(r'\\large\s+', '', text)
    text = re.sub(r'\\small\s+', '', text)
    text = re.sub(r'\\\\\s*', ' ', text)
    text = re.sub(r'\\vspace\{[^}]*\}', '', text)
    text = re.sub(r'\$\|?\$', '|', text)
    text = re.sub(r'\\[a-zA-Z]+\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    return text.strip()

# Test extraction
print("=" * 60)
print("TESTING LATEX EXTRACTION")
print("=" * 60)

# Extract name
name_match = re.search(r'\\textbf\{\\Huge\s+\\scshape\s+([^}]+)\}', sample_latex, re.IGNORECASE)
if name_match:
    print(f"\n✓ Name: {clean_latex(name_match.group(1))}")
else:
    print("\n✗ Name: NOT FOUND")

# Extract contact
contact_line_match = re.search(r'\{\\small\s+(.+?)\}', sample_latex)
if contact_line_match:
    contact_line = contact_line_match.group(1)
    email_match = re.search(r'mailto:([^\}]+)\}', contact_line)
    phone_match = re.search(r'(\+?[\d\s\(\)\-\.]{10,})', contact_line)
    print(f"✓ Email: {email_match.group(1) if email_match else 'NOT FOUND'}")
    print(f"✓ Phone: {phone_match.group(1) if phone_match else 'NOT FOUND'}")

# Extract summary
summary_match = re.search(r'\\section\{Summary\}(.+?)(?=\\section|\\end\{document\})', sample_latex, re.DOTALL | re.IGNORECASE)
if summary_match:
    item_match = re.search(r'\\resumeItem\{(.+?)\}', summary_match.group(1), re.DOTALL)
    if item_match:
        print(f"\n✓ Summary: {clean_latex(item_match.group(1))[:80]}...")

# Extract education
education_match = re.search(r'\\section\{Education\}(.+?)(?=\\section|\\end\{document\})', sample_latex, re.DOTALL | re.IGNORECASE)
if education_match:
    edu_entries = re.findall(r'\\resumeSubheading\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}', education_match.group(1))
    print(f"\n✓ Education entries found: {len(edu_entries)}")
    for entry in edu_entries:
        print(f"  - {clean_latex(entry[2])} at {clean_latex(entry[0])}")

# Extract experience
experience_match = re.search(r'\\section\{Experience\}(.+?)(?=\\section|\\end\{document\})', sample_latex, re.DOTALL | re.IGNORECASE)
if experience_match:
    exp_blocks = re.findall(r'\\resumeSubheading\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}(.+?)(?=\\resumeSubheading|\\resumeSubHeadingListEnd)', experience_match.group(1), re.DOTALL)
    print(f"\n✓ Experience entries found: {len(exp_blocks)}")
    for block in exp_blocks:
        bullets = re.findall(r'\\resumeItem\{(.+?)\}', block[4], re.DOTALL)
        print(f"  - {clean_latex(block[0])} at {clean_latex(block[2])} ({len(bullets)} bullets)")

# Extract projects
projects_match = re.search(r'\\section\{Projects\}(.+?)(?=\\section|\\end\{document\})', sample_latex, re.DOTALL | re.IGNORECASE)
if projects_match:
    proj_blocks = re.findall(r'\\resumeProjectHeading\{(.+?)\}\{([^}]*)\}(.+?)(?=\\resumeProjectHeading|\\resumeSubHeadingListEnd)', projects_match.group(1), re.DOTALL)
    print(f"\n✓ Project entries found: {len(proj_blocks)}")
    for block in proj_blocks:
        bullets = re.findall(r'\\resumeItem\{(.+?)\}', block[2], re.DOTALL)
        print(f"  - {clean_latex(block[0])[:40]} ({len(bullets)} bullets)")

# Extract skills
skills_match = re.search(r'\\section\{Technical\s+Skills\}(.+?)(?=\\section|\\end\{document\})', sample_latex, re.DOTALL | re.IGNORECASE)
if skills_match:
    skill_items = re.findall(r'\\resumeItem\{(.+?)\}', skills_match.group(1), re.DOTALL)
    print(f"\n✓ Skills categories found: {len(skill_items)}")
    for item in skill_items:
        clean_item = clean_latex(item)
        if ':' in clean_item:
            category = clean_item.split(':', 1)[0]
            print(f"  - {category}")

print("\n" + "=" * 60)
print("If you see content above, the extraction is working!")
print("=" * 60)

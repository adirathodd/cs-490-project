/* eslint-disable no-useless-escape */
import React from 'react';
import './LaTeXRenderer.css';

/**
 * LaTeXRenderer Component
 * Parses LaTeX resume content and renders it in a clean, formatted way
 */
const LaTeXRenderer = ({ latexContent }) => {
  /**
   * Parse LaTeX content into structured sections
   */
  const parseLatexContent = (content) => {
    if (!content) return null;

    console.log('LaTeX Content received:', content.substring(0, 500)); // Debug

    const sections = [];
    
    // Remove LaTeX document wrapper and preamble
    let cleanContent = content
      .replace(/\\documentclass\{[^\}]+\}/g, '')
      .replace(/\\usepackage(\[[^\]]*\])?\{[^\}]+\}/g, '')
      .replace(/\\begin\{document\}/g, '')
      .replace(/\\end\{document\}/g, '')
      .replace(/\\maketitle/g, '')
      .trim();

    // Extract personal info section (name, contact)
    const nameMatch = cleanContent.match(/\\name\{([^\}]+)\}/);
    const emailMatch = cleanContent.match(/\\email\{([^\}]+)\}/);
    const phoneMatch = cleanContent.match(/\\phone\{([^\}]+)\}/);
    const linkedinMatch = cleanContent.match(/\\linkedin\{([^\}]+)\}/);
    const githubMatch = cleanContent.match(/\\github\{([^\}]+)\}/);
    const websiteMatch = cleanContent.match(/\\website\{([^\}]+)\}/);
    
    if (nameMatch || emailMatch || phoneMatch) {
      sections.push({
        type: 'header',
        name: nameMatch ? nameMatch[1] : '',
        email: emailMatch ? emailMatch[1] : '',
        phone: phoneMatch ? phoneMatch[1] : '',
        linkedin: linkedinMatch ? linkedinMatch[1] : '',
        github: githubMatch ? githubMatch[1] : '',
        website: websiteMatch ? websiteMatch[1] : ''
      });
    }

    // Extract sections - look for plain text headers (like "Summary", "Projects", "Experience")
    // Split by lines and find lines that look like section headers
    const lines = cleanContent.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line is a section header (standalone capitalized word(s))
      // Common sections: Summary, Projects, Experience, Education, Skills, etc.
      if (line && /^[A-Z][a-zA-Z\s]{0,30}$/.test(line) && 
          !line.includes('\\') && 
          line.length < 50) {
        
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections.push({
            type: 'section',
            title: currentSection,
            content: parseSectionContent(currentContent.join('\n'))
          });
        }
        
        // Start new section
        currentSection = line;
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections.push({
        type: 'section',
        title: currentSection,
        content: parseSectionContent(currentContent.join('\n'))
      });
    }
    
    // Fallback: If no sections found, try \section{} command
    if (sections.length === 0 || (sections.length === 1 && sections[0].type === 'header')) {
      const sectionRegex = /\\section\{([^\}]+)\}([\s\S]*?)(?=\\section\{|$)/g;
      let match;
      
      while ((match = sectionRegex.exec(cleanContent)) !== null) {
        const title = match[1];
        const content = match[2].trim();
        
        if (title && content) {
          sections.push({
            type: 'section',
            title: title,
            content: parseSectionContent(content)
          });
        }
      }
    }

    console.log('Parsed sections:', sections); // Debug
    return sections.length > 0 ? sections : null;
  };

  /**
   * Parse content within a section (items, subsections)
   */
  const parseSectionContent = (content) => {
    const items = [];
    
    // Remove list wrapper commands
    content = content
      .replace(/\\resumeSubHeadingListStart/g, '')
      .replace(/\\resumeSubHeadingListEnd/g, '')
      .replace(/\\resumeItemListStart/g, '')
      .replace(/\\resumeItemListEnd/g, '');
    
    // Parse \resumeSubheading{Title}{Date}{Company}{Location}
    const subheadingRegex = /\\resumeSubheading\{([^\}]+)\}\{([^\}]*)\}\{([^\}]+)\}\{([^\}]*)\}([\s\S]*?)(?=\\resumeSubheading|\\resumeProjectHeading|$)/g;
    let match;
    
    while ((match = subheadingRegex.exec(content)) !== null) {
      const title = match[1];
      const date = match[2];
      const company = match[3];
      const location = match[4];
      const body = match[5].trim();
      
      // Extract bullet points from \resumeItem{}
      const bullets = [];
      const itemRegex = /\\resumeItem\{([^\}]+(?:\{[^\}]*\}[^\}]*)*)\}/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(body)) !== null) {
        bullets.push(itemMatch[1].trim());
      }
      
      items.push({
        type: 'subsection',
        subtitle: title,
        date: date,
        location: location,
        company: company,
        description: '',
        bullets: bullets
      });
    }
    
    // Parse \resumeProjectHeading{Project Name}{Date or other info}
    const projectRegex = /\\resumeProjectHeading\{([^\}]+)\}\{([^\}]*)\}([\s\S]*?)(?=\\resumeProjectHeading|\\resumeSubheading|$)/g;
    
    while ((match = projectRegex.exec(content)) !== null) {
      const projectName = match[1];
      const projectInfo = match[2];
      const body = match[3].trim();
      
      // Extract bullet points
      const bullets = [];
      const itemRegex = /\\resumeItem\{([^\}]+(?:\{[^\}]*\}[^\}]*)*)\}/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(body)) !== null) {
        bullets.push(itemMatch[1].trim());
      }
      
      items.push({
        type: 'subsection',
        subtitle: projectName,
        date: projectInfo,
        location: '',
        company: '',
        description: '',
        bullets: bullets
      });
    }
    
    // Parse standalone \resumeItem{} (for summary sections, skills, etc.)
    if (items.length === 0) {
      const bullets = [];
      const itemRegex = /\\resumeItem\{([^\}]+(?:\{[^\}]*\}[^\}]*)*)\}/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(content)) !== null) {
        bullets.push(itemMatch[1].trim());
      }
      
      if (bullets.length > 0) {
        items.push({
          type: 'plain',
          text: '',
          bullets: bullets
        });
      }
    }
    
    // Fallback: Parse standard \subsection{} if present
    if (items.length === 0) {
      const subsectionRegex = /\\subsection\{([^\}]+)\}([\s\S]*?)(?=\\subsection\{|$)/g;
      
      while ((match = subsectionRegex.exec(content)) !== null) {
        const subtitle = match[1];
        const body = match[2].trim();
        
        // Extract dates if present
        const dateMatch = body.match(/\\dates?\{([^\}]+)\}/);
        const locationMatch = body.match(/\\location\{([^\}]+)\}/);
        
        // Extract bullet points
        const bullets = [];
        const itemizeMatch = body.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
        if (itemizeMatch) {
          const itemRegex = /\\item\s+([^\n\\]+)/g;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(itemizeMatch[1])) !== null) {
            bullets.push(itemMatch[1].trim());
          }
        }
        
        // Extract plain text description
        let description = body
          .replace(/\\dates?\{[^\}]+\}/g, '')
          .replace(/\\location\{[^\}]+\}/g, '')
          .replace(/\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/g, '')
          .replace(/\\\\/g, ' ')
          .trim();
        
        items.push({
          type: 'subsection',
          subtitle: subtitle,
          date: dateMatch ? dateMatch[1] : '',
          location: locationMatch ? locationMatch[1] : '',
          company: '',
          description: description,
          bullets: bullets
        });
      }
    }
    
    // Fallback: Plain text or itemize list
    if (items.length === 0) {
      const bullets = [];
      const itemizeMatch = content.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
      if (itemizeMatch) {
        const itemRegex = /\\item\s+([^\n\\]+)/g;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(itemizeMatch[1])) !== null) {
          bullets.push(itemMatch[1].trim());
        }
      }
      
      const plainText = content
        .replace(/\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/g, '')
        .replace(/\\\\/g, '\n')
        .replace(/\\textbf\{([^\}]+)\}/g, '<strong>$1</strong>')
        .replace(/\\textit\{([^\}]+)\}/g, '<em>$1</em>')
        .replace(/\\emph\{([^\}]+)\}/g, '<em>$1</em>')
        .trim();
      
      if (bullets.length > 0 || plainText) {
        items.push({
          type: 'plain',
          text: plainText,
          bullets: bullets
        });
      }
    }
    
    return items;
  };

  /**
   * Format text with LaTeX commands converted to HTML
   */
  const formatText = (text) => {
    if (!text) return '';
    
    return text
      // Handle nested braces and incomplete braces
      .replace(/\\textbf\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g, '<strong>$1</strong>')
      .replace(/\\textbf\{([^}]*)/g, '<strong>$1</strong>') // Handle unclosed braces
      .replace(/\\textit\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g, '<em>$1</em>')
      .replace(/\\textit\{([^}]*)/g, '<em>$1</em>') // Handle unclosed braces
      .replace(/\\emph\{([^\}]+)\}/g, '<em>$1</em>')
      .replace(/\\url\{([^\}]+)\}/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\\href\{([^\}]+)\}\{([^\}]+)\}/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>')
      .replace(/\\_/g, '_')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/\\$/g, '$')
      .replace(/\s*--\s*/g, ' – '); // Convert -- to proper en-dash with spacing
  };

  const parsedContent = parseLatexContent(latexContent);

  if (!parsedContent) {
    console.error('Failed to parse LaTeX content');
    return (
      <div className="latex-renderer-error">
        <p>Unable to parse resume content</p>
        <details>
          <summary>Show raw content</summary>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
            {latexContent}
          </pre>
        </details>
      </div>
    );
  }

  if (parsedContent.length === 0) {
    console.warn('No sections found in LaTeX content');
    return (
      <div className="latex-renderer-error">
        <p>No content sections found in resume</p>
        <details>
          <summary>Show raw content</summary>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
            {latexContent}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="latex-renderer">
      {parsedContent.map((section, idx) => {
        if (section.type === 'header') {
          return (
            <div key={idx} className="resume-header">
              {section.name && <h1 className="resume-name">{section.name}</h1>}
              <div className="contact-info">
                {section.email && (
                  <span className="contact-item">
                    <a href={`mailto:${section.email}`}>{section.email}</a>
                  </span>
                )}
                {section.phone && (
                  <span className="contact-item">{section.phone}</span>
                )}
                {section.linkedin && (
                  <span className="contact-item">
                    <a href={section.linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                  </span>
                )}
                {section.github && (
                  <span className="contact-item">
                    <a href={section.github} target="_blank" rel="noopener noreferrer">
                      GitHub
                    </a>
                  </span>
                )}
                {section.website && (
                  <span className="contact-item">
                    <a href={section.website} target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  </span>
                )}
              </div>
            </div>
          );
        }

        if (section.type === 'section') {
          return (
            <div key={idx} className="resume-section-block">
              <h2 className="section-title">{section.title}</h2>
              <div className="section-content">
                {section.content.map((item, itemIdx) => {
                  if (item.type === 'subsection') {
                    return (
                      <div key={itemIdx} className="subsection-item">
                        <div className="subsection-header">
                          <div className="subsection-title-wrapper">
                            <h3 
                              className="subsection-title"
                              dangerouslySetInnerHTML={{ __html: formatText(item.subtitle) }}
                            />
                            {(item.company || item.location) && (
                              <div className="subsection-meta">
                                {item.company && (
                                  <span 
                                    className="subsection-company"
                                    dangerouslySetInnerHTML={{ __html: formatText(item.company) }}
                                  />
                                )}
                                {item.location && (
                                  <span 
                                    className="subsection-location"
                                    dangerouslySetInnerHTML={{ __html: formatText(item.location) }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          {item.date && (
                            <span className="subsection-date">{item.date}</span>
                          )}
                        </div>
                        {item.description && (
                          <p 
                            className="subsection-description"
                            dangerouslySetInnerHTML={{ __html: formatText(item.description) }}
                          />
                        )}
                        {item.bullets.length > 0 && (
                          <ul className="subsection-bullets">
                            {item.bullets.map((bullet, bulletIdx) => (
                              <li 
                                key={bulletIdx}
                                dangerouslySetInnerHTML={{ __html: formatText(bullet) }}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  }

                  if (item.type === 'plain') {
                    return (
                      <div key={itemIdx} className="plain-content">
                        {item.text && (
                          <p 
                            className="plain-text"
                            dangerouslySetInnerHTML={{ __html: formatText(item.text) }}
                          />
                        )}
                        {item.bullets.length > 0 && (
                          <ul className="plain-bullets">
                            {item.bullets.map((bullet, bulletIdx) => (
                              <li 
                                key={bulletIdx}
                                dangerouslySetInnerHTML={{ __html: formatText(bullet) }}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default LaTeXRenderer;

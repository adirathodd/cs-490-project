import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

// GuidanceRenderer: render backend guidance (which may include **bold**, lists, and paragraphs)
// Use `react-markdown` with `rehype-sanitize` to safely render markdown-like backend text.
const GuidanceRenderer = ({ text, className = '' }) => {
  return (
    <div className={className}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>{text || ''}</ReactMarkdown>
    </div>
  );
};

export default GuidanceRenderer;

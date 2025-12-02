import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// GuidanceRenderer: render backend guidance (which may include **bold**, lists, and paragraphs)
const GuidanceRenderer = ({ text, className = '' }) => {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ''}</ReactMarkdown>
    </div>
  );
};

export default GuidanceRenderer;

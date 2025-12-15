import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './RichTextEditor.css';
import { sanitizeRichText } from '../../utils/sanitizeRichText';

const toolbarActions = [
  { command: 'bold', label: 'B', aria: 'Bold', className: 'bold' },
  { command: 'italic', label: 'I', aria: 'Italic', className: 'italic' },
  { command: 'underline', label: 'U', aria: 'Underline', className: 'underline' },
  { command: 'insertUnorderedList', label: '•', aria: 'Bulleted list', className: 'bullet' },
  { command: 'insertOrderedList', label: '1.', aria: 'Numbered list', className: 'numbered' },
  { command: 'removeFormat', label: 'Clear', aria: 'Remove formatting', className: 'clear' },
];

const RichTextEditor = ({ id, label, value, onChange, placeholder }) => {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    const sanitized = sanitizeRichText(value || '');
    if (sanitized !== sanitizeRichText(editorRef.current.innerHTML || '')) {
      editorRef.current.innerHTML = sanitized;
    }
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const sanitized = sanitizeRichText(editorRef.current.innerHTML || '');
    onChange?.(sanitized);
  };

  const handleInput = () => {
    emitChange();
  };

  const handleBlur = () => {
    setIsFocused(false);
    emitChange();
  };

  const applyCommand = (command) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        document.execCommand(command, false, null);
      }
    } catch (_) {
      // Ignore unsupported commands in non-browser test environments
    }
    emitChange();
  };

  return (
    <div className="rich-text-editor">
      {label && (
        <label htmlFor={id}>
          {label}
        </label>
      )}
      <div className="rte-toolbar" role="toolbar" aria-label={`${label || 'Rich text'} formatting options`}>
        {toolbarActions.map((btn) => (
          <button
            type="button"
            key={btn.command}
            className={`rte-btn ${btn.className}`}
            onClick={() => applyCommand(btn.command)}
            aria-label={btn.aria}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div
        id={id}
        className={`rte-content ${isFocused ? 'focus' : ''}`}
        contentEditable
        ref={editorRef}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        data-placeholder={placeholder || 'Describe the value this certification adds'}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
      />
    </div>
  );
};

RichTextEditor.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
};

RichTextEditor.defaultProps = {
  label: '',
  value: '',
  onChange: undefined,
  placeholder: '',
};

export default RichTextEditor;

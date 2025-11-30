const React = require('react');

function ReactMarkdown(props) {
  // If tests pass `children`, render them; otherwise render source as plain text.
  if (props.children) return React.createElement('div', null, props.children);
  if (props.source) return React.createElement('div', null, props.source);
  return React.createElement('div', null, null);
}

module.exports = ReactMarkdown;

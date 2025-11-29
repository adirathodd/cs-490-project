const React = require('react');

function ReactMarkdownMock(props) {
  return React.createElement('div', null, props.children);
}

module.exports = ReactMarkdownMock;
module.exports.__esModule = true;
module.exports.default = ReactMarkdownMock;

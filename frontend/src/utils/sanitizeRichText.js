const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'a',
  'span',
]);

const ALLOWED_ATTRS = {
  a: ['href', 'target', 'rel'],
  span: ['class'],
};

const sanitizeAttributes = (element) => {
  const allowed = ALLOWED_ATTRS[element.tagName.toLowerCase()] || [];
  Array.from(element.attributes).forEach((attr) => {
    if (!allowed.includes(attr.name.toLowerCase())) {
      element.removeAttribute(attr.name);
      return;
    }
    if (attr.name.toLowerCase() === 'href') {
      const value = attr.value || '';
      if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('mailto:')) {
        element.removeAttribute(attr.name);
      } else {
        element.setAttribute('rel', 'noreferrer');
        element.setAttribute('target', '_blank');
      }
    }
  });
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const sanitizeNode = (node) => {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === TEXT_NODE) {
      return;
    }
    if (child.nodeType !== ELEMENT_NODE) {
      node.removeChild(child);
      return;
    }
    const tagName = child.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      while (child.firstChild) {
        node.insertBefore(child.firstChild, child);
      }
      node.removeChild(child);
      return;
    }
    sanitizeAttributes(child);
    sanitizeNode(child);
  });
};

export const sanitizeRichText = (html) => {
  if (!html || typeof html !== 'string') return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML.trim();
};

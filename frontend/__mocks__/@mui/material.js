import React from 'react';

// Filter out MUI-specific props that shouldn't be passed to DOM elements
const MUI_PROPS = [
  'alignItems', 'alignContent', 'justifyContent', 'flexDirection', 'flexWrap',
  'container', 'item', 'spacing', 'xs', 'sm', 'md', 'lg', 'xl',
  'textAlign', 'fontWeight', 'variant', 'color', 'component',
  'mb', 'mt', 'ml', 'mr', 'mx', 'my', 'p', 'pt', 'pb', 'pl', 'pr', 'px', 'py',
  'gap', 'display', 'sx'
];

const filterProps = (props) => {
  const filtered = {};
  Object.keys(props).forEach(key => {
    if (!MUI_PROPS.includes(key)) {
      filtered[key] = props[key];
    }
  });
  return filtered;
};

// Mock Material-UI components with simple div wrappers
const createMockComponent = (name) => {
  return React.forwardRef(({ children, ...props }, ref) => (
    <div ref={ref} data-testid={name} {...filterProps(props)}>
      {children}
    </div>
  ));
};

export const Box = createMockComponent('Box');
export const Container = createMockComponent('Container');
export const Typography = ({ children, ...props }) => <span {...filterProps(props)}>{children}</span>;
export const Paper = createMockComponent('Paper');
export const Card = createMockComponent('Card');
export const CardContent = createMockComponent('CardContent');
export const CardHeader = ({ title, subheader, ...props }) => (
  <div {...props}>
    <div>{title}</div>
    {subheader && <div>{subheader}</div>}
  </div>
);
export const Grid = createMockComponent('Grid');
export const Tabs = ({ children, value, onChange, ...props }) => (
  <div {...props}>
    {React.Children.map(children, (child, index) => 
      React.cloneElement(child, { onClick: () => onChange({}, index) })
    )}
  </div>
);
export const Tab = ({ label, ...props }) => <button role="tab" {...props}>{label}</button>;
export const Button = ({ children, onClick, ...props }) => (
  <button onClick={onClick} {...props}>{children}</button>
);
export const IconButton = ({ children, onClick, ...props }) => (
  <button onClick={onClick} {...props}>{children}</button>
);
export const Chip = ({ label, ...props }) => <span {...props}>{label}</span>;
export const Alert = ({ children, severity, ...props }) => (
  <div role="alert" data-severity={severity} {...props}>{children}</div>
);
export const CircularProgress = (props) => <div role="progressbar" {...props} />;
export const LinearProgress = ({ value, ...props }) => (
  <div role="progressbar" aria-valuenow={value} {...props} />
);
export const Select = ({ children, value, onChange, ...props }) => (
  <select value={value} onChange={(e) => onChange(e)} {...props}>{children}</select>
);
export const MenuItem = ({ children, value, ...props }) => (
  <option value={value} {...props}>{children}</option>
);
export const FormControl = createMockComponent('FormControl');
export const InputLabel = ({ children, ...props }) => <label {...props}>{children}</label>;
export const Table = createMockComponent('Table');
export const TableBody = createMockComponent('TableBody');
export const TableCell = createMockComponent('TableCell');
export const TableContainer = createMockComponent('TableContainer');
export const TableHead = createMockComponent('TableHead');
export const TableRow = createMockComponent('TableRow');
export const TablePagination = ({ count, page, rowsPerPage, onPageChange, ...props }) => (
  <div {...props}>
    <button onClick={(e) => onPageChange(e, page - 1)}>Previous</button>
    <span>Page {page + 1}</span>
    <button onClick={(e) => onPageChange(e, page + 1)}>Next</button>
  </div>
);
export const Dialog = ({ open, onClose, children, ...props }) => 
  open ? <div role="dialog" {...props}>{children}</div> : null;
export const DialogTitle = ({ children, ...props }) => <h2 {...props}>{children}</h2>;
export const DialogContent = createMockComponent('DialogContent');
export const DialogActions = createMockComponent('DialogActions');
export const Collapse = ({ in: isOpen, children, ...props }) => 
  isOpen ? <div {...props}>{children}</div> : null;
export const Divider = (props) => <hr {...props} />;
export const List = createMockComponent('List');
export const ListItem = createMockComponent('ListItem');
export const ListItemText = ({ primary, secondary, ...props }) => (
  <div {...props}>
    <div>{primary}</div>
    {secondary && <div>{secondary}</div>}
  </div>
);
export const Badge = ({ badgeContent, children, ...props }) => (
  <span {...props}>
    {children}
    {badgeContent && <span>{badgeContent}</span>}
  </span>
);
export const Tooltip = ({ title, children, ...props }) => (
  <span title={title} {...props}>{children}</span>
);
export const Stack = createMockComponent('Stack');
export const TextField = ({ label, value, onChange, ...props }) => (
  <div>
    {label && <label>{label}</label>}
    <input value={value} onChange={onChange} {...props} />
  </div>
);

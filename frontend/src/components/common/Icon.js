import React from 'react';
import {
  FaUser,
  FaSignOutAlt,
  FaEdit,
  FaHome,
  FaBriefcase,
  FaGraduationCap,
  FaMedal,
  FaPuzzlePiece,
  FaFolderOpen,
  FaCamera,
  FaTrashAlt,
  FaInfoCircle,
  FaUpload,
  FaSearch,
  FaSpinner,
  FaCalendarAlt,
  FaLink,
  FaMapMarkerAlt,
  FaUsers,
  FaLightbulb,
  FaEye,
  FaTimesCircle,
  FaDownload,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,
  FaArchive,
  FaHistory,
  FaFile,
  FaFileAlt,
  FaFilter,
  FaMagic,
  FaSyncAlt,
  FaClipboard,
  FaCheck,
  FaGripVertical,
  FaDollarSign,
  FaChartLine,
  FaUndo,
  FaRedo,
  FaClock,
  FaCheckCircle,
  FaArrowRight,
  FaThumbsUp,
  FaKeyboard,
  FaFont,
  FaChartBar,
  FaBolt,
  FaTimes,
  FaPlus,
  FaExclamationCircle,
  FaEnvelope,
  FaAlignLeft,
  FaBook,
  FaPen,
} from 'react-icons/fa';

// Simple, centralized Icon wrapper used across the app.
// Props:
// - name: logical icon name (string)
// - size: 'sm'|'md'|'lg'|'xl' or number (px)
// - color: css color string
// - className: additional class names
// - ariaLabel: accessible label
const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

const iconMap = {
  user: FaUser,
  signout: FaSignOutAlt,
  edit: FaEdit,
  'edit-3': FaPen,
  home: FaHome,
  briefcase: FaBriefcase,
  education: FaGraduationCap,
  cert: FaMedal,
  project: FaPuzzlePiece,
  folder: FaFolderOpen,
  camera: FaCamera,
  trash: FaTrashAlt,
  'trash-2': FaTrashAlt,
  info: FaInfoCircle,
  upload: FaUpload,
  search: FaSearch,
  spinner: FaSpinner,
  calendar: FaCalendarAlt,
  link: FaLink,
  users: FaUsers,
  location: FaMapMarkerAlt,
  idea: FaLightbulb,
  lightbulb: FaLightbulb,
  eye: FaEye,
  clear: FaTimesCircle,
  x: FaTimes,
  download: FaDownload,
  chevronLeft: FaChevronLeft,
  'chevron-left': FaChevronLeft,
  chevronRight: FaChevronRight,
  'chevron-right': FaChevronRight,
  chevronDown: FaChevronDown,
  'chevron-down': FaChevronDown,
  chevronUp: FaChevronUp,
  'chevron-up': FaChevronUp,
  archive: FaArchive,
  restore: FaHistory,
  file: FaFile,
  'file-text': FaFileAlt,
  filter: FaFilter,
  sparkles: FaMagic,
  refresh: FaSyncAlt,
  'refresh-cw': FaSyncAlt,
  clipboard: FaClipboard,
  check: FaCheck,
  grip: FaGripVertical,
  dollar: FaDollarSign,
  chart: FaChartLine,
  'corner-up-left': FaUndo,
  undo: FaUndo,
  'corner-up-right': FaRedo,
  redo: FaRedo,
  clock: FaClock,
  'check-circle': FaCheckCircle,
  'arrow-right': FaArrowRight,
  'thumbs-up': FaThumbsUp,
  type: FaKeyboard,
  'bar-chart': FaChartBar,
  zap: FaBolt,
  plus: FaPlus,
  'alert-circle': FaExclamationCircle,
  mail: FaEnvelope,
  'align-left': FaAlignLeft,
  book: FaBook,
  activity: FaChartLine,
};

export default function Icon({ name, size = 'md', color, className = '', ariaLabel, ...rest }) {
  const px = typeof size === 'number' ? size : (sizeMap[size] || sizeMap.md);
  const Comp = iconMap[name];
  if (!Comp) return <span className={`icon ${className}`} style={{ fontSize: px, color }} aria-hidden={!ariaLabel} {...rest} />;

  return (
    <span
      className={`icon ${className}`}
      style={{ width: px, height: px, fontSize: px, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color }}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      {...rest}
    >
      <Comp />
    </span>
  );
}

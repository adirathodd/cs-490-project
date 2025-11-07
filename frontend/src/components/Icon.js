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
  FaArchive,
  FaHistory,
  FaFile,
  FaFileAlt
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
  home: FaHome,
  briefcase: FaBriefcase,
  education: FaGraduationCap,
  cert: FaMedal,
  project: FaPuzzlePiece,
  folder: FaFolderOpen,
  camera: FaCamera,
  trash: FaTrashAlt,
  info: FaInfoCircle,
  upload: FaUpload,
  search: FaSearch,
  spinner: FaSpinner,
  calendar: FaCalendarAlt,
  link: FaLink,
  users: FaUsers,
  location: FaMapMarkerAlt,
  idea: FaLightbulb,
  eye: FaEye,
  clear: FaTimesCircle,
  download: FaDownload,
  chevronLeft: FaChevronLeft,
  chevronRight: FaChevronRight,
  archive: FaArchive,
  restore: FaHistory,
  file: FaFile,
  'file-text': FaFileAlt,
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

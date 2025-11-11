// Mock for react-icons
const React = require('react');

// Create a mock component factory
const createMockIcon = (displayName) => {
  const MockIcon = (props) => React.createElement('svg', { 
    'data-testid': displayName,
    className: props.className,
    ...props 
  });
  MockIcon.displayName = displayName;
  return MockIcon;
};

// Export commonly used icons
module.exports = {
  FaUser: createMockIcon('FaUser'),
  FaSignOutAlt: createMockIcon('FaSignOutAlt'),
  FaEdit: createMockIcon('FaEdit'),
  FaHome: createMockIcon('FaHome'),
  FaBriefcase: createMockIcon('FaBriefcase'),
  FaGraduationCap: createMockIcon('FaGraduationCap'),
  FaMedal: createMockIcon('FaMedal'),
  FaPuzzlePiece: createMockIcon('FaPuzzlePiece'),
  FaFolderOpen: createMockIcon('FaFolderOpen'),
  FaCamera: createMockIcon('FaCamera'),
  FaTrashAlt: createMockIcon('FaTrashAlt'),
  FaInfoCircle: createMockIcon('FaInfoCircle'),
  FaUpload: createMockIcon('FaUpload'),
  FaSearch: createMockIcon('FaSearch'),
  FaSpinner: createMockIcon('FaSpinner'),
  FaCalendarAlt: createMockIcon('FaCalendarAlt'),
  FaLink: createMockIcon('FaLink'),
  FaMapMarkerAlt: createMockIcon('FaMapMarkerAlt'),
  FaUsers: createMockIcon('FaUsers'),
  FaLightbulb: createMockIcon('FaLightbulb'),
  FaEye: createMockIcon('FaEye'),
  FaTimesCircle: createMockIcon('FaTimesCircle'),
  FaDownload: createMockIcon('FaDownload'),
  FaChevronLeft: createMockIcon('FaChevronLeft'),
  FaChevronRight: createMockIcon('FaChevronRight'),
  FaChevronDown: createMockIcon('FaChevronDown'),
  FaChevronUp: createMockIcon('FaChevronUp'),
  FaArchive: createMockIcon('FaArchive'),
  FaHistory: createMockIcon('FaHistory'),
  FaFile: createMockIcon('FaFile'),
  FaFileAlt: createMockIcon('FaFileAlt'),
  FaFilter: createMockIcon('FaFilter'),
  FaMagic: createMockIcon('FaMagic'),
  FaSyncAlt: createMockIcon('FaSyncAlt'),
  FaClipboard: createMockIcon('FaClipboard'),
  FaCheck: createMockIcon('FaCheck'),
  FaGripVertical: createMockIcon('FaGripVertical'),
  FaDollarSign: createMockIcon('FaDollarSign'),
  FaChartLine: createMockIcon('FaChartLine'),
  FaUndo: createMockIcon('FaUndo'),
  FaRedo: createMockIcon('FaRedo'),
  FaClock: createMockIcon('FaClock'),
  FaCheckCircle: createMockIcon('FaCheckCircle'),
  FaArrowRight: createMockIcon('FaArrowRight'),
  FaThumbsUp: createMockIcon('FaThumbsUp'),
  FaKeyboard: createMockIcon('FaKeyboard'),
  FaFont: createMockIcon('FaFont'),
  FaChartBar: createMockIcon('FaChartBar'),
  FaStar: createMockIcon('FaStar'),
  FaCopy: createMockIcon('FaCopy'),
  FaCodeBranch: createMockIcon('FaCodeBranch'),
  FaRandom: createMockIcon('FaRandom'),
  FaArrowLeft: createMockIcon('FaArrowLeft'),
  FaSave: createMockIcon('FaSave'),
  FaLayerGroup: createMockIcon('FaLayerGroup'),
  // New icons for cover letter features
  FaBolt: createMockIcon('FaBolt'),
  FaTimes: createMockIcon('FaTimes'),
  FaPlus: createMockIcon('FaPlus'),
  FaExclamationCircle: createMockIcon('FaExclamationCircle'),
  FaEnvelope: createMockIcon('FaEnvelope'),
  FaAlignLeft: createMockIcon('FaAlignLeft'),
  FaBook: createMockIcon('FaBook'),
  FaPen: createMockIcon('FaPen'),
};


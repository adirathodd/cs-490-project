// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for libraries (e.g., undici used by Firebase auth)
try {
	const { TextEncoder, TextDecoder } = require('util');
	if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
	if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
} catch {}

// jsdom doesn't implement URL.createObjectURL; mock for components that preview blobs
if (typeof global.URL === 'undefined') {
	// Ensure URL object exists
	// eslint-disable-next-line no-global-assign
	global.URL = {};
}
if (typeof global.URL.createObjectURL === 'undefined') {
	global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
}
if (typeof global.URL.revokeObjectURL === 'undefined') {
	global.URL.revokeObjectURL = jest.fn();
}

// Mock Firebase services to avoid initializing real SDK in tests
jest.mock('./services/firebase', () => ({
	__esModule: true,
	auth: {},
	onAuthStateChanged: jest.fn((auth, callback) => {
		// No user by default
		if (typeof callback === 'function') callback(null);
		return () => {};
	}),
	createUserWithEmailAndPassword: jest.fn(),
	signInWithEmailAndPassword: jest.fn(),
	signOut: jest.fn(),
	updateProfile: jest.fn(),
	reauthenticateWithCredential: jest.fn(),
	EmailAuthProvider: { credential: jest.fn() },
	googleProvider: {},
	signInWithPopup: jest.fn(),
	fetchSignInMethodsForEmail: jest.fn().mockResolvedValue([]),
	sendPasswordResetEmail: jest.fn(),
	verifyPasswordResetCode: jest.fn(),
	confirmPasswordReset: jest.fn(),
}));


	// Mock API module to avoid importing axios/HTTP in tests
	jest.mock('./services/api', () => ({
		__esModule: true,
		default: {},
		profileAPI: {
			getUserProfile: jest.fn(),
			updateProfile: jest.fn(),
		},
		authAPI: {
			register: jest.fn(),
			login: jest.fn(),
			getCurrentUser: jest.fn().mockResolvedValue({ user: {}, profile: {} }),
			updateProfile: jest.fn(),
			getBasicProfile: jest.fn(),
			updateBasicProfile: jest.fn(),
			getProfilePicture: jest.fn(),
			uploadProfilePicture: jest.fn(),
			deleteProfilePicture: jest.fn(),
			deleteAccount: jest.fn(),
			requestAccountDeletion: jest.fn(),
		},
		skillsAPI: {
			getSkills: jest.fn(),
			addSkill: jest.fn(),
			updateSkill: jest.fn(),
			deleteSkill: jest.fn(),
			autocompleteSkills: jest.fn(),
			getCategories: jest.fn(),
			getSkillsByCategory: jest.fn(),
			reorderSkill: jest.fn(),
			bulkReorderSkills: jest.fn(),
			exportSkills: jest.fn(),
		},
		educationAPI: {
			getLevels: jest.fn(),
			getEducations: jest.fn(),
			addEducation: jest.fn(),
			updateEducation: jest.fn(),
			deleteEducation: jest.fn(),
		},
		certificationsAPI: {
			getCategories: jest.fn(),
			searchOrganizations: jest.fn(),
			getCertifications: jest.fn(),
			addCertification: jest.fn(),
			updateCertification: jest.fn(),
			deleteCertification: jest.fn(),
		},
		projectsAPI: {
			getProjects: jest.fn().mockResolvedValue([]),
			getProject: jest.fn(),
			addProject: jest.fn(),
			updateProject: jest.fn(),
			deleteProject: jest.fn(),
			deleteProjectMedia: jest.fn(),
		},
	}));

	// Mock firebase/auth directly for components that import from it
	jest.mock('firebase/auth', () => ({
		getAuth: jest.fn(),
		createUserWithEmailAndPassword: jest.fn(),
		signInWithEmailAndPassword: jest.fn(),
		signOut: jest.fn(),
		onAuthStateChanged: jest.fn(),
		updateProfile: jest.fn(),
		reauthenticateWithCredential: jest.fn(),
		GoogleAuthProvider: function MockProvider() {},
		EmailAuthProvider: { credential: jest.fn() },
		signInWithPopup: jest.fn(),
		sendPasswordResetEmail: jest.fn(),
		verifyPasswordResetCode: jest.fn(),
		confirmPasswordReset: jest.fn(),
	}));

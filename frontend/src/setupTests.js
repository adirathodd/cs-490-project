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

if (typeof window !== 'undefined') {
	window.scrollTo = jest.fn();
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
		jobsAPI: {
			getJobs: jest.fn().mockResolvedValue([]),
			getJob: jest.fn(),
			addJob: jest.fn(),
			updateJob: jest.fn(),
			deleteJob: jest.fn(),
		archiveJob: jest.fn(),
		unarchiveJob: jest.fn(),
		bulkArchive: jest.fn(),
		bulkArchiveJobs: jest.fn(),
		bulkRestoreJobs: jest.fn(),
		getCompanyInfo: jest.fn(),
		triggerCompanyResearch: jest.fn(),
		getJobCompanyInsights: jest.fn().mockResolvedValue(null),
		getJobInterviewInsights: jest.fn().mockResolvedValue(null),
		getJobQuestionBank: jest.fn().mockResolvedValue(null),
		logQuestionPractice: jest.fn(),
		getQuestionPracticeHistory: jest.fn(),
		coachQuestionResponse: jest.fn(),
		getJobTechnicalPrep: jest.fn().mockResolvedValue(null),
		logTechnicalPrepAttempt: jest.fn(),
		togglePreparationChecklist: jest.fn(),
		triggerJobInterviewInsights: jest.fn(),
		getJobSkillsGap: jest.fn().mockResolvedValue(null),
		triggerJobSkillsGap: jest.fn(),
		getSkillProgress: jest.fn().mockResolvedValue([]),
		logSkillProgress: jest.fn(),
		addSkillToProfile: jest.fn(),
		getJobMatchAnalysis: jest.fn(),
		triggerJobMatchAnalysis: jest.fn(),
		},
		companyAPI: {
			searchCompanies: jest.fn().mockResolvedValue([]),
		},
		materialsAPI: {
			listDocuments: jest.fn().mockResolvedValue([]),
			uploadDocument: jest.fn(),
			deleteDocument: jest.fn(),
			getDownloadUrl: jest.fn().mockReturnValue('https://example.com/document/1'),
			getJobMaterials: jest.fn().mockResolvedValue({ resume_doc: null, cover_letter_doc: null, history: [] }),
			updateJobMaterials: jest.fn().mockResolvedValue({}),
			getDefaults: jest.fn().mockResolvedValue({ default_resume_doc: null, default_cover_letter_doc: null }),
			setDefaults: jest.fn().mockResolvedValue({}),
			getAnalytics: jest.fn().mockResolvedValue({}),
		},
		interviewsAPI: {
			getInterviews: jest.fn().mockResolvedValue([]),
			getInterview: jest.fn(),
			createInterview: jest.fn(),
			updateInterview: jest.fn(),
			deleteInterview: jest.fn(),
		},
		salaryAPI: {
			getSalaryResearch: jest.fn(),
			triggerResearch: jest.fn(),
			exportResearch: jest.fn(),
		},
		salaryNegotiationAPI: {
			getPlan: jest.fn(),
			refreshPlan: jest.fn(),
			getOutcomes: jest.fn(),
			createOutcome: jest.fn(),
		},
		documentsAPI: {
			getDocuments: jest.fn().mockResolvedValue([]),
			getDocument: jest.fn(),
			uploadDocument: jest.fn(),
			updateDocument: jest.fn(),
			deleteDocument: jest.fn(),
			generateDocument: jest.fn(),
		},
	}));

const { companyAPI, materialsAPI } = require('./services/api');

beforeEach(() => {
	materialsAPI.listDocuments.mockResolvedValue([]);
	materialsAPI.getDefaults.mockResolvedValue({ default_resume_doc: null, default_cover_letter_doc: null });
	materialsAPI.setDefaults.mockResolvedValue({});
	materialsAPI.getJobMaterials.mockResolvedValue({ resume_doc: null, cover_letter_doc: null, history: [] });
	materialsAPI.updateJobMaterials.mockResolvedValue({});
	materialsAPI.getDownloadUrl.mockReturnValue('https://example.com/document/1');
	materialsAPI.getAnalytics.mockResolvedValue({});
	companyAPI.searchCompanies.mockResolvedValue([]);
});

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

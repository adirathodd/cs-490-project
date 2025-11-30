const jestFn = () => jest.fn();

const profileAPI = {
	getUserProfile: jestFn(),
	updateProfile: jestFn(),
};

const authAPI = {
	register: jestFn(),
	login: jestFn(),
	getCurrentUser: jest.fn().mockResolvedValue({ user: {}, profile: {} }),
	updateProfile: jestFn(),
	getBasicProfile: jestFn(),
	updateBasicProfile: jestFn(),
	getProfilePicture: jestFn(),
	uploadProfilePicture: jestFn(),
	deleteProfilePicture: jestFn(),
	deleteAccount: jestFn(),
	requestAccountDeletion: jestFn(),
	linkProviderToken: jestFn(),
};

const skillsAPI = {
	getSkills: jestFn(),
	addSkill: jestFn(),
	updateSkill: jestFn(),
	deleteSkill: jestFn(),
	autocompleteSkills: jestFn(),
	getCategories: jestFn(),
	getSkillsByCategory: jestFn(),
	reorderSkill: jestFn(),
	bulkReorderSkills: jestFn(),
	exportSkills: jestFn(),
};

const educationAPI = {
	getLevels: jestFn(),
	getEducations: jestFn(),
	addEducation: jestFn(),
	updateEducation: jestFn(),
	deleteEducation: jestFn(),
};

const certificationsAPI = {
	getCategories: jestFn(),
	searchOrganizations: jestFn(),
	getCertifications: jestFn(),
	addCertification: jestFn(),
	updateCertification: jestFn(),
	deleteCertification: jestFn(),
};

const projectsAPI = {
	getProjects: jest.fn().mockResolvedValue([]),
	getProject: jestFn(),
	addProject: jestFn(),
	updateProject: jestFn(),
	deleteProject: jestFn(),
	deleteProjectMedia: jestFn(),
};

const jobsAPI = {
	getJobs: jest.fn().mockResolvedValue([]),
	getJob: jestFn(),
	addJob: jestFn(),
	updateJob: jestFn(),
	deleteJob: jestFn(),
	getUpcomingDeadlines: jestFn(),
	getJobStats: jestFn(),
	getAnalytics: jestFn(),
	updateAnalyticsGoals: jestFn(),
	bulkUpdateStatus: jestFn(),
	archiveJob: jestFn(),
	unarchiveJob: jestFn(),
	bulkArchive: jestFn(),
	bulkArchiveJobs: jestFn(),
	bulkRestoreJobs: jestFn(),
	getCompanyInfo: jestFn(),
	triggerCompanyResearch: jestFn(),
	getJobCompanyInsights: jest.fn().mockResolvedValue(null),
	getJobInterviewInsights: jest.fn().mockResolvedValue(null),
	getJobQuestionBank: jest.fn().mockResolvedValue(null),
	logQuestionPractice: jestFn(),
	getQuestionPracticeHistory: jestFn(),
	coachQuestionResponse: jestFn(),
	getJobTechnicalPrep: jest.fn().mockResolvedValue(null),
	logTechnicalPrepAttempt: jestFn(),
	togglePreparationChecklist: jestFn(),
	triggerJobInterviewInsights: jestFn(),
	getJobSkillsGap: jest.fn().mockResolvedValue(null),
	triggerJobSkillsGap: jestFn(),
	getSkillProgress: jest.fn().mockResolvedValue([]),
	logSkillProgress: jestFn(),
	addSkillToProfile: jestFn(),
	getJobMatchAnalysis: jestFn(),
	triggerJobMatchAnalysis: jestFn(),
	generateCompanyProfile: jestFn(),
};

const companyAPI = {
	searchCompanies: jest.fn().mockResolvedValue([]),
};

const materialsAPI = {
	listDocuments: jest.fn().mockResolvedValue([]),
	uploadDocument: jestFn(),
	deleteDocument: jestFn(),
	getDownloadUrl: jest.fn().mockReturnValue('https://example.com/document/1'),
	getJobMaterials: jest.fn().mockResolvedValue({ resume_doc: null, cover_letter_doc: null, history: [] }),
	updateJobMaterials: jest.fn().mockResolvedValue({}),
	getDefaults: jest.fn().mockResolvedValue({ default_resume_doc: null, default_cover_letter_doc: null }),
	setDefaults: jest.fn().mockResolvedValue({}),
	getAnalytics: jest.fn().mockResolvedValue({}),
};

const interviewsAPI = {
	getInterviews: jest.fn().mockResolvedValue([]),
	getInterview: jestFn(),
	createInterview: jestFn(),
	updateInterview: jestFn(),
	deleteInterview: jestFn(),
	getActiveReminders: jestFn(),
	dismissReminder: jestFn(),
	getPreparationChecklist: jestFn(),
	toggleChecklistItem: jestFn(),
	getPerformanceAnalytics: jestFn(),
	getPerformanceTracking: jestFn(),
};

const networkingAPI = {
	getEvents: jestFn(),
	getAnalytics: jestFn(),
	getEvent: jestFn(),
	createEvent: jestFn(),
	updateEvent: jestFn(),
	deleteEvent: jestFn(),
};

const salaryAPI = {
	getSalaryResearch: jestFn(),
	triggerResearch: jestFn(),
	exportResearch: jestFn(),
};

const salaryNegotiationAPI = {
	getPlan: jestFn(),
	refreshPlan: jestFn(),
	getOutcomes: jestFn(),
	createOutcome: jestFn(),
};

const documentsAPI = {
	getDocuments: jest.fn().mockResolvedValue([]),
	getDocument: jestFn(),
	uploadDocument: jestFn(),
	updateDocument: jestFn(),
	deleteDocument: jestFn(),
	generateDocument: jestFn(),
};

const resumeVersionAPI = {
	listVersions: jestFn(),
	setDefault: jestFn(),
	archiveVersion: jestFn(),
	restoreVersion: jestFn(),
	deleteVersion: jestFn(),
	duplicateVersion: jestFn(),
	compareVersions: jestFn(),
	getVersionHistory: jestFn(),
	mergeVersions: jestFn(),
	updateVersion: jestFn(),
	createVersion: jestFn(),
	getVersion: jestFn(),
};

const resumeExportAPI = {
	getThemes: jestFn(),
	exportResume: jestFn(),
};

const mentorshipAPI = {
	getRequests: jestFn(),
	getRelationships: jestFn(),
	sendRequest: jestFn(),
	respondToRequest: jestFn(),
	cancelRequest: jestFn(),
	getShareSettings: jestFn(),
	updateShareSettings: jestFn(),
	getSharedData: jestFn(),
	getAnalytics: jestFn(),
	getProgressReport: jestFn(),
	getMessages: jestFn(),
	getGoals: jestFn(),
	createGoal: jestFn(),
	updateGoal: jestFn(),
	deleteGoal: jestFn(),
	sendMessage: jestFn(),
};

const goalsAPI = {
	getGoals: jestFn(),
	getAnalytics: jestFn(),
	getGoal: jestFn(),
	createGoal: jestFn(),
	updateGoal: jestFn(),
	deleteGoal: jestFn(),
	updateProgress: jestFn(),
};

const referralAPI = {
	markSent: jestFn(),
	markResponse: jestFn(),
	markCompleted: jestFn(),
	unmarkCompleted: jestFn(),
	expressGratitude: jestFn(),
	suggestFollowUp: jestFn(),
};

module.exports = {
	__esModule: true,
	default: {},
	profileAPI,
	authAPI,
	skillsAPI,
	educationAPI,
	certificationsAPI,
	projectsAPI,
	jobsAPI,
	companyAPI,
	materialsAPI,
	interviewsAPI,
	networkingAPI,
	salaryAPI,
	salaryNegotiationAPI,
	documentsAPI,
	resumeVersionAPI,
	resumeExportAPI,
	mentorshipAPI,
	goalsAPI,
	referralAPI,
};

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

const networkingAnalyticsStub = {
	overview: {
		total_events: 0,
		attended_events: 0,
		total_connections: 0,
		high_value_connections: 0,
		goals_achievement_rate: 0,
		follow_up_completion_rate: 0,
		manual_outreach_attempts_30d: 0,
		interactions_logged_30d: 0,
		strong_relationships: 0,
	},
	activity_volume: {
		events_planned: 0,
		events_registered: 0,
		events_attended: 0,
		followups_open: 0,
		followups_completed_30d: 0,
		connections_added_60d: 0,
		interactions_logged_30d: 0,
		outreach_attempts_30d: 0,
	},
	relationship_health: {
		avg_relationship_strength: 0,
		recent_relationship_strength: 0,
		relationship_trend: 0,
		engaged_contacts_60d: 0,
		high_value_ratio: 0,
	},
	referral_pipeline: {
		referrals_requested: 0,
		referrals_received: 0,
		referrals_used: 0,
		networking_sourced_jobs: 0,
		networking_offers: 0,
		introductions_created: 0,
		opportunities_from_interviews: 0,
	},
	event_roi: {
		total_spend: 0,
		connections_per_event: 0,
		followups_per_connection: 0,
		cost_per_connection: 0,
		cost_per_high_value_connection: 0,
		paid_events_count: 0,
		paid_connections: 0,
		paid_high_value_connections: 0,
	},
	conversion_rates: {
		connection_to_followup_rate: 0,
		follow_up_completion_rate: 0,
		outreach_response_rate: 0,
		networking_to_application_rate: 0,
		referral_conversion_rate: 0,
	},
	insights: { strengths: [], focus: [], recommendations: [] },
	industry_benchmarks: {
		industry: 'general',
		benchmarks: {
			outreach_to_meeting_rate: 0,
			follow_up_completion: 0,
			high_value_ratio: 0,
			connections_per_event: 0,
			referral_conversion: 0,
		},
	},
};

const networkingAPI = {
	getEvents: jestFn(),
	getAnalytics: jest.fn().mockResolvedValue(networkingAnalyticsStub),
	getEvent: jestFn(),
	createEvent: jestFn(),
	updateEvent: jestFn(),
	deleteEvent: jestFn(),
};

const salaryAPI = {
	getSalaryResearch: jestFn(),
	triggerResearch: jestFn(),
	exportResearch: jestFn(),
	getSalaryBenchmarks: jestFn(),
};

const salaryNegotiationAPI = {
	getPlan: jestFn(),
	refreshPlan: jestFn(),
	getOutcomes: jestFn(),
	createOutcome: jestFn(),
};

const offerAPI = {
	list: jestFn(),
	create: jestFn(),
	update: jestFn(),
	delete: jestFn(),
	archive: jestFn(),
	getComparison: jestFn(),
	runScenario: jestFn(),
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

const supportersAPI = {
	listInvites: jestFn(),
	createInvite: jestFn(),
	updateInvite: jestFn(),
	deleteInvite: jestFn(),
	fetchDashboard: jestFn(),
	sendEncouragement: jestFn(),
	listEncouragements: jestFn(),
	fetchChat: jestFn(),
	sendChat: jestFn(),
	candidateChat: jestFn(),
	candidateSendChat: jestFn(),
	getMood: jestFn(),
	updateMood: jestFn(),
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

const informationalInterviewsAPI = {
	getInterviews: jestFn(),
	getInterview: jestFn(),
	createInterview: jestFn(),
	updateInterview: jestFn(),
	deleteInterview: jestFn(),
	markOutreachSent: jestFn(),
	markScheduled: jestFn(),
	markCompleted: jestFn(),
	generateOutreach: jestFn(),
	generatePreparation: jestFn(),
	getAnalytics: jestFn(),
};

const contactsAPI = {
	list: jestFn(),
	get: jestFn(),
	create: jestFn(),
	update: jestFn(),
	delete: jestFn(),
};

// Mock for axios instance
const axiosInstance = {
	get: jest.fn(),
	post: jest.fn(),
	put: jest.fn(),
	patch: jest.fn(),
	delete: jest.fn(),
	request: jest.fn(),
};

module.exports = {
	__esModule: true,
	default: axiosInstance,
	api: axiosInstance,
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
	offerAPI,
	documentsAPI,
	resumeVersionAPI,
	resumeExportAPI,
	mentorshipAPI,
	supportersAPI,
	goalsAPI,
	referralAPI,
	informationalInterviewsAPI,
	contactsAPI,
};

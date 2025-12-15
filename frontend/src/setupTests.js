import React from 'react';
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

// Lightweight mocks for libraries not available in Jest/jsdom
jest.mock('@fullcalendar/react', () => () => <div data-testid="fullcalendar" />);
jest.mock('@fullcalendar/list', () => () => null);
jest.mock('@fullcalendar/daygrid', () => () => null);
jest.mock('@fullcalendar/timegrid', () => () => null);
jest.mock('@fullcalendar/interaction', () => () => null);
jest.mock('recharts', () => ({
	ResponsiveContainer: ({ children }) => <div>{children}</div>,
	LineChart: ({ children }) => <div>{children}</div>,
	BarChart: ({ children }) => <div>{children}</div>,
	PieChart: ({ children }) => <div>{children}</div>,
	Line: () => null,
	Bar: () => null,
	Pie: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
	Legend: () => null,
	CartesianGrid: () => null,
}));

// Mock chart libraries (ESM packages can be problematic in Jest v27)
jest.mock('react-chartjs-2', () => ({
	__esModule: true,
	Line: () => <div data-testid="line-chart" />,
}));

jest.mock('chart.js', () => {
	const Chart = { register: jest.fn() };
	// Export named elements referenced in component registration
	return {
		__esModule: true,
		Chart,
		CategoryScale: function () {},
		LinearScale: function () {},
		PointElement: function () {},
		LineElement: function () {},
		Title: function () {},
		Tooltip: function () {},
		Legend: function () {},
		Filler: function () {},
	};
});

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

// Mock API module via the manual mock
jest.mock('./services/api');

const { companyAPI, materialsAPI, jobsAPI, interviewsAPI, networkingAPI, resumeExportAPI } = require('./services/api');

beforeEach(() => {
	materialsAPI.listDocuments.mockResolvedValue([]);
	materialsAPI.getDefaults.mockResolvedValue({ default_resume_doc: null, default_cover_letter_doc: null });
	materialsAPI.setDefaults.mockResolvedValue({});
	materialsAPI.getJobMaterials.mockResolvedValue({ resume_doc: null, cover_letter_doc: null, history: [] });
	materialsAPI.updateJobMaterials.mockResolvedValue({});
	materialsAPI.getDownloadUrl.mockReturnValue('https://example.com/document/1');
	materialsAPI.getAnalytics.mockResolvedValue({});
	companyAPI.searchCompanies.mockResolvedValue([]);
	jobsAPI.getUpcomingDeadlines.mockResolvedValue([]);
	jobsAPI.getJobStats.mockResolvedValue({ daily_applications: [], counts: {} });
	jobsAPI.getAnalytics.mockResolvedValue({ counts: {}, monthly_applications: [], daily_applications: [], response_rate_percent: 0 });
	if (!jobsAPI.getCompetitiveAnalysis) {
		jobsAPI.getCompetitiveAnalysis = jest.fn();
	}
	jobsAPI.getCompetitiveAnalysis.mockResolvedValue({
		cohort: { industry: 'General', experience_level: 'mid', sample_size: 0 },
		user_metrics: {},
		peer_benchmarks: {},
		skill_gaps: [],
		differentiators: [],
		recommendations: { deterministic: [], ai: [] },
		progression: {},
		employment: {},
	});
	jobsAPI.bulkUpdateStatus.mockResolvedValue({ updated: 0 });
	interviewsAPI.getActiveReminders.mockResolvedValue([]);
	interviewsAPI.dismissReminder.mockResolvedValue({});
	interviewsAPI.getPreparationChecklist.mockResolvedValue(null);
	interviewsAPI.toggleChecklistItem.mockResolvedValue({});
	interviewsAPI.getPerformanceAnalytics.mockResolvedValue({});
	interviewsAPI.getPerformanceTracking.mockResolvedValue({});
	networkingAPI.getEvents.mockResolvedValue([]);
	networkingAPI.getAnalytics.mockResolvedValue({
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
	});
	resumeExportAPI.getThemes.mockResolvedValue({ themes: [] });
	resumeExportAPI.exportResume.mockResolvedValue({ filename: 'resume.pdf' });
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

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Goals from './Goals';
import { goalsAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
	goalsAPI: {
		getGoals: jest.fn(),
		getAnalytics: jest.fn(),
		updateProgress: jest.fn(),
	},
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useNavigate: () => mockNavigate,
}));

const mockGoals = [
	{
		id: 'goal-1',
		title: 'Land Senior Engineer Role',
		description: 'Secure a senior software engineer position at a top tech company',
		goal_type: 'long_term',
		target_metric: '1 job offer',
		target_value: 1,
		current_value: 0,
		target_date: '2025-12-31',
		status: 'in_progress',
		progress_percentage: 45,
		is_overdue: false,
		days_remaining: 180,
		milestone_count: 3,
		created_at: '2025-01-01T00:00:00Z',
		updated_at: '2025-01-15T00:00:00Z',
	},
	{
		id: 'goal-2',
		title: 'Complete 5 Technical Interviews',
		description: 'Practice technical interviewing to improve skills',
		goal_type: 'short_term',
		target_metric: '5 interviews',
		target_value: 5,
		current_value: 2,
		target_date: '2025-06-30',
		status: 'in_progress',
		progress_percentage: 40,
		is_overdue: false,
		days_remaining: 90,
		milestone_count: 0,
		created_at: '2025-01-10T00:00:00Z',
		updated_at: '2025-01-20T00:00:00Z',
	},
];

const mockAnalytics = {
	overview: {
		total_goals: 5,
		active_goals: 2,
		completed_goals: 2,
		overdue_goals: 1,
		completion_rate: 40.0,
		average_progress: 42.5,
	},
};

const renderGoals = async () => {
	await act(async () => {
		render(
			<BrowserRouter>
				<Goals />
			</BrowserRouter>
		);
	});
};

describe('Goals Component', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		goalsAPI.getGoals.mockResolvedValue(mockGoals);
		goalsAPI.getAnalytics.mockResolvedValue(mockAnalytics);
	});

	it('renders header and analytics overview', async () => {
		await renderGoals();

		await waitFor(() => {
			expect(screen.getByText('Career Goals')).toBeInTheDocument();
			expect(screen.getByText('Overview')).toBeInTheDocument();
		});

		expect(screen.getByText('Total Goals')).toBeInTheDocument();
		expect(screen.getByText('5')).toBeInTheDocument();
	});

	it('updates goal progress from the inline control', async () => {
		goalsAPI.updateProgress.mockResolvedValue({ ...mockGoals[0], current_value: 60, progress_percentage: 60 });

		await renderGoals();

		await waitFor(() => {
			expect(screen.getByText('Complete 5 Technical Interviews')).toBeInTheDocument();
		});

		const goalCard = screen.getByText('Complete 5 Technical Interviews').closest('.goal-card');
		const progressInput = within(goalCard).getByPlaceholderText('Enter current value');
		fireEvent.change(progressInput, { target: { value: '60' } });

		const updateButton = within(goalCard).getByRole('button', { name: 'Update' });
		fireEvent.click(updateButton);

		await waitFor(() => {
			expect(goalsAPI.updateProgress).toHaveBeenCalledWith('goal-2', 60);
		});
	});
});

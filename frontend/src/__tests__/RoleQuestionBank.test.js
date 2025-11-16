import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Component under test
import RoleQuestionBank from '../components/jobs/RoleQuestionBank';

// Mock the Icon component to keep tests focused and lightweight
jest.mock('../components/common/Icon', () => (props) => {
  const { name } = props;
  return <span data-testid={`icon-${name}`}>{name}</span>;
});

// Mock the API module used by the component
const mockGetHistory = jest.fn();
jest.mock('../services/api', () => ({
  jobsAPI: {
    getQuestionPracticeHistory: (...args) => mockGetHistory(...args),
  },
}));

describe('RoleQuestionBank', () => {
  const bank = {
    job_title: 'Software Engineer',
    company_name: 'Acme',
    categories: [
      {
        id: 'cat-1',
        label: 'Algorithms',
        questions: [
          {
            id: 'q-1',
            prompt: 'Explain a stack vs queue',
            difficulty: 'entry',
            skills: [{ name: 'Python' }],
            concepts: ['Data structures'],
            framework: { type: 'STAR', prompts: { situation: 'S', task: 'T', action: 'A', result: 'R' } },
            practice_status: {
              practiced: true,
              last_practiced_at: '2025-11-15T11:00:00Z',
              practice_count: 2,
            },
          },
        ],
      },
    ],
    difficulty_levels: [{ value: 'entry', label: 'Entry' }],
    star_framework: null,
    company_focus: [],
  };

  beforeEach(() => {
    mockGetHistory.mockReset();
  });

  test('renders question card and shows view history modal when history exists', async () => {
    const historyResponse = {
      question_text: 'Explain a stack vs queue',
      written_response: 'A stack is LIFO...',
      star_response: { situation: 's', task: 't', action: 'a', result: 'r' },
      practice_notes: 'notes',
      first_practiced_at: '2025-01-01T00:00:00Z',
      last_practiced_at: '2025-11-15T11:00:00Z',
      practice_count: 2,
    };

    mockGetHistory.mockResolvedValueOnce(historyResponse);

    render(
      <RoleQuestionBank
        bank={bank}
        loading={false}
        onLogPractice={jest.fn()}
        jobId={123}
      />
    );

    // Card content shows prompt
    expect(screen.getByText(/Explain a stack vs queue/i)).toBeInTheDocument();

    // Log Practice button present
    const logBtn = screen.getByRole('button', { name: /Log Practice/i });
    expect(logBtn).toBeInTheDocument();

    // View History button present
    const viewBtn = screen.getByRole('button', { name: /View History/i });
    expect(viewBtn).toBeInTheDocument();

    // Click view history -> should call API and show modal content
    fireEvent.click(viewBtn);

    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledWith(123, 'q-1'));

    expect(await screen.findByText(/Practice History/i)).toBeInTheDocument();
    expect(screen.getByText(/A stack is LIFO/)).toBeInTheDocument();
    expect(screen.getByText(/Practice count:/i)).toBeInTheDocument();
  });
});

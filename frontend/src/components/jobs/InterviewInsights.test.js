import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewInsights from './InterviewInsights';

describe('InterviewInsights (UC-068: Interview Insights and Preparation)', () => {
  test('renders nothing when no insights data', () => {
    const { container } = render(<InterviewInsights insights={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when insights has no data', () => {
    const { container } = render(<InterviewInsights insights={{ has_data: false }} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders disclaimer when provided', () => {
    const insights = {
      has_data: true,
      disclaimer: 'This information is based on general industry data and may not reflect the specific practices of this company.',
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/this information is based on general industry data/i)).toBeInTheDocument();
  });

  test('renders interview process overview', () => {
    const insights = {
      has_data: true,
      process_overview: {
        total_stages: 4,
        estimated_duration: '3-5 weeks',
        stages: [
          {
            stage_number: 1,
            name: 'Phone Screen',
            duration: '30 minutes',
            description: 'Initial conversation with recruiter',
            activities: [
              'Discuss background and experience',
              'Review resume highlights',
              'Explain role expectations',
            ],
          },
          {
            stage_number: 2,
            name: 'Technical Interview',
            duration: '1-2 hours',
            description: 'Coding and problem-solving assessment',
            activities: [
              'Live coding exercises',
              'Algorithm questions',
              'System design discussion',
            ],
          },
        ],
      },
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/interview process overview/i)).toBeInTheDocument();
    expect(screen.getByText(/4 stages over 3-5 weeks/i)).toBeInTheDocument();
    expect(screen.getByText(/stage 1: phone screen/i)).toBeInTheDocument();
    expect(screen.getByText(/30 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/initial conversation with recruiter/i)).toBeInTheDocument();
    expect(screen.getByText(/discuss background and experience/i)).toBeInTheDocument();
    expect(screen.getByText(/stage 2: technical interview/i)).toBeInTheDocument();
    expect(screen.getByText(/live coding exercises/i)).toBeInTheDocument();
  });

  test('renders common questions sections', () => {
    const insights = {
      has_data: true,
      common_questions: {
        technical: [
          'Explain how React hooks work',
          'Describe the difference between SQL and NoSQL',
          'What is your experience with cloud platforms?',
        ],
        behavioral: [
          'Tell me about a time you faced a challenging bug',
          'How do you prioritize tasks?',
          'Describe your experience working in a team',
        ],
      },
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/common interview questions/i)).toBeInTheDocument();
    expect(screen.getByText(/technical questions/i)).toBeInTheDocument();
    expect(screen.getByText(/explain how react hooks work/i)).toBeInTheDocument();
    expect(screen.getByText(/describe the difference between sql and nosql/i)).toBeInTheDocument();
    expect(screen.getByText(/behavioral questions/i)).toBeInTheDocument();
    expect(screen.getByText(/tell me about a time you faced a challenging bug/i)).toBeInTheDocument();
    expect(screen.getByText(/how do you prioritize tasks/i)).toBeInTheDocument();
  });

  test('renders preparation recommendations', () => {
    const insights = {
      has_data: true,
      // Component expects an array of string tips
      preparation_recommendations: [
        'Review data structures and algorithms',
        'Practice coding on a whiteboard',
        'Study system design patterns',
        'Prepare STAR method examples',
        'Practice explaining technical concepts to non-technical people',
      ],
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/preparation recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/review data structures and algorithms/i)).toBeInTheDocument();
    expect(screen.getByText(/practice coding on a whiteboard/i)).toBeInTheDocument();
    expect(screen.getByText(/prepare star method examples/i)).toBeInTheDocument();
  });

  test('renders timeline expectations', () => {
    const insights = {
      has_data: true,
      // Component expects timeline with specific keys
      timeline: {
        response_time: '1-2 weeks',
        total_duration: '4-6 weeks',
        between_rounds: '1 week',
        final_decision: '1 week after final interview',
      },
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/timeline expectations/i)).toBeInTheDocument();
    expect(screen.getByText(/initial response time/i)).toBeInTheDocument();
    expect(screen.getByText(/1-2 weeks/i)).toBeInTheDocument();
    expect(screen.getByText(/total duration/i)).toBeInTheDocument();
    expect(screen.getByText(/4-6 weeks/i)).toBeInTheDocument();
  });

  test('renders success tips', () => {
    const insights = {
      has_data: true,
      success_tips: [
        'Research the company thoroughly before the interview',
        'Prepare questions to ask the interviewer',
        'Follow up with a thank-you email within 24 hours',
        'Be ready to discuss specific examples from your experience',
      ],
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/success tips/i)).toBeInTheDocument();
    expect(screen.getByText(/research the company thoroughly before the interview/i)).toBeInTheDocument();
    expect(screen.getByText(/prepare questions to ask the interviewer/i)).toBeInTheDocument();
    expect(screen.getByText(/follow up with a thank-you email within 24 hours/i)).toBeInTheDocument();
  });

  test('renders preparation checklist', () => {
    const insights = {
      has_data: true,
      // Component expects categories each with items
      preparation_checklist: [
        {
          category: 'General Prep',
          items: [
            { task_id: 'task-1', task: 'Review job description thoroughly', completed: false },
            { task_id: 'task-2', task: 'Research company background and values', completed: false },
            { task_id: 'task-3', task: 'Prepare portfolio or code samples', completed: false },
            { task_id: 'task-4', task: 'Practice common interview questions', completed: false },
          ],
        },
      ],
    };

    render(<InterviewInsights insights={insights} />);

    expect(screen.getByText(/preparation checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/review job description thoroughly/i)).toBeInTheDocument();
    expect(screen.getByText(/research company background and values/i)).toBeInTheDocument();
    expect(screen.getByText(/prepare portfolio or code samples/i)).toBeInTheDocument();
    expect(screen.getByText(/practice common interview questions/i)).toBeInTheDocument();
  });

  test('calls toggle handler when checklist item changes', async () => {
    const insights = {
      has_data: true,
      preparation_checklist: [
        {
          category: 'General Prep',
          items: [
            { task_id: 'task-1', task: 'Review job description thoroughly', completed: false },
          ],
        },
      ],
    };
    const onToggle = jest.fn();

    render(<InterviewInsights insights={insights} onToggleChecklistItem={onToggle} />);

    const checkbox = screen.getByLabelText(/review job description thoroughly/i);
    await userEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      category: 'General Prep',
      task: 'Review job description thoroughly',
      completed: true,
    }));
  });

  test('renders complete insights with all sections', () => {
    const insights = {
      has_data: true,
      disclaimer: 'General industry data',
      process_overview: {
        total_stages: 3,
        estimated_duration: '2-4 weeks',
        stages: [
          {
            stage_number: 1,
            name: 'Screening',
            duration: '30 min',
            description: 'Initial call',
            activities: ['Discuss role'],
          },
        ],
      },
      common_questions: {
        technical: ['Question 1'],
        behavioral: ['Question 2'],
      },
      preparation_recommendations: ['Study algorithms'],
      timeline: {
        response_time: '1 week',
        total_duration: '2-4 weeks',
      },
      success_tips: ['Tip 1', 'Tip 2'],
      preparation_checklist: [
        {
          category: 'Checklist',
          items: [
            { task_id: 'task-5', task: 'Task 1', completed: false },
          ],
        },
      ],
    };

    render(<InterviewInsights insights={insights} />);

    // Verify all major sections are present
    expect(screen.getByText(/interview insights & preparation/i)).toBeInTheDocument();
    expect(screen.getByText(/general industry data/i)).toBeInTheDocument();
    expect(screen.getByText(/interview process overview/i)).toBeInTheDocument();
    expect(screen.getByText(/common interview questions/i)).toBeInTheDocument();
    expect(screen.getByText(/preparation recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/timeline expectations/i)).toBeInTheDocument();
    expect(screen.getByText(/success tips/i)).toBeInTheDocument();
    expect(screen.getByText(/preparation checklist/i)).toBeInTheDocument();
  });

  test('handles missing optional sections gracefully', () => {
    const insights = {
      has_data: true,
      process_overview: {
        total_stages: 2,
        estimated_duration: '2 weeks',
        stages: [
          {
            stage_number: 1,
            name: 'Interview',
            duration: '1 hour',
            description: 'Technical interview',
            activities: ['Coding'],
          },
        ],
      },
      // Missing other sections
    };

    render(<InterviewInsights insights={insights} />);

    // Should still render without errors
    expect(screen.getByText(/interview insights & preparation/i)).toBeInTheDocument();
    expect(screen.getByText(/interview process overview/i)).toBeInTheDocument();
    
    // Should not crash when other sections are missing
    expect(screen.queryByText(/common interview questions/i)).not.toBeInTheDocument();
  });
});

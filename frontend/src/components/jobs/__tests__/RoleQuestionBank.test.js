import React from 'react';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoleQuestionBank from '../RoleQuestionBank';

const mockBank = {
  job_title: 'Product Manager',
  company_name: 'Acme',
  categories: [
    {
      id: 'behavioral',
      label: 'Behavioral',
      guidance: 'Use STAR.',
      questions: [
        {
          id: 'beh-1',
          prompt: 'Tell me about a time you aligned stakeholders.',
          category: 'behavioral',
          difficulty: 'mid',
          skills: [{ skill_id: 1, name: 'Communication' }],
          concepts: ['alignment'],
          framework: {
            type: 'STAR',
            prompts: {
              situation: 'Set the scene.',
              task: 'Clarify your duty.',
              action: 'Actions taken.',
              result: 'Outcome.',
            },
          },
          practice_status: { practiced: false, practice_count: 0 },
        },
      ],
    },
  ],
  difficulty_levels: [
    { value: 'entry', label: 'Entry' },
    { value: 'mid', label: 'Mid' },
  ],
  star_framework: {
    overview: 'Follow STAR.',
    steps: [
      { id: 'situation', title: 'Situation', tip: 'Context' },
      { id: 'task', title: 'Task', tip: 'Goal' },
    ],
  },
  company_focus: [],
};

describe('RoleQuestionBank', () => {
  test('renders categories and question details', async () => {
    await act(async () => {
      render(<RoleQuestionBank bank={mockBank} />);
    });

    expect(screen.getByText(/Role-Specific Question Bank/i)).toBeInTheDocument();
    expect(screen.getByText(/Tell me about a time/i)).toBeInTheDocument();
    expect(screen.getByText(/Communication/i)).toBeInTheDocument();
    expect(screen.getByText(/STAR Method Quick Reference/i)).toBeInTheDocument();
  });

  test('opens practice modal and submits response', async () => {
    const onLogPractice = jest.fn().mockResolvedValue({});
    await act(async () => {
      render(<RoleQuestionBank bank={mockBank} onLogPractice={onLogPractice} />);
    });

    const logButton = screen.getByRole('button', { name: /log practice/i });
    await act(async () => {
      await userEvent.click(logButton);
    });

    const modal = await screen.findByRole('dialog');
    const summaryField = within(modal).getByPlaceholderText(/overall summary/i);
    await userEvent.type(summaryField, 'Aligned exec team');

    const saveButton = within(modal).getByRole('button', { name: /save practice/i });
    await act(async () => {
      await userEvent.click(saveButton);
    });

    expect(onLogPractice).toHaveBeenCalledWith(expect.objectContaining({
      question_id: 'beh-1',
      written_response: 'Aligned exec team',
    }));
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExperienceTailoringLab } from './AiResumeGenerator';

jest.mock('../../../components/common/Icon', () => (props) => (
  <span data-testid={`icon-${props.name}`}>{props.children}</span>
));

const baseExperience = {
  source_experience_id: 1,
  role: 'Engineer',
  company: 'Acme',
  dates: '2022 – Present',
  bullets: ['Original profile bullet'],
};

const baseProps = {
  jobContext: { jobTitle: 'Backend Engineer', company: 'Acme' },
  selectedJobId: 'job-1',
  onApply: jest.fn(),
  onSave: jest.fn(),
  onDeleteSaved: jest.fn(),
  onApplySaved: jest.fn(),
  onNotify: jest.fn(),
  savedVariants: {},
  externalVariations: {},
};

describe('ExperienceTailoringLab', () => {
  it('renders Gemini-provided bullets when available', () => {
    render(
      <ExperienceTailoringLab
        {...baseProps}
        experiences={[baseExperience]}
        externalVariations={{
          'experience-1': {
            variations: [
              {
                id: 'gem-1',
                label: 'Gemini impact',
                description: 'Gemini rewrite',
                bullets: ['Gemini crafted bullet'],
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('Gemini crafted bullet')).toBeInTheDocument();
  });

  it('falls back to profile bullets when Gemini data is unavailable', () => {
    render(
      <ExperienceTailoringLab
        {...baseProps}
        experiences={[baseExperience]}
      />,
    );

    expect(screen.getByText('Original profile bullet')).toBeInTheDocument();
    expect(screen.getByText('Bullets pulled directly from your saved experience.')).toBeInTheDocument();
  });
});

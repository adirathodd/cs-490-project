import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CompanyInsights from './CompanyInsights';
import { jobsAPI } from '../services/api';

jest.mock('../services/api', () => ({
  jobsAPI: {
    getJob: jest.fn(),
    getJobCompanyInsights: jest.fn(),
    updateJob: jest.fn(),
  },
}));

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const renderWithRouter = () => {
  render(
    <MemoryRouter initialEntries={['/jobs/1/company']}>
      <Routes>
        <Route path="/jobs/:id/company" element={<CompanyInsights />} />
      </Routes>
    </MemoryRouter>
  );
};

const sampleJob = {
  id: 1,
  title: 'Senior Software Engineer',
  company_name: 'Acme Inc',
  industry: 'Technology',
  location: 'San Francisco, CA',
  personal_notes: '',
  company_info: null,
};

const sampleCompany = {
  name: 'Acme Inc',
  description: 'Leading technology company.',
  news_overview: {
    total_items: 2,
    high_priority_items: 1,
    latest_published_at: '2024-10-01',
  },
  recent_news: [
    {
      title: 'Acme closes Series B funding',
      summary: 'Major funding round completed to scale engineering.',
      category: 'funding',
      date: '2024-10-01',
      url: 'https://example.com/funding',
      source: 'news.example.com',
      key_points: ['Raised $50M', 'Focus on product growth'],
      relevance_score: 80,
    },
    {
      title: 'Acme launches new product suite',
      summary: 'New platform announced for enterprise customers.',
      category: 'product',
      date: '2024-09-15',
      url: '',
      key_points: ['Improves customer retention'],
      relevance_score: 60,
    },
  ],
};

describe('CompanyInsights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jobsAPI.getJob.mockResolvedValue(sampleJob);
    jobsAPI.getJobCompanyInsights.mockResolvedValue(sampleCompany);
    jobsAPI.updateJob.mockResolvedValue({ ...sampleJob, personal_notes: 'Updated notes' });
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders insights and filter dropdown', async () => {
    renderWithRouter();

    expect(await screen.findByText(/Series B funding/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter updates/i })).toBeInTheDocument();
  });

  it('supports multi-select filters via dropdown', async () => {
    renderWithRouter();

    expect(await screen.findByText(/Series B funding/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filter updates/i }));

    const productCheckbox = screen.getByLabelText(/Product Launch/i);
    await userEvent.click(productCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/product suite/i)).toBeInTheDocument();
      expect(screen.queryByText(/Series B funding/i)).not.toBeInTheDocument();
    });

    const fundingCheckbox = screen.getByLabelText(/Funding/i);
    await userEvent.click(fundingCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/Series B funding/i)).toBeInTheDocument();
    });
  });

  it('allows adding news to job notes', async () => {
    renderWithRouter();

    const addButtons = await screen.findAllByRole('button', { name: /Add to Notes/i });
    await userEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(jobsAPI.updateJob).toHaveBeenCalledWith(1, expect.objectContaining({
        personal_notes: expect.stringContaining('Acme closes Series B funding'),
      }));
    });
  });

  it('allows removing news snippets from job notes', async () => {
    const firstNewsIdSafe = encodeURIComponent(sampleCompany.recent_news[0].url);
    const snippet = `[NEWS:${firstNewsIdSafe}]\nSaved insight\n[/NEWS:${firstNewsIdSafe}]`;
    jobsAPI.updateJob
      .mockResolvedValueOnce({ ...sampleJob, personal_notes: snippet })
      .mockResolvedValueOnce({ ...sampleJob, personal_notes: '' });

    renderWithRouter();

    const addButtons = await screen.findAllByRole('button', { name: /Add to Notes/i });
    await userEvent.click(addButtons[0]);

    const removeButton = await screen.findByRole('button', { name: /Remove from Notes/i });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(jobsAPI.updateJob).toHaveBeenLastCalledWith(1, { personal_notes: '' });
    });
  });

  it('paginates news items in batches of ten', async () => {
    const newsCollection = Array.from({ length: 12 }).map((_, idx) => ({
      title: `Story ${idx + 1}`,
      summary: `Summary ${idx + 1}`,
      category: 'update',
      date: `2024-09-${(idx + 1).toString().padStart(2, '0')}`,
      url: '',
      key_points: ['Point'],
      relevance_score: 50,
    }));

    jobsAPI.getJobCompanyInsights.mockResolvedValueOnce({
      ...sampleCompany,
      recent_news: newsCollection,
    });

    Element.prototype.scrollIntoView.mockClear();

    renderWithRouter();

    expect(await screen.findByText('Story 1')).toBeInTheDocument();
    expect(screen.getByText('Story 10')).toBeInTheDocument();
    expect(screen.queryByText('Story 11')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByText('Story 11')).toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });
});

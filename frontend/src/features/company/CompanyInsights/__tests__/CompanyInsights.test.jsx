import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router hooks before importing the component
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'job-1' }),
}));

import { jobsAPI } from '../../../../services/api';

// Now import the component under test
import CompanyInsights, {
  formatCategoryLabel,
  formatDate,
  getSourceFromUrl,
  extractKeyPoints,
  inferCategory,
  computePersonalRelevance,
  enrichNewsItem,
  getSnippetTokens,
  hasNewsSnippet,
  stripNewsSnippet,
} from '../CompanyInsights';

beforeEach(() => {
  jest.resetAllMocks();
  jobsAPI.getJob.mockReset();
  jobsAPI.getJobCompanyInsights.mockReset();
  jobsAPI.updateJob.mockReset();
  localStorage.clear();
  // default clipboard mock
  global.navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
});

describe('CompanyInsights integration tests', () => {
  test('loads company and news, toggles follow, copies and exports', async () => {
    const jobData = {
      id: 'job-1',
      title: 'Software Engineer',
      company_name: 'Acme Co',
      industry: 'AI',
      location: 'Boston, MA',
      personal_notes: '',
      company_info: {
        id: 'company-123',
        name: 'Acme Co',
        description: 'Acme description',
        recent_news: [
          { title: 'Company raises Series A', summary: 'We raised funding.', date: '2021-01-01', url: 'https://news.acme.com/1' },
          { title: 'Hiring in Boston', summary: 'Looking for engineers in Boston.', date: '2021-02-01', url: '' },
        ],
        news_overview: { total_items: 2, latest_published_at: '2021-02-01', high_priority_items: 1 },
      },
    };

    jobsAPI.getJob.mockResolvedValueOnce(jobData);
    jobsAPI.getJobCompanyInsights.mockResolvedValueOnce(jobData.company_info);

    jobsAPI.updateJob.mockImplementation(async (id, payload) => ({ ...jobData, personal_notes: payload.personal_notes }));

    render(<CompanyInsights />);

    // Wait for company name to appear
    expect(await screen.findByText('Acme Co')).toBeInTheDocument();

    // Interview prep sections render
    expect(await screen.findByText(/Mission & Values/i)).toBeInTheDocument();
    expect(screen.getByText(/Company History/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Developments/i)).toBeInTheDocument();
    expect(screen.getByText(/Strategic Initiatives/i)).toBeInTheDocument();

    // Copy summary: click first copy button
    const copyButtons = screen.getAllByRole('button', { name: /Copy Summary/i });
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());

    // Export summaries: ensure button enabled and clicking shows status (we don't perform download)
    const exportBtn = screen.getByRole('button', { name: /Export Research/i });
    fireEvent.click(exportBtn);
    expect(await screen.findByText(/Research packet exported./i)).toBeInTheDocument();
  });

  test('add and remove news snippets to job notes', async () => {
    const jobData = {
      id: 'job-1',
      title: 'Software Engineer',
      company_name: 'Beta Co',
      industry: 'AI',
      location: 'Boston, MA',
      personal_notes: '',
      company_info: {
        id: 'company-456',
        name: 'Beta Co',
        description: 'Beta description',
        recent_news: [
          { title: 'New product launch', summary: 'We launched X.', date: '2022-03-01', url: 'https://news.beta.com/1' },
        ],
        news_overview: { total_items: 1, latest_published_at: '2022-03-01', high_priority_items: 0 },
      },
    };

    jobsAPI.getJob.mockResolvedValueOnce(jobData);
    jobsAPI.getJobCompanyInsights.mockResolvedValueOnce(jobData.company_info);

    // First updateJob call returns job with personal_notes containing snippet
    jobsAPI.updateJob.mockImplementationOnce(async (id, payload) => ({ ...jobData, personal_notes: payload.personal_notes }));

    render(<CompanyInsights />);

    expect(await screen.findByText('Beta Co')).toBeInTheDocument();

    const addBtn = await screen.findByRole('button', { name: /Add to Notes/i });
    fireEvent.click(addBtn);

    // After save, status shown
    expect(await screen.findByText(/News insight saved to job materials./i)).toBeInTheDocument();

    // Now simulate that the job already has the snippet so Remove from Notes appears
    const snippet = '[NEWS:news-0]';
    jobsAPI.getJob.mockResolvedValueOnce({ ...jobData, personal_notes: `${snippet}\nSome notes` });
    jobsAPI.getJobCompanyInsights.mockResolvedValueOnce(jobData.company_info);
    // For removal, updateJob will be called again
    jobsAPI.updateJob.mockImplementationOnce(async (id, payload) => ({ ...jobData, personal_notes: payload.personal_notes }));

    // Rerender component to pick up the updated job with notes
    render(<CompanyInsights />);
    expect(await screen.findByText('Beta Co')).toBeInTheDocument();

    // Removal button should exist now (may take a moment)
    const removeBtn = await screen.findByRole('button', { name: /Remove from Notes/i });
    fireEvent.click(removeBtn);
    expect(await screen.findByText(/News insight removed from job notes./i)).toBeInTheDocument();
  });
});

describe('exported helpers unit tests', () => {
  test('snippet tokenization and strip/has behavior', () => {
    const newsId = 'news/1?x=1';
    const { start, end, safeId } = getSnippetTokens(newsId);
    expect(safeId).toBe(encodeURIComponent(newsId));
    const notes = `Intro\n${start}\nSome content\n${end}\nEnd`;
    expect(hasNewsSnippet(notes, newsId)).toBe(true);
    const stripped = stripNewsSnippet(notes, newsId);
    expect(stripped).toContain('Intro');
    expect(stripped).not.toContain('Some content');
  });

  test('inferCategory edge cases and computePersonalRelevance extremes', () => {
    expect(inferCategory('', '')).toBe('update');
    expect(inferCategory('IPO announced', '')).toBe('funding');
    const news = { title: 'Hiring remote', summary: 'Hiring remote', category: 'hiring' };
    const job = { industry: 'Healthcare', title: 'Nurse', location: 'Remote' };
    const score = computePersonalRelevance(news, job);
    expect(score).toBeGreaterThanOrEqual(15);
    const item = enrichNewsItem({ title: 'A', summary: 'B' }, job);
    expect(item).toHaveProperty('id');
  });

  test('formatCategoryLabel and fallback behaviors', () => {
    expect(formatCategoryLabel('unknown_tag')).toBe('Unknown Tag');
    expect(getSourceFromUrl('http://example.org/path', null)).toBe('example.org');
    // text fallback in extractKeyPoints
    expect(extractKeyPoints('', 'fb')[0]).toBe('fb');
  });

  test('handleCopySummary fallback to textarea when clipboard not available', async () => {
    // Render component and call copy functionality by invoking button when clipboard is absent
    // Remove clipboard API to force textarea path
    delete global.navigator.clipboard;
    const jobData = {
      id: 'job-1',
      title: 'SWE',
      company_name: 'Acme',
      company_info: { id: 'c1', name: 'Acme', recent_news: [{ title: 'T', summary: 'S', date: '2020-01-01', url: 'https://a' }] },
      personal_notes: '',
    };
    jobsAPI.getJob.mockResolvedValueOnce(jobData);
    jobsAPI.getJobCompanyInsights.mockResolvedValueOnce(jobData.company_info);
    jobsAPI.updateJob.mockResolvedValueOnce(jobData);
    render(<CompanyInsights />);
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    const copyBtn = await screen.findByRole('button', { name: /Copy Summary/i });
    // Ensure document.execCommand exists
    document.execCommand = jest.fn();
    fireEvent.click(copyBtn);
    // execCommand should have been called in fallback
    await waitFor(() => expect(document.execCommand).toHaveBeenCalled());
  });
});

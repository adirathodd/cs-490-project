import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompanyInfo from './CompanyInfo';

const wrap = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('CompanyInfo component', () => {
  test('renders nothing when no companyInfo or name', () => {
    const { container: c1 } = wrap(<CompanyInfo companyInfo={null} />);
    expect(c1).toBeEmptyDOMElement();

    const { container: c2 } = wrap(<CompanyInfo companyInfo={{}} />);
    expect(c2).toBeEmptyDOMElement();
  });

  test('renders basic fields and external links correctly', () => {
    const info = {
      name: 'Acme Corp',
      industry: 'Manufacturing',
      size: '100-500',
      hq_location: 'Newark, NJ',
      domain: 'acme.com',
      linkedin_url: 'https://linkedin.com/company/acme',
      description: 'We build everything.',
      mission_statement: 'Make things better',
      glassdoor_rating: 4.2,
      employee_count: 234
    };

    wrap(<CompanyInfo companyInfo={info} />);

  // Header and rating (use getAllByText because the name appears in multiple headings)
  const acmeMatches = screen.getAllByText(/Acme Corp/);
  expect(acmeMatches.length).toBeGreaterThan(0);
    expect(screen.getByText('4.2')).toBeInTheDocument();

    // Basic info labels & values
    expect(screen.getByText(/Industry/)).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getByText(/Company Size/)).toBeInTheDocument();
    expect(screen.getByText('100-500')).toBeInTheDocument();
    expect(screen.getByText(/Headquarters/)).toBeInTheDocument();
    expect(screen.getByText('Newark, NJ')).toBeInTheDocument();

    // Website link should use domain when website not provided
    const websiteLink = screen.getByRole('link', { name: /acme.com/i });
    expect(websiteLink).toHaveAttribute('href', 'https://acme.com');
    expect(websiteLink).toHaveAttribute('target', '_blank');
    expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer');

    // LinkedIn link
    const linkedin = screen.getByRole('link', { name: /View Profile/i });
    expect(linkedin).toHaveAttribute('href', 'https://linkedin.com/company/acme');

    // Descriptions
    expect(screen.getByText(/We build everything/)).toBeInTheDocument();
    expect(screen.getByText(/Make things better/)).toBeInTheDocument();

    // Employee count formatting
    expect(screen.getByText('234')).toBeInTheDocument();
  });

  test('news list sorts by date and shows hidden count note', async () => {
    const news = [
      { title: 'Old News', date: '2020-01-01', summary: 'old' },
      { title: 'Newer News', date: '2022-05-02', summary: 'newer' },
      { title: 'Newest News', date: '2023-12-31', summary: 'newest' },
      { title: 'Future News', date: '2025-01-01', summary: 'future' }
    ];

    const info = { name: 'Beta Inc', recent_news: news };
    wrap(<CompanyInfo companyInfo={info} jobId={'123'} />);

    // MAX_NEWS_PREVIEW is 3 so latest 3 should be shown: Future, Newest, Newer
    const titles = screen.getAllByRole('heading', { level: 5 }).map(h => h.textContent);
    expect(titles).toEqual(expect.arrayContaining(['Future News','Newest News','Newer News']));

    // Check hidden news note appears
    expect(screen.getByText(/Showing the latest 3 of 4 updates/)).toBeInTheDocument();

    // Check job link present and navigable
    const viewBtn = screen.getByRole('link', { name: /View company insights/i });
    expect(viewBtn).toHaveAttribute('href', '/jobs/123/company');
    // simulate click just to validate it exists
    await userEvent.click(viewBtn);
  });

  test('parses date-only news items and renders readable date', () => {
    const news = [
      { title: 'Date Only', date: '2021-06-15', summary: 'date only' }
    ];
    const info = { name: 'DateCo', recent_news: news };
    wrap(<CompanyInfo companyInfo={info} />);

    // The date-only string should render as a local date string
    expect(screen.getByText(/Date Only/)).toBeInTheDocument();
    const dateNode = screen.getByText((content, node) => {
      return node?.className === 'news-date' && /2021/.test(content);
    });
    expect(dateNode).toBeInTheDocument();
  });

  test('handles non-array recent_news gracefully', () => {
    const info = { name: 'EmptyCo', recent_news: null };
    const { container } = wrap(<CompanyInfo companyInfo={info} />);
    // Component should render without throwing and not show recent news section
    expect(container).toBeInTheDocument();
    expect(screen.queryByText(/Recent News/)).not.toBeInTheDocument();
  });
});

/**
 * UC-043: Company Information Display - Frontend Tests
 * Tests for CompanyInfo component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import CompanyInfo from './CompanyInfo';

const renderCompanyInfo = (props) =>
  render(
    <MemoryRouter>
      <CompanyInfo {...props} />
    </MemoryRouter>
  );

describe('CompanyInfo Component', () => {
  describe('Empty State', () => {
    it('renders nothing when no company info provided', () => {
      const { container } = renderCompanyInfo({ companyInfo: null });
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when company info has no name', () => {
      const { container } = renderCompanyInfo({ companyInfo: { name: '' } });
      expect(container.firstChild).toBeNull();
    });
  });

  describe('View more navigation', () => {
    const companyInfo = {
      name: 'Acme Inc',
      industry: 'Technology',
    };

    it('renders view more link when jobId is provided', () => {
      renderCompanyInfo({ companyInfo, jobId: 42 });
      const link = screen.getByRole('link', { name: /View company insights/i });
      expect(link).toHaveAttribute('href', '/jobs/42/company');
    });

    it('omits view more link when jobId is missing', () => {
      renderCompanyInfo({ companyInfo });
      expect(screen.queryByRole('link', { name: /View company insights/i })).toBeNull();
    });
  });

  describe('Basic Company Information', () => {
    const basicCompanyInfo = {
      name: 'Acme Inc',
      industry: 'Technology',
      size: '1001-5000 employees',
      hq_location: 'San Francisco, CA',
      domain: 'acme.com',
      website: 'https://acme.com'
    };

    it('renders company name in header', () => {
      renderCompanyInfo({ companyInfo: basicCompanyInfo });
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });

    it('displays industry information', () => {
      renderCompanyInfo({ companyInfo: basicCompanyInfo });
      expect(screen.getByText('Industry')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    it('displays company size', () => {
      renderCompanyInfo({ companyInfo: basicCompanyInfo });
      expect(screen.getByText('Company Size')).toBeInTheDocument();
      expect(screen.getByText('1001-5000 employees')).toBeInTheDocument();
    });

    it('displays headquarters location', () => {
      renderCompanyInfo({ companyInfo: basicCompanyInfo });
      expect(screen.getByText('Headquarters')).toBeInTheDocument();
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    it('displays website with link', () => {
      renderCompanyInfo({ companyInfo: basicCompanyInfo });
      expect(screen.getByText('Website')).toBeInTheDocument();
      
      const link = screen.getByRole('link', { name: /acme\.com/i });
      expect(link).toHaveAttribute('href', 'https://acme.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Glassdoor Rating', () => {
    it('displays Glassdoor rating when available', () => {
      const companyWithRating = {
        name: 'Tech Corp',
        glassdoor_rating: 4.5
      };

      renderCompanyInfo({ companyInfo: companyWithRating });
      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getByText('Glassdoor')).toBeInTheDocument();
    });

    it('does not display rating section when rating is not available', () => {
      const companyWithoutRating = {
        name: 'Tech Corp'
      };

      renderCompanyInfo({ companyInfo: companyWithoutRating });
      expect(screen.queryByText('Glassdoor')).not.toBeInTheDocument();
    });
  });

  describe('Employee Count', () => {
    it('displays employee count when available', () => {
      const companyWithEmployees = {
        name: 'Big Corp',
        employee_count: 2500
      };

      renderCompanyInfo({ companyInfo: companyWithEmployees });
      expect(screen.getByText('Employees')).toBeInTheDocument();
      expect(screen.getByText('2,500')).toBeInTheDocument(); // Formatted with comma
    });

    it('does not display employee count when not available', () => {
      const companyWithoutEmployees = {
        name: 'Small Corp'
      };

      renderCompanyInfo({ companyInfo: companyWithoutEmployees });
      expect(screen.queryByText('Employees')).not.toBeInTheDocument();
    });
  });

  describe('Company Description', () => {
    it('displays company description when available', () => {
      const companyWithDescription = {
        name: 'Innovative Corp',
        description: 'Leading software company building innovative solutions for modern enterprises'
      };

      renderCompanyInfo({ companyInfo: companyWithDescription });
      expect(screen.getByText(/About Innovative Corp/i)).toBeInTheDocument();
      expect(screen.getByText(/Leading software company/i)).toBeInTheDocument();
    });

    it('does not display description section when not available', () => {
      const companyWithoutDescription = {
        name: 'Basic Corp'
      };

      renderCompanyInfo({ companyInfo: companyWithoutDescription });
      expect(screen.queryByText(/About/i)).not.toBeInTheDocument();
    });
  });

  describe('Mission Statement', () => {
    it('displays mission statement when available', () => {
      const companyWithMission = {
        name: 'Mission Corp',
        mission_statement: 'To revolutionize how people work and collaborate'
      };

      renderCompanyInfo({ companyInfo: companyWithMission });
      expect(screen.getByText('Mission Statement')).toBeInTheDocument();
      expect(screen.getByText(/To revolutionize how people work/i)).toBeInTheDocument();
    });

    it('does not display mission section when not available', () => {
      const companyWithoutMission = {
        name: 'No Mission Corp'
      };

      renderCompanyInfo({ companyInfo: companyWithoutMission });
      expect(screen.queryByText('Mission Statement')).not.toBeInTheDocument();
    });
  });

  describe('Recent News', () => {
    const companyWithNews = {
      name: 'News Corp',
      recent_news: [
        {
          title: 'Company raises $50M Series B',
          url: 'https://news.example.com/funding',
          date: '2024-10-15',
          summary: 'Major funding round completed'
        },
        {
          title: 'Partnership expansion announced',
          date: '2024-10-10',
          summary: 'Strategic alliance improves go-to-market motion.'
        },
        {
          title: 'New Product Launch',
          date: '2024-09-20',
          summary: 'Revolutionary new product released'
        },
        {
          title: 'Older Market Update',
          date: '2024-08-01',
          summary: 'Quarterly market update'
        }
      ]
    };

    it('displays recent news section when news is available', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      expect(screen.getByText('Recent News')).toBeInTheDocument();
    });

    it('renders only the latest three news items, ordered by recency', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      const newsTitles = screen.getAllByRole('heading', { level: 5 }).map((node) => node.textContent);
      expect(newsTitles).toEqual([
        'Company raises $50M Series B',
        'Partnership expansion announced',
        'New Product Launch'
      ]);
      expect(screen.queryByText('Older Market Update')).toBeNull();
    });

    it('renders news titles as links when URL is provided', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      
      const link = screen.getByRole('link', { name: /Company raises \$50M Series B/i });
      expect(link).toHaveAttribute('href', 'https://news.example.com/funding');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders news titles as plain text when no URL provided', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      
      const title = screen.getByText('New Product Launch');
      expect(title.tagName).toBe('H5');
    });

    it('displays news dates in formatted format', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      
      // Date should be formatted as locale string (10/15/2024)
      expect(screen.getByText(/10\/15\/2024/)).toBeInTheDocument();
    });

    it('displays news summaries', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      expect(screen.getByText('Major funding round completed')).toBeInTheDocument();
      expect(screen.getByText('Revolutionary new product released')).toBeInTheDocument();
    });

    it('shows a preview note when more news is available', () => {
      renderCompanyInfo({ companyInfo: companyWithNews });
      expect(screen.getByText(/latest 3 of 4 updates/i)).toBeInTheDocument();
    });

    it('does not display news section when no news available', () => {
      const companyWithoutNews = {
        name: 'No News Corp',
        recent_news: []
      };

      renderCompanyInfo({ companyInfo: companyWithoutNews });
      expect(screen.queryByText('Recent News')).not.toBeInTheDocument();
    });
  });

  describe('Complete Company Profile', () => {
    const completeCompanyInfo = {
      name: 'Complete Corp',
      industry: 'Software',
      size: '501-1000 employees',
      hq_location: 'New York, NY',
      domain: 'completecorp.com',
      website: 'https://completecorp.com',
      description: 'A comprehensive software solutions provider',
      mission_statement: 'To empower businesses through technology',
      glassdoor_rating: 4.3,
      employee_count: 750,
      recent_news: [
        {
          title: 'Major Partnership Announced',
          url: 'https://news.example.com/partnership',
          date: '2024-11-01',
          summary: 'Strategic partnership with industry leader'
        }
      ]
    };

    it('renders all sections for a complete company profile', () => {
      renderCompanyInfo({ companyInfo: completeCompanyInfo });

      // Header and rating
      expect(screen.getByText('Complete Corp')).toBeInTheDocument();
      expect(screen.getByText('4.3')).toBeInTheDocument();
      
      // Basic info
      expect(screen.getByText('Software')).toBeInTheDocument();
      expect(screen.getByText('501-1000 employees')).toBeInTheDocument();
      expect(screen.getByText('750')).toBeInTheDocument();
      expect(screen.getByText('New York, NY')).toBeInTheDocument();
      
      // Description and mission
      expect(screen.getByText(/comprehensive software solutions/i)).toBeInTheDocument();
      expect(screen.getByText(/empower businesses through technology/i)).toBeInTheDocument();
      
      // News
      expect(screen.getByText('Major Partnership Announced')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      const companyInfo = {
        name: 'Accessible Corp',
        description: 'Test description',
        mission_statement: 'Test mission',
        recent_news: [{ title: 'News', date: '2024-01-01' }]
      };

      const { container } = renderCompanyInfo({ companyInfo: companyInfo });
      
      const h3 = container.querySelector('h3');
      const h4s = container.querySelectorAll('h4');
      
      expect(h3).toBeInTheDocument();
      expect(h4s.length).toBeGreaterThan(0);
    });

    it('external links have proper rel attribute for security', () => {
      const companyInfo = {
        name: 'Secure Corp',
        website: 'https://secure.com',
        recent_news: [
          {
            title: 'News',
            url: 'https://news.com',
            date: '2024-01-01'
          }
        ]
      };

      renderCompanyInfo({ companyInfo: companyInfo });
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });
});

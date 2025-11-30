import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ContactDiscovery from '../ContactDiscovery';
import api from '../../../services/api';

jest.mock('../../../services/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

const mockSuggestions = [
  {
    id: '1',
    suggested_name: 'John Doe',
    suggested_title: 'Software Engineer',
    suggested_company: 'Tech Corp',
    suggested_linkedin_url: 'https://linkedin.com/in/johndoe',
    suggestion_type: 'target_company',
    suggestion_type_display: 'Target Company',
    relevance_score: 0.85,
    reason: 'Works at target company',
    status: 'suggested',
    mutual_connections: [],
  },
  {
    id: '2',
    suggested_name: 'Jane Smith',
    suggested_title: 'Product Manager',
    suggested_company: 'Innovation Inc',
    suggestion_type: 'alumni',
    suggestion_type_display: 'Alumni',
    relevance_score: 0.90,
    reason: 'Fellow alumnus from MIT',
    status: 'suggested',
    shared_institution: 'MIT',
    mutual_connections: ['Alice'],
  },
];

const mockAnalytics = {
  overview: {
    total_suggestions: 10,
    contacted: 3,
    connected: 2,
    dismissed: 1,
    contact_rate: 30.0,
    connection_rate: 20.0,
  },
  by_type: {
    target_company: {
      label: 'Target Company',
      total: 5,
      connected: 1,
      conversion_rate: 20.0,
    },
    alumni: {
      label: 'Alumni',
      total: 3,
      connected: 1,
      conversion_rate: 33.3,
    },
  },
  recent_connections: [],
};

describe('ContactDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/contact-suggestions') {
        return Promise.resolve({ data: mockSuggestions });
      }
      if (url === '/discovery-searches') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/discovery/analytics') {
        return Promise.resolve({ data: mockAnalytics });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ContactDiscovery />
      </BrowserRouter>
    );
  };

  test('renders contact discovery header', async () => {
    renderComponent();
    expect(screen.getByText('Contact Discovery')).toBeInTheDocument();
  });

  test('displays suggestions by default', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  test('filters suggestions by type', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Mock filtered response
    api.get.mockResolvedValueOnce({
      data: [mockSuggestions[1]], // Only alumni
    });

    const typeFilter = screen.getByRole('combobox', { name: /all types/i });
    fireEvent.change(typeFilter, { target: { value: 'alumni' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/contact-suggestions',
        expect.objectContaining({
          params: expect.objectContaining({ type: 'alumni' }),
        })
      );
    });
  });

  test('switches to search view', async () => {
    renderComponent();
    
    const searchTab = screen.getByRole('button', { name: /new search/i });
    fireEvent.click(searchTab);

    await waitFor(() => {
      expect(screen.getByText('Discover New Contacts')).toBeInTheDocument();
    });
  });

  test('switches to analytics view', async () => {
    renderComponent();
    
    const analyticsTab = screen.getByRole('button', { name: /analytics/i });
    fireEvent.click(analyticsTab);

    await waitFor(() => {
      expect(screen.getByText('Discovery Analytics')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // total suggestions
    });
  });

  test('marks suggestion as contacted', async () => {
    api.patch.mockResolvedValueOnce({
      data: { ...mockSuggestions[0], status: 'contacted' },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const contactedButton = screen.getAllByText('Mark Contacted')[0];
    fireEvent.click(contactedButton);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        `/contact-suggestions/${mockSuggestions[0].id}`,
        { status: 'contacted' }
      );
    });
  });

  test('converts suggestion to contact', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        contact: { id: 'new-contact-id', display_name: 'John Doe' },
        suggestion: { ...mockSuggestions[0], status: 'connected' },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addButton = screen.getAllByText('Add to Contacts')[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/contact-suggestions/${mockSuggestions[0].id}/convert`
      );
    });
  });

  test('dismisses suggestion', async () => {
    api.patch.mockResolvedValueOnce({
      data: { ...mockSuggestions[0], status: 'dismissed' },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const dismissButton = screen.getAllByText('Dismiss')[0];
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        `/contact-suggestions/${mockSuggestions[0].id}`,
        { status: 'dismissed' }
      );
    });
  });

  test('displays empty state when no suggestions', async () => {
    api.get.mockResolvedValueOnce({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/no suggestions yet/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new search/i })).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    api.get.mockRejectedValueOnce(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/failed to load suggestions/i)).toBeInTheDocument();
    });
  });
});

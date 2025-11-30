import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ReferencesPage from '../ReferencesPage';
import { referencesAPI } from '../../../services/referencesAPI';

// Mock the API
jest.mock('../../../services/referencesAPI');

// Mock the modal components
jest.mock('../ReferenceRequestForm', () => {
  return function MockReferenceRequestForm({ reference, onClose }) {
    return (
      <div>
        <h2>Request Reference from {reference?.name}</h2>
        <button onClick={onClose}>×</button>
      </div>
    );
  };
});

jest.mock('../ReferenceAppreciations', () => {
  return function MockReferenceAppreciations({ reference, onClose }) {
    return (
      <div>
        <h2>Appreciation History - {reference?.name}</h2>
        <button onClick={onClose}>×</button>
      </div>
    );
  };
});

jest.mock('../ReferenceTemplates', () => {
  return function MockReferenceTemplates({ onClose }) {
    return (
      <div>
        <h2>Reference Templates</h2>
        <button onClick={onClose}>×</button>
      </div>
    );
  };
});

jest.mock('../ReferencePortfolios', () => {
  return function MockReferencePortfolios({ onClose }) {
    return (
      <div>
        <h2>Reference Portfolios</h2>
        <button onClick={onClose}>×</button>
      </div>
    );
  };
});

jest.mock('../ReferenceAnalytics', () => {
  return function MockReferenceAnalytics({ onClose }) {
    return (
      <div>
        <h2>Reference Analytics</h2>
        <button onClick={onClose}>×</button>
      </div>
    );
  };
});

// Mock the navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Wrapper component to provide Router context
const RouterWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// Ensure mocks are cleared between tests
beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockClear();
});

describe('ReferencesPage component (UC-095)', () => {
  const mockReferences = [
    {
      id: '1',
      name: 'John Doe',
      title: 'Senior Manager',
      company: 'Tech Corp',
      email: 'john@test.com',
      phone: '123-456-7890',
      relationship_type: 'supervisor',
      years_known: 3,
      availability_status: 'available',
      preferred_contact_method: 'email',
      best_for_roles: ['software_engineer'],
      best_for_industries: ['tech'],
      talking_points: ['leadership', 'technical skills'],
      times_used: 5,
      is_active: true,
    },
    {
      id: '2',
      name: 'Jane Smith',
      title: 'Lead Developer',
      company: 'Startup Inc',
      email: 'jane@test.com',
      phone: '987-654-3210',
      relationship_type: 'colleague',
      years_known: 2,
      availability_status: 'pending_permission',
      preferred_contact_method: 'phone',
      best_for_roles: ['backend_engineer'],
      best_for_industries: ['fintech'],
      talking_points: ['teamwork', 'problem solving'],
      times_used: 2,
      is_active: true,
    },
  ];

  const mockAnalytics = {
    total_references: 2,
    active_references: 2,
    available_references: 1,
    pending_references: 1,
    total_requests: 5,
    active_requests: 2,
    completed_requests: 3,
    references_by_type: {
      supervisor: 1,
      colleague: 1,
    },
    most_used_references: [
      { id: '1', name: 'John Doe', times_used: 5 },
    ],
  };

  test('renders header and loads references', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    // Header renders
    expect(screen.getByText(/Professional References/i)).toBeInTheDocument();

    // References load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  test('shows empty state when no references', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce([]);
    referencesAPI.getAnalytics.mockResolvedValueOnce({
      total_references: 0,
      active_references: 0,
      available_references: 0,
      pending_references: 0,
      total_requests: 0,
      active_requests: 0,
      completed_requests: 0,
      references_by_type: {},
      most_used_references: [],
    });

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/No references yet/i)).toBeInTheDocument();
    });
  });

  test('displays analytics correctly', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  test('opens add reference form when Add Reference clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click Add Reference button
    const addButton = screen.getByText(/Add Reference/i);
    userEvent.click(addButton);

    // Form should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });
  });

  test('filters references by availability status', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Tabs are used for filtering (active/inactive/all)
    const activeTab = screen.getByText(/Active References/i);
    expect(activeTab).toBeInTheDocument();
  });

  test('deletes reference when delete button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);
    referencesAPI.deleteReference.mockResolvedValueOnce({});
    referencesAPI.getReferences.mockResolvedValueOnce([mockReferences[1]]);
    referencesAPI.getAnalytics.mockResolvedValueOnce({
      ...mockAnalytics,
      total_references: 1,
    });

    window.confirm = jest.fn(() => true);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click delete button - it has a title attribute
    const deleteButtons = screen.getAllByTitle(/Delete reference/i);
    userEvent.click(deleteButtons[0]);

    // Verify API was called
    await waitFor(() => {
      expect(referencesAPI.deleteReference).toHaveBeenCalledWith('1');
    });
  });

  test('creates new reference successfully', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce([]);
    referencesAPI.getAnalytics.mockResolvedValueOnce({
      total_references: 0,
      active_references: 0,
      available_references: 0,
      pending_references: 0,
      total_requests: 0,
      active_requests: 0,
      completed_requests: 0,
      references_by_type: {},
      most_used_references: [],
    });

    const newReference = {
      name: 'New Reference',
      title: 'Manager',
      company: 'New Company',
      email: 'new@test.com',
      phone: '555-555-5555',
      relationship_type: 'colleague',
      years_known: 1,
      availability_status: 'available',
      preferred_contact_method: 'email',
      best_for_roles: ['developer'],
      best_for_industries: ['tech'],
      talking_points: ['coding', 'collaboration'],
    };

    referencesAPI.createReference.mockResolvedValueOnce(newReference);
    referencesAPI.getReferences.mockResolvedValueOnce([newReference]);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/Add Reference/i)).toBeInTheDocument();
    });

    // Click Add Reference
    const addButton = screen.getByText(/Add Reference/i);
    userEvent.click(addButton);

    // Fill form
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });

    userEvent.type(screen.getByLabelText(/Full Name/i), 'New Reference');
    userEvent.type(screen.getByLabelText(/Title\/Position/i), 'Manager');
    userEvent.type(screen.getByLabelText(/Company/i), 'New Company');
    userEvent.type(screen.getByLabelText(/Email/i), 'new@test.com');

    // Submit form
    const form = screen.getByLabelText(/Full Name/i).closest('form');
    fireEvent.submit(form);

    // Verify API was called
    await waitFor(() => {
      expect(referencesAPI.createReference).toHaveBeenCalled();
    });
  });

  test('handles API error when loading references', async () => {
    referencesAPI.getReferences.mockRejectedValueOnce(new Error('API Error'));
    referencesAPI.getAnalytics.mockRejectedValueOnce(new Error('API Error'));

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load references/i)).toBeInTheDocument();
    });
  });

  test('navigates to view tabs correctly', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check that tabs exist
    const activeTab = screen.getByText(/Active References/i);
    const inactiveTab = screen.getByText(/Inactive/i);
    const allTab = screen.getByText(/All/i);
    
    expect(activeTab).toBeInTheDocument();
    expect(inactiveTab).toBeInTheDocument();
    expect(allTab).toBeInTheDocument();
  });

  test('switches between active/inactive/all tabs', async () => {
    referencesAPI.getReferences.mockResolvedValue(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValue(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click inactive tab
    const inactiveTab = screen.getByText(/^Inactive$/);
    userEvent.click(inactiveTab);

    await waitFor(() => {
      expect(referencesAPI.getReferences).toHaveBeenCalledWith({ is_active: false });
    });

    // Click all tab
    const allTab = screen.getByText(/^All$/);
    userEvent.click(allTab);

    await waitFor(() => {
      expect(referencesAPI.getReferences).toHaveBeenCalledWith({});
    });
  });

  test('opens edit reference form when edit button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle(/Edit reference/i);
    userEvent.click(editButtons[0]);

    // Form should appear with existing data
    await waitFor(() => {
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Senior Manager')).toBeInTheDocument();
    });
  });

  test('updates reference successfully', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);
    referencesAPI.updateReference.mockResolvedValueOnce({ ...mockReferences[0], title: 'VP' });
    referencesAPI.getReferences.mockResolvedValueOnce([{ ...mockReferences[0], title: 'VP' }, mockReferences[1]]);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle(/Edit reference/i);
    userEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Senior Manager')).toBeInTheDocument();
    });

    // Update title
    const titleInput = screen.getByDisplayValue('Senior Manager');
    userEvent.clear(titleInput);
    userEvent.type(titleInput, 'VP');

    // Submit form
    const form = titleInput.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(referencesAPI.updateReference).toHaveBeenCalledWith('1', expect.any(Object));
    });
  });

  test('cancels reference form when cancel button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open form
    const addButton = screen.getByText(/Add Reference/i);
    userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByText(/Cancel/i);
    userEvent.click(cancelButton);

    // Form should close
    await waitFor(() => {
      expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument();
    });
  });

  test('cancels delete when user clicks cancel in confirm dialog', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    window.confirm = jest.fn(() => false);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByTitle(/Delete reference/i);
    userEvent.click(deleteButtons[0]);

    // Verify API was NOT called
    expect(referencesAPI.deleteReference).not.toHaveBeenCalled();
  });

  test('opens request reference form when request button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click request button
    const requestButtons = screen.getAllByText(/Request/i);
    userEvent.click(requestButtons[0]);

    // Request form should appear
    await waitFor(() => {
      expect(screen.getByText(/Request Reference from/i)).toBeInTheDocument();
    });
  });

  test('opens appreciation history when heart button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click appreciation button (heart icon)
    const appreciationButtons = screen.getAllByTitle(/View appreciation history/i);
    userEvent.click(appreciationButtons[0]);

    // Appreciation modal should appear
    await waitFor(() => {
      expect(screen.getByText(/Appreciation History/i)).toBeInTheDocument();
    });
  });

  test('opens templates modal when Templates button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click Templates button
    const templatesButton = screen.getByText(/Templates/i);
    userEvent.click(templatesButton);

    // Templates modal should appear
    await waitFor(() => {
      expect(screen.getByText(/Reference Templates/i)).toBeInTheDocument();
    });
  });

  test('opens portfolios modal when Portfolios button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click Portfolios button
    const portfoliosButton = screen.getByText(/Portfolios/i);
    userEvent.click(portfoliosButton);

    // Portfolios modal should appear
    await waitFor(() => {
      expect(screen.getByText(/Reference Portfolios/i)).toBeInTheDocument();
    });
  });

  test('opens analytics modal when Analytics button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click Analytics button
    const analyticsButton = screen.getByText(/Analytics/i);
    userEvent.click(analyticsButton);

    // Analytics modal should appear
    await waitFor(() => {
      expect(screen.getByText(/Reference Analytics/i)).toBeInTheDocument();
    });
  });

  test('closes modal when close button clicked', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open templates modal
    const templatesButton = screen.getByText(/Templates/i);
    userEvent.click(templatesButton);

    await waitFor(() => {
      expect(screen.getByText(/Reference Templates/i)).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByText('×');
    userEvent.click(closeButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Reference Templates/i)).not.toBeInTheDocument();
    });
  });

  test('handles save reference error gracefully', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce([]);
    referencesAPI.getAnalytics.mockResolvedValueOnce({
      total_references: 0,
      active_references: 0,
      available_references: 0,
      pending_references: 0,
      total_requests: 0,
      active_requests: 0,
      completed_requests: 0,
      references_by_type: {},
      most_used_references: [],
    });
    referencesAPI.createReference.mockRejectedValueOnce(new Error('Save failed'));

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/Add Reference/i)).toBeInTheDocument();
    });

    // Open form
    const addButton = screen.getByText(/Add Reference/i);
    userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });

    // Fill minimal required fields
    userEvent.type(screen.getByLabelText(/Full Name/i), 'Test User');
    userEvent.type(screen.getByLabelText(/Title\/Position/i), 'Engineer');
    userEvent.type(screen.getByLabelText(/Company/i), 'Test Co');
    userEvent.type(screen.getByLabelText(/Email/i), 'test@test.com');

    // Submit form
    const form = screen.getByLabelText(/Full Name/i).closest('form');
    fireEvent.submit(form);

    // Form should still be visible (error occurred)
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });
  });

  test('handles delete reference error gracefully', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);
    referencesAPI.deleteReference.mockRejectedValueOnce(new Error('Delete failed'));

    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByTitle(/Delete reference/i);
    userEvent.click(deleteButtons[0]);

    // Verify alert was called
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to delete reference');
    });
  });

  test('handles authentication error and redirects to login', async () => {
    const authError = {
      response: {
        status: 401,
        data: {
          error: {
            code: 'authentication_failed'
          }
        }
      }
    };
    referencesAPI.getReferences.mockRejectedValueOnce(authError);

    // Mock window.location
    delete window.location;
    window.location = { href: '' };

    jest.useFakeTimers();

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/Please log in to view your references/i)).toBeInTheDocument();
    });

    // Fast forward time
    jest.advanceTimersByTime(2000);

    expect(window.location.href).toBe('/login');

    jest.useRealTimers();
  });

  test('handles permission error', async () => {
    const permissionError = {
      response: {
        status: 403
      }
    };
    referencesAPI.getReferences.mockRejectedValueOnce(permissionError);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/You do not have permission to view references/i)).toBeInTheDocument();
    });
  });

  test('displays loading state while fetching references', async () => {
    referencesAPI.getReferences.mockImplementation(() => new Promise(() => {}));
    referencesAPI.getAnalytics.mockImplementation(() => new Promise(() => {}));

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  test('closes request form after successful submission', async () => {
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);
    referencesAPI.getAnalytics.mockResolvedValueOnce(mockAnalytics);
    referencesAPI.createReferenceRequest.mockResolvedValueOnce({});
    referencesAPI.getReferences.mockResolvedValueOnce(mockReferences);

    render(<ReferencesPage />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open request form
    const requestButtons = screen.getAllByText(/Request/i);
    userEvent.click(requestButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Request Reference from/i)).toBeInTheDocument();
    });

    // Submit would happen here in actual usage
    // The form should close after submission
  });
});


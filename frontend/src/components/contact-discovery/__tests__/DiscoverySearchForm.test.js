import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiscoverySearchForm from '../DiscoverySearchForm';

describe('DiscoverySearchForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <DiscoverySearchForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );
  };

  test('renders form header and description', () => {
    renderComponent();
    
    expect(screen.getByText('Discover New Contacts')).toBeInTheDocument();
    expect(screen.getByText(/define your search criteria/i)).toBeInTheDocument();
  });

  test('renders all input sections', () => {
    renderComponent();
    
    expect(screen.getByLabelText(/target companies/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target roles/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target industries/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target locations/i)).toBeInTheDocument();
  });

  test('renders checkboxes for discovery options', () => {
    renderComponent();
    
    expect(screen.getByText(/include alumni/i)).toBeInTheDocument();
    expect(screen.getByText(/include contacts with mutual connections/i)).toBeInTheDocument();
    expect(screen.getByText(/include industry leaders/i)).toBeInTheDocument();
  });

  test('adds company to list', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add company names/i);
    const addButton = screen.getAllByText('Add')[0];
    
    fireEvent.change(input, { target: { value: 'Google' } });
    fireEvent.click(addButton);
    
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  test('adds company on Enter key', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add company names/i);
    
    fireEvent.change(input, { target: { value: 'Microsoft' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    expect(screen.getByText('Microsoft')).toBeInTheDocument();
  });

  test('removes company from list', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add company names/i);
    const addButton = screen.getAllByText('Add')[0];
    
    fireEvent.change(input, { target: { value: 'Apple' } });
    fireEvent.click(addButton);
    
    expect(screen.getByText('Apple')).toBeInTheDocument();
    
    const removeButton = screen.getByRole('button', { name: '×' });
    fireEvent.click(removeButton);
    
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  test('adds multiple roles', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add job titles/i);
    const addButton = screen.getAllByText('Add')[1];
    
    fireEvent.change(input, { target: { value: 'Software Engineer' } });
    fireEvent.click(addButton);
    
    fireEvent.change(input, { target: { value: 'Product Manager' } });
    fireEvent.click(addButton);
    
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Product Manager')).toBeInTheDocument();
  });

  test('toggles checkbox options', () => {
    renderComponent();
    
    const alumniCheckbox = screen.getByRole('checkbox', { name: /include alumni/i });
    const mutualCheckbox = screen.getByRole('checkbox', { name: /mutual connections/i });
    const leadersCheckbox = screen.getByRole('checkbox', { name: /industry leaders/i });
    
    // Alumni should be checked by default
    expect(alumniCheckbox).toBeChecked();
    expect(mutualCheckbox).toBeChecked();
    expect(leadersCheckbox).not.toBeChecked();
    
    // Toggle alumni off
    fireEvent.click(alumniCheckbox);
    expect(alumniCheckbox).not.toBeChecked();
    
    // Toggle leaders on
    fireEvent.click(leadersCheckbox);
    expect(leadersCheckbox).toBeChecked();
  });

  test('submits form with data', async () => {
    renderComponent();
    
    // Add companies
    const companyInput = screen.getByPlaceholderText(/add company names/i);
    fireEvent.change(companyInput, { target: { value: 'Google' } });
    fireEvent.click(screen.getAllByText('Add')[0]);
    
    // Add roles
    const roleInput = screen.getByPlaceholderText(/add job titles/i);
    fireEvent.change(roleInput, { target: { value: 'Engineer' } });
    fireEvent.click(screen.getAllByText('Add')[1]);
    
    // Toggle options
    const leadersCheckbox = screen.getByRole('checkbox', { name: /industry leaders/i });
    fireEvent.click(leadersCheckbox);
    
    // Submit
    const submitButton = screen.getByText('Generate Suggestions');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          target_companies: ['Google'],
          target_roles: ['Engineer'],
          include_alumni: true,
          include_mutual_connections: true,
          include_industry_leaders: true,
        })
      );
    });
  });

  test('calls onCancel when cancel button clicked', () => {
    renderComponent();
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('shows loading state during submission', async () => {
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderComponent();
    
    // Add a company first (required for form validation)
    const companyInput = screen.getByPlaceholderText(/Add company names/i);
    fireEvent.change(companyInput, { target: { value: 'TechCorp' } });
    fireEvent.keyPress(companyInput, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    // Wait for tag to appear
    await waitFor(() => {
      expect(screen.getByText('TechCorp')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Generate Suggestions');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    });
  });

  test('does not add empty values', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add company names/i);
    const addButton = screen.getAllByText('Add')[0];
    
    // Try to add empty value
    fireEvent.click(addButton);
    
    // Should not find any company tags
    const tags = screen.queryAllByRole('button', { name: '×' });
    expect(tags).toHaveLength(0);
  });

  test('trims whitespace from input values', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add company names/i);
    const addButton = screen.getAllByText('Add')[0];
    
    fireEvent.change(input, { target: { value: '  Amazon  ' } });
    fireEvent.click(addButton);
    
    expect(screen.getByText('Amazon')).toBeInTheDocument();
  });

  test('clears input after adding item', () => {
    renderComponent();
    
    const input = screen.getByPlaceholderText(/add company names/i);
    const addButton = screen.getAllByText('Add')[0];
    
    fireEvent.change(input, { target: { value: 'Tesla' } });
    fireEvent.click(addButton);
    
    expect(input.value).toBe('');
  });
});

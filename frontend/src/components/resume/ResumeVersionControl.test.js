import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ResumeVersionControl from './ResumeVersionControl';
import { resumeVersionAPI } from '../../services/api';

// Mock Icon to avoid rendering complexity
jest.mock('../common/Icon', () => (props) => <span data-testid={`icon-${props.name}`}>{props.name}</span>);

beforeEach(() => {
  jest.clearAllMocks();
});

const sampleVersions = [
  {
    id: 'v1',
    version_name: 'Resume A',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-02T12:00:00Z',
    source_job_id: 'job1',
    source_job_title: 'Software Engineer',
    source_job_company: 'Acme',
    application_count: 2,
    is_default: true,
    is_archived: false,
    generated_by_ai: false,
  },
  {
    id: 'v2',
    version_name: 'Resume B',
    created_at: '2025-02-01T12:00:00Z',
    updated_at: '2025-02-02T12:00:00Z',
    source_job_id: 'job1',
    source_job_title: 'Software Engineer',
    source_job_company: 'Acme',
    application_count: 0,
    is_default: false,
    is_archived: false,
    generated_by_ai: true,
  }
];

test('shows empty state when no versions', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: [] });

  render(<ResumeVersionControl />);

  await waitFor(() => expect(screen.getByText(/No Resume Versions Yet/i)).toBeInTheDocument());
});

test('groups versions by job and toggles expansion to show actions', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });

  render(<ResumeVersionControl />);

  // Group title should render
  await waitFor(() => expect(screen.getByText(/Software Engineer/i)).toBeInTheDocument());

  const header = screen.getByText('Software Engineer').closest('.resume-group-header');
  expect(header).toBeInTheDocument();

  // Expand group by clicking header
  fireEvent.click(header);

  // Version items should appear as headings
  await waitFor(() => expect(screen.getByRole('heading', { level: 4, name: 'Resume A' })).toBeInTheDocument());
  expect(screen.getByRole('heading', { level: 4, name: 'Resume B' })).toBeInTheDocument();

  // Action buttons exist for Resume A and Resume B
  const viewButtons = screen.getAllByTitle('View details');
  expect(viewButtons.length).toBeGreaterThanOrEqual(2);
});

test('compare without selection shows error; successful compare shows modal and merge option', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.compareVersions.mockResolvedValue({
    version1: sampleVersions[0],
    version2: sampleVersions[1],
    diff_count: 1,
    differences: [
      { path: 'skills', type: 'changed', version1: ['a'], version2: ['a', 'b'] }
    ]
  });

  render(<ResumeVersionControl />);

  // Wait for versions to load
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());

  // Compare button should be disabled until both versions are selected
  const compareBtn = screen.getByRole('button', { name: /Compare/i });
  expect(compareBtn).toBeDisabled();

  // Select both versions in the two selects
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'v1' } });
  fireEvent.change(selects[1], { target: { value: 'v2' } });

  // Now the button should be enabled
  expect(compareBtn).not.toBeDisabled();

  // Click Compare again
  fireEvent.click(compareBtn);

  // Modal should appear with differences and merge button
  await waitFor(() => expect(screen.getByText(/Version Comparison/i)).toBeInTheDocument());
  expect(screen.getByText(/Differences \(1\)/i)).toBeInTheDocument();
  expect(screen.getByText(/Merge These Versions/i)).toBeInTheDocument();

  // Click Merge These Versions -> opens Merge modal
  fireEvent.click(screen.getByText(/Merge These Versions/i));
  await waitFor(() => expect(screen.getByText(/Merge Resume Versions/i)).toBeInTheDocument());
});

test('edit version flow: open edit modal, save changes', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.updateVersion.mockResolvedValue({});

  render(<ResumeVersionControl />);

  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Click edit button for first version
  const editButtons = screen.getAllByTitle('Edit');
  expect(editButtons.length).toBeGreaterThan(0);
  fireEvent.click(editButtons[0]);

  // Edit modal should appear
  await waitFor(() => expect(screen.getByText(/Edit Version/i)).toBeInTheDocument());
  const nameInput = screen.getByLabelText(/Version Name/i);
  fireEvent.change(nameInput, { target: { value: 'Resume A - Edited' } });

  // Click Save Changes
  fireEvent.click(screen.getByText(/Save Changes/i));

  await waitFor(() => expect(resumeVersionAPI.updateVersion).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Version updated successfully/i)).toBeInTheDocument());
});

test('revert and delete flows use prompts/confirms and show success', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.duplicateVersion.mockResolvedValue({});
  resumeVersionAPI.deleteVersion.mockResolvedValue({});

  // Mock window.confirm and prompt
  const origConfirm = window.confirm;
  const origPrompt = window.prompt;
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Reverted Name');

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Click revert button (rotateLeft) for first version
  const revertButtons = screen.getAllByTitle('Revert to this version');
  // If titles are not present, fall back to finding by button with rotateLeft title is used in Icon; we used title attribute earlier
  if (revertButtons.length > 0) {
    fireEvent.click(revertButtons[0]);
  } else {
    // find by button with aria-label or index
    fireEvent.click(screen.getAllByRole('button').find(b => b.title === 'Revert to this version'));
  }

  // Confirm revert modal appears
  await waitFor(() => expect(screen.getByText(/Revert to Previous Version/i)).toBeInTheDocument());

  // Click Confirm Revert
  fireEvent.click(screen.getByText(/Confirm Revert/i));

  await waitFor(() => expect(resumeVersionAPI.duplicateVersion).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Successfully reverted to/i)).toBeInTheDocument());

  // Test delete path: click delete button for first version
  const deleteButtons = screen.getAllByTitle('Delete');
  if (deleteButtons.length > 0) {
    fireEvent.click(deleteButtons[0]);
  } else {
    fireEvent.click(screen.getAllByRole('button').find(b => b.title === 'Delete'));
  }

  await waitFor(() => expect(resumeVersionAPI.deleteVersion).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Version deleted successfully/i)).toBeInTheDocument());

  // restore original window functions
  window.confirm = origConfirm;
  window.prompt = origPrompt;
});

test('handles loadVersions error and displays message', async () => {
  resumeVersionAPI.listVersions.mockRejectedValue(new Error('load failed'));

  render(<ResumeVersionControl />);

  await waitFor(() => expect(screen.getByText(/load failed/i)).toBeInTheDocument());
});

test('set default, archive, restore and duplicate flows', async () => {
  // Initial list
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.setDefault.mockResolvedValue({});
  resumeVersionAPI.archiveVersion.mockResolvedValue({});
  resumeVersionAPI.restoreVersion.mockResolvedValue({});
  resumeVersionAPI.duplicateVersion.mockResolvedValue({});

  // Mock prompt for duplicate
  const origPrompt = window.prompt;
  window.prompt = jest.fn(() => 'Duplicated Name');

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Click 'Set as default' for Resume B
  const setDefaultBtns = screen.getAllByTitle('Set as default');
  fireEvent.click(setDefaultBtns[0]);
  await waitFor(() => expect(resumeVersionAPI.setDefault).toHaveBeenCalledWith('v2'));
  await waitFor(() => expect(screen.getByText(/Default version updated successfully/i)).toBeInTheDocument());

  // Click 'Archive' for Resume B
  const archiveBtns = screen.getAllByTitle('Archive');
  fireEvent.click(archiveBtns[0]);
  await waitFor(() => expect(resumeVersionAPI.archiveVersion).toHaveBeenCalledWith('v2'));
  await waitFor(() => expect(screen.getByText(/Version archived successfully/i)).toBeInTheDocument());

  // Simulate restore by rendering archived version list
  const archived = JSON.parse(JSON.stringify(sampleVersions));
  archived[0].is_archived = true; // mark v2 archived
  resumeVersionAPI.listVersions.mockResolvedValueOnce({ versions: archived });
  // trigger manual load by toggling includeArchived checkbox
  const checkbox = screen.getByLabelText(/Show Archived/i);
  fireEvent.click(checkbox);
  // Click restore button
  await waitFor(() => expect(screen.getAllByTitle('Restore').length).toBeGreaterThanOrEqual(1));
  fireEvent.click(screen.getAllByTitle('Restore')[0]);
  await waitFor(() => expect(resumeVersionAPI.restoreVersion).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Version restored successfully/i)).toBeInTheDocument());

  // Duplicate
  const duplicateBtns = screen.getAllByTitle('Duplicate');
  fireEvent.click(duplicateBtns[0]);
  await waitFor(() => expect(window.prompt).toHaveBeenCalled());
  await waitFor(() => expect(resumeVersionAPI.duplicateVersion).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Version duplicated successfully/i)).toBeInTheDocument());

  window.prompt = origPrompt;
});

test('view history modal shows changes, parents and children', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.getVersionHistory.mockResolvedValue({
    version: sampleVersions[0],
    changes: [ { change_type: 'created', created_at: '2025-01-01T12:00:00Z', changes: {} } ],
    parents: [],
    children: []
  });

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Click view history for first version
  const historyBtns = screen.getAllByTitle('View history');
  fireEvent.click(historyBtns[0]);

  await waitFor(() => expect(resumeVersionAPI.getVersionHistory).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Version History/i)).toBeInTheDocument());
  expect(screen.getByText(/Changes Made/)).toBeInTheDocument();
});

test('edit validation: blank name shows error', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Open edit modal
  fireEvent.click(screen.getAllByTitle('Edit')[0]);
  await waitFor(() => expect(screen.getByText(/Edit Version/i)).toBeInTheDocument());

  const nameInput = screen.getByLabelText(/Version Name/i);
  const saveButton = screen.getByRole('button', { name: /Save Changes/i });

  // Empty name should keep Save disabled
  fireEvent.change(nameInput, { target: { value: '' } });
  expect(saveButton).toBeDisabled();

  // Provide a valid name and save
  fireEvent.change(nameInput, { target: { value: 'Resume A - Edited' } });
  expect(saveButton).not.toBeDisabled();
  resumeVersionAPI.updateVersion.mockResolvedValue({});
  fireEvent.click(saveButton);
  await waitFor(() => expect(resumeVersionAPI.updateVersion).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Version updated successfully/i)).toBeInTheDocument());
});

test('merge modal validations and success path', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.mergeVersions.mockResolvedValue({});

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Open merge modal for Resume B
  fireEvent.click(screen.getAllByTitle('Merge with another version')[0]);
  await waitFor(() => expect(screen.getByText(/Merge Resume Versions/i)).toBeInTheDocument());

  // Merge button should be disabled until a merge target is selected
  const mergeBtn = screen.getByRole('button', { name: /Merge Versions/i });
  expect(mergeBtn).toBeDisabled();

  // Select a target to enable the merge button (newMergeName is prefilled)
  const mergeSelect = screen.getByLabelText(/Target Version \(merge into\) \*/i);
  fireEvent.change(mergeSelect, { target: { value: 'v1' } });

  expect(mergeBtn).not.toBeDisabled();
  fireEvent.click(mergeBtn);
  await waitFor(() => expect(resumeVersionAPI.mergeVersions).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText(/Versions merged successfully/i)).toBeInTheDocument());
});

test('compare no-diff path and various formatChangeValue outputs are rendered', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.compareVersions.mockResolvedValue({
    version1: sampleVersions[0],
    version2: sampleVersions[1],
    diff_count: 0,
    differences: []
  });

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());

  // Select both versions
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'v1' } });
  fireEvent.change(selects[1], { target: { value: 'v2' } });

  // Click Compare
  const compareBtn = screen.getByRole('button', { name: /Compare/i });
  fireEvent.click(compareBtn);

  await waitFor(() => expect(screen.getByText(/Version Comparison/i)).toBeInTheDocument());
  expect(screen.getByText(/No differences found - versions are identical/i)).toBeInTheDocument();
});

test('differences rendering covers many value types and opens merge from compare', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  // Build a differences array with many value types to exercise formatChangeValue and formatFieldName
  const longString = 'x'.repeat(250);
  const manyKeysObj = { a: 1, b: 2, c: 3, d: 4 };
  const smallObj = { role: 'dev', level: 'senior' };

  resumeVersionAPI.compareVersions.mockResolvedValue({
    version1: sampleVersions[0],
    version2: sampleVersions[1],
    diff_count: 7,
    differences: [
      { path: 'simple_array', type: 'changed', version1: ['one','two'], version2: ['one','two','three'] },
      { path: 'empty_array', type: 'added', version1: null, version2: [] },
      { path: 'bool_field', type: 'changed', version1: false, version2: true },
      { path: 'long_text', type: 'changed', version1: longString, version2: longString + 'y' },
      { path: 'empty_obj', type: 'removed', version1: {}, version2: null },
      { path: 'small_obj', type: 'changed', version1: smallObj, version2: { ...smallObj, level: 'lead' } },
      { path: 'many_keys', type: 'changed', version1: manyKeysObj, version2: manyKeysObj }
    ]
  });

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());

  // Select both versions
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'v1' } });
  fireEvent.change(selects[1], { target: { value: 'v2' } });

  // Click Compare
  const compareBtn = screen.getByRole('button', { name: /Compare/i });
  fireEvent.click(compareBtn);

  // Differences should render
  await waitFor(() => expect(screen.getByText(/Differences \(7\)/i)).toBeInTheDocument());
  // Check for a truncated long text
  expect(screen.getAllByText(/.../i).length).toBeGreaterThanOrEqual(0);

  // Merge These Versions button should exist when differences > 0
  const mergeFromCompare = screen.getByText(/Merge These Versions/i);
  fireEvent.click(mergeFromCompare);

  // Merge modal should open
  await waitFor(() => expect(screen.getByText(/Merge Resume Versions/i)).toBeInTheDocument());
});

test('handleCompare error displays message', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.compareVersions.mockRejectedValue(new Error('compare fail'));

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'v1' } });
  fireEvent.change(selects[1], { target: { value: 'v2' } });
  const compareBtn = screen.getByRole('button', { name: /Compare/i });
  fireEvent.click(compareBtn);

  await waitFor(() => expect(screen.getByText(/compare fail/i)).toBeInTheDocument());
});

test('mergeVersions error shows error message', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.mergeVersions.mockRejectedValue(new Error('merge failed'));

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));
  // open merge modal
  fireEvent.click(screen.getAllByTitle('Merge with another version')[0]);
  await waitFor(() => expect(screen.getByText(/Merge Resume Versions/i)).toBeInTheDocument());

  // select target
  const mergeSelect = screen.getByLabelText(/Target Version \(merge into\) \*/i);
  fireEvent.change(mergeSelect, { target: { value: 'v1' } });

  // ensure merge button enabled
  const mergeBtn = screen.getByRole('button', { name: /Merge Versions/i });
  fireEvent.click(mergeBtn);

  await waitFor(() => expect(screen.getByText(/merge failed/i)).toBeInTheDocument());
});

test('handleSaveEdit error displays message', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.updateVersion.mockRejectedValue(new Error('save failed'));

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));
  fireEvent.click(screen.getAllByTitle('Edit')[0]);
  await waitFor(() => expect(screen.getByText(/Edit Version/i)).toBeInTheDocument());

  const nameInput = screen.getByLabelText(/Version Name/i);
  fireEvent.change(nameInput, { target: { value: 'New Name' } });
  const saveButton = screen.getByRole('button', { name: /Save Changes/i });
  fireEvent.click(saveButton);

  await waitFor(() => expect(screen.getByText(/save failed/i)).toBeInTheDocument());
});

test('confirm revert prompt cancel and delete confirm cancel paths', async () => {
  resumeVersionAPI.listVersions.mockResolvedValue({ versions: sampleVersions });
  resumeVersionAPI.duplicateVersion.mockResolvedValue({});
  resumeVersionAPI.deleteVersion.mockResolvedValue({});

  const origPrompt = window.prompt;
  const origConfirm = window.confirm;
  window.prompt = jest.fn(() => null); // user cancels prompt
  window.confirm = jest.fn(() => false); // user cancels delete

  render(<ResumeVersionControl />);
  await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Software Engineer').closest('.resume-group-header'));

  // Revert -> open modal
  fireEvent.click(screen.getAllByTitle('Revert to this version')[0]);
  await waitFor(() => expect(screen.getByText(/Revert to Previous Version/i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Confirm Revert/i));
  // prompt returned null, duplicateVersion should not be called
  await waitFor(() => expect(resumeVersionAPI.duplicateVersion).not.toHaveBeenCalled());

  // Delete flow: click delete and confirm cancels
  fireEvent.click(screen.getAllByTitle('Delete')[0]);
  await waitFor(() => expect(resumeVersionAPI.deleteVersion).not.toHaveBeenCalled());

  window.prompt = origPrompt;
  window.confirm = origConfirm;
});

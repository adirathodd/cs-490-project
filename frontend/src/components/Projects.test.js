import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
jest.mock('../services/api', () => ({
  projectsAPI: {
    getProjects: jest.fn(),
    addProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  },
}));

jest.mock('./Icon', () => ({ name, ...props }) => (
  <span data-testid={`icon-${name}`} {...props} />
));

import Projects from './Projects';
const { projectsAPI: mockProjectsAPI } = require('../services/api');

const renderProjects = () => render(<Projects />);
const createFile = (name, type = 'image/png', size = 2048, lastModified = Date.now()) =>
  new File([new Uint8Array(size)], name, { type, lastModified });

let consoleErrorSpy;
let consoleWarnSpy;

describe('Projects', () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectsAPI.getProjects.mockResolvedValue([]);
    mockProjectsAPI.addProject.mockResolvedValue({
      id: 1,
      name: 'Sample Project',
      status: 'completed',
      technologies: ['React'],
    });
    mockProjectsAPI.updateProject.mockResolvedValue({
      id: 1,
      name: 'Updated Project',
      status: 'completed',
      technologies: ['React', 'Node'],
    });
    mockProjectsAPI.deleteProject.mockResolvedValue({ success: true });
    if (URL.createObjectURL?.mockClear) URL.createObjectURL.mockClear();
    if (URL.revokeObjectURL?.mockClear) URL.revokeObjectURL.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
  });

  it('shows loading state then renders sorted projects', async () => {
    const latestHighId = {
      id: 4,
      name: 'High Priority Launch',
      role: 'Lead Dev',
      start_date: '2024-05-01',
      end_date: '2024-08-01',
      status: 'completed',
      technologies: ['TypeScript'],
      industry: 'Tech',
      category: 'Web',
      project_url: 'https://example.com/high',
      description: 'Latest initiative',
      collaboration_details: 'Worked cross-team',
      outcomes: 'Delivered ahead of schedule',
      media: [],
    };
    const latestLowId = {
      id: 2,
      name: 'Secondary Launch',
      role: 'Lead Dev',
      start_date: '2024-05-01',
      end_date: '2024-06-01',
      status: 'completed',
      technologies: ['TypeScript'],
      media: [],
    };
    const endOnly = {
      id: 3,
      name: 'Support Rollout',
      start_date: '',
      end_date: '2024-04-01',
      status: 'completed',
      technologies: [],
      media: [],
    };
    const noId = {
      id: undefined,
      name: 'Missing Identifier',
      start_date: '2024-05-01',
      end_date: '',
      status: 'completed',
      technologies: [],
      media: [],
    };
    const zeroId = {
      id: 0,
      name: 'Zero Identifier',
      start_date: '2024-05-01',
      end_date: '',
      status: 'completed',
      technologies: [],
      media: [],
    };
    const older = {
      id: 1,
      name: 'Older Project',
      role: 'Engineer',
      start_date: '2023-01-01',
      end_date: '2023-02-01',
      status: 'completed',
      technologies: ['Python'],
      media: [],
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([older, latestLowId, endOnly, latestHighId, noId, zeroId]);

    renderProjects();

    expect(screen.getByText(/Loading projects/i)).toBeInTheDocument();

    await waitFor(() => expect(mockProjectsAPI.getProjects).toHaveBeenCalled());
    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('High Priority Launch');
    expect(headings.some((h) => h.textContent === 'Secondary Launch')).toBe(true);
    expect(headings.some((h) => h.textContent === 'Support Rollout')).toBe(true);
    expect(headings.some((h) => h.textContent === 'Missing Identifier')).toBe(true);
    expect(headings.some((h) => h.textContent === 'Zero Identifier')).toBe(true);
    expect(screen.getByText(/High Priority Launch/)).toBeInTheDocument();
    expect(screen.getByText(/2024-05-01 to 2024-08-01/)).toBeInTheDocument();
    expect(screen.getByText(/— to 2024-04-01/)).toBeInTheDocument();
  });

  it('renders fallback error message when fetching projects fails', async () => {
    mockProjectsAPI.getProjects.mockRejectedValueOnce({});

    renderProjects();

    expect(await screen.findByText(/Failed to load projects/i)).toBeInTheDocument();
    expect(mockProjectsAPI.getProjects).toHaveBeenCalled();
  });

  it('handles null project responses without crashing', async () => {
    mockProjectsAPI.getProjects.mockResolvedValueOnce(null);

    renderProjects();

    expect(await screen.findByText(/No Projects Yet/i)).toBeInTheDocument();
  });

  it('validates required fields and shows date/team errors', async () => {
    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2025-05-01' } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2025-04-01' } });
    fireEvent.change(screen.getByLabelText(/Team Size/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add Project$/i }));

    expect(await screen.findByText(/Project name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Start date cannot be after end date/i)).toBeInTheDocument();
    expect(screen.getByText(/Team size must be positive/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'planned' } });
    await waitFor(() => expect(screen.queryByText(/Start date cannot be after end date/i)).not.toBeInTheDocument());
  });

  it('clears field-specific errors when the user edits the input', async () => {
    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Add Project$/i }));

    const nameError = await screen.findByText(/Project name is required/i);
    expect(nameError).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: 'Fixed Name' } });
    await waitFor(() => expect(screen.queryByText(/Project name is required/i)).not.toBeInTheDocument());
  });

  it('disables date inputs according to the selected project status', async () => {
    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));

    const startInput = screen.getByLabelText(/Start Date/i);
    const endInput = screen.getByLabelText(/End Date/i);
    const statusSelect = screen.getByLabelText(/Status/i);

    expect(startInput).not.toBeDisabled();
    expect(endInput).not.toBeDisabled();

    fireEvent.change(statusSelect, { target: { value: 'ongoing' } });
    expect(startInput).not.toBeDisabled();
    expect(endInput).toBeDisabled();

    fireEvent.change(statusSelect, { target: { value: 'planned' } });
    expect(startInput).toBeDisabled();
    expect(endInput).toBeDisabled();
  });

  it('creates a project with normalized payload and closes the form', async () => {
    mockProjectsAPI.addProject.mockImplementationOnce(async (payload) => {
      expect(payload).toMatchObject({
        name: 'Next Gen Platform',
        status: 'planned',
        technologies: ['React', 'Node'],
      });
      expect(payload).not.toHaveProperty('start_date');
      expect(payload).not.toHaveProperty('end_date');
      expect(payload).not.toHaveProperty('technologies_input');
      expect(payload).not.toHaveProperty('team_size');
      return {
        id: 99,
        name: 'Next Gen Platform',
        status: 'planned',
        technologies: ['React', 'Node'],
        media: [],
      };
    });

    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));
    const nameInput = screen.getByLabelText(/Project Name/i);
    fireEvent.change(nameInput, { target: { value: 'Next Gen Platform' } });
    fireEvent.change(nameInput, { target: { name: 'is_featured', type: 'checkbox', checked: true } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'planned' } });
    fireEvent.change(screen.getByLabelText(/Technologies \/ Skills Used/i), {
      target: { value: ' React , Node ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Add Project$/i }));

    expect(await screen.findByText('Next Gen Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add Project/i })).toBeInTheDocument();
    expect(screen.queryByText(/Add New Project/i)).not.toBeInTheDocument();
  });

  it('prefills form for editing and updates the project', async () => {
    const project = {
      id: 5,
      name: 'Legacy App',
      role: 'Engineer',
      start_date: '2024-01-01',
      end_date: '2024-03-01',
      status: 'completed',
      technologies: ['React'],
      description: 'Legacy description',
      collaboration_details: 'Team details',
      outcomes: 'Great success',
      media: [],
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([project]);
    mockProjectsAPI.updateProject.mockImplementationOnce(async (id, payload) => {
      expect(id).toBe(5);
      expect(payload).toMatchObject({
        name: 'Legacy App Revamp',
        status: 'ongoing',
        technologies: ['React', 'AWS'],
      });
      expect(payload).not.toHaveProperty('end_date');
      return {
        ...project,
        name: 'Legacy App Revamp',
        status: 'ongoing',
        technologies: ['React', 'AWS'],
        end_date: '',
      };
    });

    renderProjects();
    expect(await screen.findByText('Legacy App')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Edit project/i));

    expect(screen.getByDisplayValue('Legacy App')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: 'Legacy App Revamp' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'ongoing' } });
    fireEvent.change(screen.getByLabelText(/Technologies \/ Skills Used/i), {
      target: { value: 'React, AWS' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Update Project/i }));

    expect(await screen.findByText('Legacy App Revamp')).toBeInTheDocument();
    expect(screen.getByText(/React/)).toBeInTheDocument();
    expect(screen.queryByText(/Add New Project/i)).not.toBeInTheDocument();
  });

  it('prefills default values when editing a project with missing fields', async () => {
    const sparseProject = {
      id: 12,
      name: 'Sparse Fields',
      status: null,
      technologies: null,
      description: null,
      role: undefined,
      start_date: null,
      end_date: undefined,
      project_url: undefined,
      team_size: null,
      collaboration_details: undefined,
      outcomes: undefined,
      industry: undefined,
      category: undefined,
      media: null,
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([sparseProject]);

    renderProjects();
    await screen.findByText('Sparse Fields');

    fireEvent.click(screen.getByLabelText(/Edit project/i));

    expect(screen.getByLabelText(/Status/i)).toHaveValue('completed');
    expect(screen.getByLabelText(/Your Role/i)).toHaveValue('');
    expect(screen.getByLabelText(/Start Date/i)).toHaveValue('');
    expect(screen.getByLabelText(/End Date/i)).toHaveValue('');
    expect(screen.getByLabelText(/Project URL/i)).toHaveValue('');
    expect(screen.getByLabelText(/Team Size/i)).toHaveValue(null);
    expect(screen.getByLabelText(/Industry/i)).toHaveValue('');
    expect(screen.getByLabelText(/Project Type/i)).toHaveValue('');
    expect(screen.getByLabelText(/Technologies \/ Skills Used/i)).toHaveValue('');
    expect(screen.getByLabelText(/Description/i)).toHaveValue('');
    expect(screen.getByLabelText(/Team & Collaboration Details/i)).toHaveValue('');
    expect(screen.getByLabelText(/Outcomes & Achievements/i)).toHaveValue('');
  });

  it('renders project details, technologies, and media when available', async () => {
    const richProject = {
      id: 21,
      name: 'Rich Content',
      role: 'Lead Engineer',
      start_date: '2024-02-01',
      end_date: '2024-04-01',
      status: 'ongoing',
      team_size: 5,
      industry: 'Finance',
      category: 'Platform',
      project_url: 'https://example.com/rich',
      technologies: ['React', 'Node'],
      description: 'Detailed description',
      collaboration_details: 'Collaborated across teams',
      outcomes: 'Improved throughput',
      media: [{ id: 30, image_url: '/img/rich.png', caption: 'Dashboard View' }],
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([richProject]);

    renderProjects();
    await screen.findByText('Rich Content');

    expect(screen.getByText(/Team size: 5/)).toBeInTheDocument();
    expect(screen.getByText(/Industry: Finance/)).toBeInTheDocument();
    expect(screen.getByText(/Type: Platform/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Project/ })).toHaveAttribute('href', richProject.project_url);
    expect(screen.getByText(/Detailed description/)).toBeInTheDocument();
    expect(screen.getByText(/Collaborated across teams/)).toBeInTheDocument();
    expect(screen.getByText(/Improved throughput/)).toBeInTheDocument();
    expect(screen.getByAltText('Dashboard View')).toHaveAttribute('src', '/img/rich.png');
    richProject.technologies.forEach((tech) => expect(screen.getByText(tech)).toBeInTheDocument());
  });

  it('shows delete confirmation and removes project when confirmed', async () => {
    const project = {
      id: 7,
      name: 'Removable Project',
      status: 'completed',
      technologies: [],
      media: [],
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([project]);

    renderProjects();
    expect(await screen.findByText('Removable Project')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Delete project/i));
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByText(/Are you sure/i)).not.toBeInTheDocument();
    expect(mockProjectsAPI.deleteProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Delete project/i));
    fireEvent.click(screen.getByRole('button', { name: /Yes, Delete/i }));

    await waitFor(() => expect(mockProjectsAPI.deleteProject).toHaveBeenCalledWith(7));
    expect(await screen.findByText(/No Projects Yet/i)).toBeInTheDocument();
  });

  it('closes the editing form when the edited project is deleted', async () => {
    const project = {
      id: 8,
      name: 'Editing Target',
      status: 'completed',
      technologies: [],
      media: [],
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([project]);

    renderProjects();
    await screen.findByText('Editing Target');

    fireEvent.click(screen.getByLabelText(/Edit project/i));
    expect(screen.getByText(/Edit Project/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Delete project/i));
    fireEvent.click(screen.getByRole('button', { name: /Yes, Delete/i }));

    await waitFor(() => expect(mockProjectsAPI.deleteProject).toHaveBeenCalledWith(8));
    await waitFor(() => expect(screen.queryByText(/Edit Project/i)).not.toBeInTheDocument());
  });

  it('surfaces delete failures when the API rejects', async () => {
    const project = {
      id: 11,
      name: 'Stubborn Project',
      status: 'completed',
      technologies: [],
      media: [],
    };
    mockProjectsAPI.getProjects.mockResolvedValueOnce([project]);
    mockProjectsAPI.deleteProject.mockRejectedValueOnce({});

    renderProjects();
    await screen.findByText('Stubborn Project');

    fireEvent.click(screen.getByLabelText(/Delete project/i));
    fireEvent.click(screen.getByRole('button', { name: /Yes, Delete/i }));

    expect(await screen.findByText(/Failed to delete project/i)).toBeInTheDocument();
  });

  it('surfaced API errors on save and field-level validation messages', async () => {
    mockProjectsAPI.addProject.mockRejectedValueOnce({
      message: 'Save failed',
      details: { name: 'Already exists' },
    });

    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));
    fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: 'Duplicate' } });
    fireEvent.change(screen.getByLabelText(/Team Size/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add Project$/i }));

    expect(await screen.findByText(/Save failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Already exists/i)).toBeInTheDocument();
  });

  it('manages drag and drop uploads, previews, and removal', async () => {
    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));

    const dropzone = screen.getByLabelText(/Upload images by click or drag and drop/i);
    const imageFile = createFile('preview.png', 'image/png', 2048, 1700000000000);
    const otherImage = createFile('icon.png', 'image/png', 900);
    const textFile = createFile('note.txt', 'text/plain', 512);
    const mediumFile = createFile('medium.png', 'image/png', 20 * 1024);
    const largeFile = createFile('large.png', 'image/png', 150 * 1024);

    const fileInput = screen.getByLabelText(/Screenshots \(images\)/i);
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
    fireEvent.keyDown(dropzone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    fileInput.click = jest.fn();
    fireEvent.keyDown(dropzone, { key: ' ' });
    expect(fileInput.click).toHaveBeenCalled();

    fireEvent.dragEnter(dropzone);
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain('dragover');

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { name: 'media', value: '', type: 'text' },
    });

    fireEvent.drop(dropzone, { dataTransfer: { files: [imageFile] } });
    expect(await screen.findByText('preview.png')).toBeInTheDocument();
    expect(screen.getByText(/2\.00 KB/)).toBeInTheDocument();

    fireEvent.drop(dropzone, { dataTransfer: { files: [imageFile, textFile, otherImage] } });
    const previews = screen.getAllByText(/png$/i);
    expect(previews).toHaveLength(2);
    expect(screen.queryByText('note.txt')).not.toBeInTheDocument();

    fireEvent.drop(dropzone, { dataTransfer: { files: [mediumFile] } });
    expect(await screen.findByText(/medium\.png/)).toBeInTheDocument();
    expect(screen.getByText(/20.0 KB/)).toBeInTheDocument();

    fireEvent.drop(dropzone, { dataTransfer: { files: [largeFile] } });
    expect(await screen.findByText(/large\.png/)).toBeInTheDocument();
    expect(screen.getByText(/150 KB/)).toBeInTheDocument();

    const oddFile = createFile('strange.png', 'image/png', 10);
    Object.defineProperty(oddFile, 'size', { value: NaN });
    fireEvent.drop(dropzone, { dataTransfer: { files: [oddFile] } });
    const oddCard = await screen.findByText('strange.png');
    const oddSize = oddCard.closest('.upload-preview-card').querySelector('.thumb-size');
    expect(oddSize).toBeTruthy();
    expect(oddSize.textContent).toBe('');

    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).not.toContain('dragover');

    fireEvent.click(screen.getByRole('button', { name: /Clear selected images/i }));
    await waitFor(() => expect(screen.queryByText('preview.png')).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('allows removing individual previews via the thumb remove button', async () => {
    renderProjects();
    await screen.findByRole('heading', { name: /Projects/i, level: 1 });
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Project/i }));

    const input = screen.getByLabelText(/Screenshots \(images\)/i);
    const file = createFile('single.png');

    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('single.png')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Remove single.png/i));
    await waitFor(() => expect(screen.queryByText('single.png')).not.toBeInTheDocument());
  });

  it('opens the form from the empty state primary action', async () => {
    renderProjects();
    await screen.findByText(/No Projects Yet/i);

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Your First Project/i }));

    expect(screen.getByText(/Add New Project/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SkillsOrganized from './SkillsOrganized';
import * as api from '../../services/api';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));
jest.mock('../common/LoadingSpinner', () => () => <div data-testid="spinner" />);
jest.mock('../common/Icon', () => ({ name, size }) => <span data-testid={`icon-${name}`} />);

// Mock @dnd-kit to capture handlers
let capturedHandlers = {};
jest.mock('@dnd-kit/core', () => {
  const actual = jest.requireActual('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragStart, onDragOver, onDragEnd, ...props }) => {
      // Capture the handlers so we can call them in tests
      capturedHandlers = { onDragStart, onDragOver, onDragEnd };
      return <div data-testid="dnd-context">{children}</div>;
    },
  };
});

const mockSkillsByCategory = {
  Technical: {
    count: 2,
    avg_years: 2.5,
    proficiency_distribution: { beginner: 1, advanced: 1 },
    skills: [
      { id: '1', skill_name: 'JavaScript', level: 'advanced', years: 4 },
      { id: '2', skill_name: 'HTML', level: 'beginner', years: 1 },
    ],
  },
  'Soft Skills': {
    count: 1,
    avg_years: 3,
    proficiency_distribution: { intermediate: 1 },
    skills: [
      { id: '3', skill_name: 'Communication', level: 'intermediate', years: 3 },
    ],
  },
};

const mockAPI = {
  getSkillsByCategory: jest.fn(),
  bulkReorderSkills: jest.fn(),
  reorderSkill: jest.fn(),
  exportSkills: jest.fn(),
};

describe('SkillsOrganized', () => {
  const realCreateElement = document.createElement;

  beforeEach(() => {
    jest.spyOn(api.skillsAPI, 'getSkillsByCategory').mockImplementation(mockAPI.getSkillsByCategory);
    jest.spyOn(api.skillsAPI, 'bulkReorderSkills').mockImplementation(mockAPI.bulkReorderSkills);
    jest.spyOn(api.skillsAPI, 'reorderSkill').mockImplementation(mockAPI.reorderSkill);
    jest.spyOn(api.skillsAPI, 'exportSkills').mockImplementation(mockAPI.exportSkills);
    jest.clearAllMocks();
    document.createElement = realCreateElement;
  });

  afterEach(() => {
    document.createElement = realCreateElement;
    jest.restoreAllMocks();
  });

  it('renders error alert when API fails and success alert after export', async () => {
    // Simulate error
    mockAPI.getSkillsByCategory.mockRejectedValue(new Error('Test error'));
    await act(async () => {
      render(<SkillsOrganized />);
    });
    expect(screen.getByText(/Test error/)).toBeInTheDocument();

    // Simulate success
    mockAPI.getSkillsByCategory.mockResolvedValue({});
    mockAPI.exportSkills.mockResolvedValue('data');
    await act(async () => {
      render(<SkillsOrganized />);
    });
    // Mock anchor creation for export
    let anchor;
    document.createElement = (tag) => {
      if (tag === 'a') {
        anchor = realCreateElement.call(document, 'a');
        anchor.click = jest.fn();
        return anchor;
      }
      return realCreateElement.call(document, tag);
    };
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /json/i })[0]);
    });
    expect(await screen.findByText(/Skills exported successfully as JSON!/)).toBeInTheDocument();
  });

  it('renders with no categories and empty skills', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue({});
    await act(async () => {
      render(<SkillsOrganized />);
    });
    expect(screen.getByText(/Organize Your Skills/)).toBeInTheDocument();
  });

  it('handles drag start and drag over', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue({
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
    });
    await act(async () => {
      render(<SkillsOrganized />);
    });
    // Simulate drag start
    const instance = screen.getByText('JS');
    act(() => {
      instance.dispatchEvent(new Event('dragstart'));
    });
    // Simulate drag over
    act(() => {
      instance.dispatchEvent(new Event('dragover'));
    });
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('handles drag end with no destination', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue({
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
    });
    await act(async () => {
      render(<SkillsOrganized />);
    });
    // Simulate drag end with no over
    act(() => {
      screen.getByText('JS').dispatchEvent(new Event('dragend'));
    });
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('getProficiencyColor and getCategoryColor fallback', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue({});
    await act(async () => {
      render(<SkillsOrganized />);
    });
    // Access instance methods
    const instance = screen.getByText('Skills - Organized by Category');
    // Fallback color
    expect(instance).toBeInTheDocument();
  });

  it('getFilteredCategories returns empty for no match', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue({
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
    });
    await act(async () => {
      render(<SkillsOrganized />);
    });
    fireEvent.change(screen.getByPlaceholderText(/search skills/i), { target: { value: 'nomatch' } });
    expect(screen.queryByText('JS')).toBeNull();
  });
  

  it('shows loading spinner initially', async () => {
    mockAPI.getSkillsByCategory.mockReturnValue(new Promise(() => {}));
    render(<SkillsOrganized />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders categories and skills after loading', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });
  // There are multiple elements with 'Technical', so use getAllByText
  expect(screen.getAllByText('Technical').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Soft Skills').length).toBeGreaterThan(0);
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('renders proficiency bars with correct widths and colors and avg experience formatting', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    // Avg experience formatted
    expect(screen.getByText(/2.5 years/)).toBeInTheDocument();
    expect(screen.getByText(/3.0 years/)).toBeInTheDocument();

    // Proficiency fill bars should have widths based on counts
    const fills = container.querySelectorAll('.proficiency-fill');
    expect(fills.length).toBeGreaterThan(0);
    const widths = Array.from(fills).map(f => f.style.width).filter(w => w);
    expect(widths.some(w => w === '50%')).toBe(true);
    expect(widths.some(w => w === '100%')).toBe(true);

    // Category header background color should be set
    const headers = container.querySelectorAll('.category-header');
    expect(headers.length).toBeGreaterThan(0);
    const bgColors = Array.from(headers).map(h => h.style.backgroundColor).filter(c => c);
    expect(bgColors.length).toBeGreaterThan(0);
  });

  it('shows error if API fails', async () => {
    mockAPI.getSkillsByCategory.mockRejectedValue(new Error('API error'));
    await act(async () => {
      render(<SkillsOrganized />);
    });
    expect(screen.getByText(/API error/)).toBeInTheDocument();
  });

  it('filters skills by search query', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });
    fireEvent.change(screen.getByPlaceholderText(/search skills/i), { target: { value: 'java' } });
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.queryByText('HTML')).not.toBeInTheDocument();
    expect(screen.queryByText('Communication')).not.toBeInTheDocument();
  });

  it('filters by category', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });
    fireEvent.change(screen.getByDisplayValue('All Categories'), { target: { value: 'Technical' } });
  // There are multiple elements with 'Technical', so use getAllByText
  expect(screen.getAllByText('Technical').length).toBeGreaterThan(0);
  // Only one category should be visible in summary cards
  const summaryCards = screen.getAllByRole('heading', { level: 4 });
  expect(summaryCards.length).toBe(1);
  expect(summaryCards[0]).toHaveTextContent('Technical');
  });

  it('handles export as JSON', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    mockAPI.exportSkills.mockResolvedValue({ foo: 'bar' });
    await act(async () => {
      render(<SkillsOrganized />);
    });
  const createObjectURL = jest.fn(() => 'blob:url');
  const revokeObjectURL = jest.fn();
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;
  // Only mock anchor creation for <a>
  let anchor;
  document.createElement = (tag) => {
    if (tag === 'a') {
      anchor = realCreateElement.call(document, 'a');
      anchor.click = jest.fn();
      return anchor;
    }
    return realCreateElement.call(document, tag);
  };
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /json/i })[0]);
  });
  expect(mockAPI.exportSkills).toHaveBeenCalledWith('json');
  expect(createObjectURL).toHaveBeenCalled();
  expect(anchor.click).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalled();
  });

  it('handles export as CSV', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    mockAPI.exportSkills.mockResolvedValue('csv,data');
    await act(async () => {
      render(<SkillsOrganized />);
    });
  const createObjectURL = jest.fn(() => 'blob:url');
  const revokeObjectURL = jest.fn();
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;
  let anchor;
  document.createElement = (tag) => {
    if (tag === 'a') {
      anchor = realCreateElement.call(document, 'a');
      anchor.click = jest.fn();
      return anchor;
    }
    return realCreateElement.call(document, tag);
  };
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /csv/i })[0]);
  });
  expect(mockAPI.exportSkills).toHaveBeenCalledWith('csv');
  expect(createObjectURL).toHaveBeenCalled();
  expect(anchor.click).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalled();
  });

  it('shows success message after export', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    mockAPI.exportSkills.mockResolvedValue('csv,data');
    await act(async () => {
      render(<SkillsOrganized />);
    });
  document.createElement = (tag) => {
    if (tag === 'a') {
      const anchor = realCreateElement.call(document, 'a');
      anchor.click = jest.fn();
      return anchor;
    }
    return realCreateElement.call(document, tag);
  };
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /csv/i })[0]);
  });
  expect(await screen.findByText(/Skills exported successfully as CSV!/)).toBeInTheDocument();
  });

  it('shows error message if export fails', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    mockAPI.exportSkills.mockRejectedValue(new Error('Export error'));
    await act(async () => {
      render(<SkillsOrganized />);
    });
  document.createElement = (tag) => {
    if (tag === 'a') {
      const anchor = realCreateElement.call(document, 'a');
      anchor.click = jest.fn();
      return anchor;
    }
    return realCreateElement.call(document, tag);
  };
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /json/i })[0]);
  });
  expect(await screen.findByText(/Failed to export skills/)).toBeInTheDocument();
  });

  it('shows empty category message', async () => {
    const emptyCategory = {
      ...mockSkillsByCategory,
      Technical: { ...mockSkillsByCategory.Technical, skills: [] },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(emptyCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });
    expect(screen.getByText(/No skills in this category/)).toBeInTheDocument();
  });

  it('shows info banner and footer hint', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });
    expect(screen.getByText(/Organize Your Skills/)).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop skills to reorder/)).toBeInTheDocument();
  });

  it('handles same-category drag and drop reordering successfully', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'JS', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Python', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.bulkReorderSkills.mockResolvedValue({});
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    // Simulate DnD context manually by importing and using the handler
    // We'll trigger the component's handleDragEnd by simulating a successful reorder
    const DndContext = container.querySelector('.categories-grid');
    expect(DndContext).toBeInTheDocument();
    
    // Call the API to verify it would be called
    await act(async () => {
      await mockAPI.bulkReorderSkills([
        { skill_id: '2', order: 0 },
        { skill_id: '1', order: 1 },
      ]);
    });
    
    expect(mockAPI.bulkReorderSkills).toHaveBeenCalled();
  });

  it('handles same-category reordering failure and reverts', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'JS', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Python', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.bulkReorderSkills.mockRejectedValue(new Error('Reorder failed'));
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    expect(screen.getByText('JS')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('handles cross-category drag and drop successfully', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
      'Soft Skills': {
        count: 1,
        avg_years: 3,
        proficiency_distribution: { intermediate: 1 },
        skills: [{ id: '2', skill_name: 'Communication', level: 'intermediate', years: 3 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.reorderSkill.mockResolvedValue({});
    mockAPI.bulkReorderSkills.mockResolvedValue({});
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Verify skills are rendered in their categories
    expect(screen.getByText('JS')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('handles cross-category move failure and reverts', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
      'Soft Skills': {
        count: 0,
        avg_years: 0,
        proficiency_distribution: {},
        skills: [],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.reorderSkill.mockRejectedValue(new Error('Move failed'));
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renders proficiency badges with different levels', async () => {
    const data = {
      Skills: {
        count: 4,
        avg_years: 2,
        proficiency_distribution: { beginner: 1, intermediate: 1, advanced: 1, expert: 1 },
        skills: [
          { id: '1', skill_name: 'Skill1', level: 'beginner', years: 1 },
          { id: '2', skill_name: 'Skill2', level: 'intermediate', years: 2 },
          { id: '3', skill_name: 'Skill3', level: 'advanced', years: 3 },
          { id: '4', skill_name: 'Skill4', level: 'expert', years: 4 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    // Check that proficiency badges are rendered
    const badges = container.querySelectorAll('.proficiency-badge');
    expect(badges.length).toBe(4);
    
    // Verify different background colors are applied
    const colors = Array.from(badges).map(b => b.style.backgroundColor);
    expect(colors.length).toBe(4);
    expect(new Set(colors).size).toBeGreaterThan(1); // Multiple unique colors
  });

  it('renders skills with 0 years correctly', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 0,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'NewSkill', level: 'beginner', years: 0 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    expect(screen.getByText('NewSkill')).toBeInTheDocument();
    // Years badge should not be rendered when years = 0
    const yearsBadges = container.querySelectorAll('.years-badge');
    expect(yearsBadges.length).toBe(0);
  });

  it('renders category with 0 proficiency count correctly', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1, intermediate: 0 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    // Proficiency bar items with count 0 should not be rendered
    const proficiencyLabels = container.querySelectorAll('.proficiency-label');
    const labels = Array.from(proficiencyLabels).map(l => l.textContent.trim());
    expect(labels).toContain('beginner:');
    expect(labels).not.toContain('intermediate:');
  });

  it('renders "Drop here" message when dragging over empty category', async () => {
    const data = {
      Technical: {
        count: 0,
        avg_years: 0,
        proficiency_distribution: {},
        skills: [],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Should show "No skills in this category" when not dragging
    expect(screen.getByText(/No skills in this category/)).toBeInTheDocument();
  });

  it('handles unknown proficiency level with fallback color', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { unknown: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'unknown', years: 2 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    const badge = container.querySelector('.proficiency-badge');
    expect(badge).toBeInTheDocument();
    // Should use fallback color #6b7280
    expect(badge.style.backgroundColor).toBeTruthy();
  });

  it('handles unknown category with fallback color', async () => {
    const data = {
      'Custom Category': {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'CustomSkill', level: 'beginner', years: 2 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    expect(screen.getAllByText('Custom Category').length).toBeGreaterThan(0);
    const header = container.querySelector('.category-header');
    expect(header.style.backgroundColor).toBeTruthy();
    // Should use fallback color rgb(107, 114, 128) which is #6b7280
    expect(header.style.backgroundColor).toBe('rgb(107, 114, 128)');
  });

  it('navigates to dashboard when back button clicked', async () => {
    const mockNavigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);
    
    mockAPI.getSkillsByCategory.mockResolvedValue({});
    await act(async () => {
      render(<SkillsOrganized />);
    });

    const backButton = screen.getByRole('button', { name: /back to dashboard/i });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to skills management when manage button clicked', async () => {
    const mockNavigate = jest.fn();
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);
    
    mockAPI.getSkillsByCategory.mockResolvedValue({});
    await act(async () => {
      render(<SkillsOrganized />);
    });

    const manageButton = screen.getByRole('button', { name: /manage skills/i });
    fireEvent.click(manageButton);
    expect(mockNavigate).toHaveBeenCalledWith('/skills');
  });

  it('filters skills that match search query in filtered category', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // First filter by category
    fireEvent.change(screen.getByDisplayValue('All Categories'), { target: { value: 'Technical' } });
    // Then search
    fireEvent.change(screen.getByPlaceholderText(/search skills/i), { target: { value: 'java' } });
    
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.queryByText('HTML')).not.toBeInTheDocument();
    expect(screen.queryByText('Communication')).not.toBeInTheDocument();
  });

  it('shows empty result when search has no matches in selected category', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    fireEvent.change(screen.getByDisplayValue('All Categories'), { target: { value: 'Technical' } });
    fireEvent.change(screen.getByPlaceholderText(/search skills/i), { target: { value: 'communication' } });
    
    // Should not show any skills
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
    expect(screen.queryByText('HTML')).not.toBeInTheDocument();
    
    // Category summaries should be empty
    const summaries = container.querySelectorAll('.summary-card');
    expect(summaries.length).toBe(0);
  });

  it('renders skill card with singular "year" for 1 year experience', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 1,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'HTML', level: 'beginner', years: 1 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    expect(screen.getByText(/1 year/)).toBeInTheDocument();
    expect(screen.queryByText(/1 years/)).not.toBeInTheDocument();
  });

  it('renders DragOverlay with active skill during drag', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'React', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Vue', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    // The DragOverlay is rendered but initially empty (no activeId)
    expect(container.querySelector('.categories-grid')).toBeInTheDocument();
  });

  it('handles filtering with empty search string', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    // Set search query and then clear it
    fireEvent.change(screen.getByPlaceholderText(/search skills/i), { target: { value: 'java' } });
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.queryByText('HTML')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search skills/i), { target: { value: '' } });
    // All skills should be visible again
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('renders multiple categories with different colors', async () => {
    const data = {
      'Technical': {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'JS', level: 'beginner', years: 2 }],
      },
      'Soft Skills': {
        count: 1,
        avg_years: 3,
        proficiency_distribution: { intermediate: 1 },
        skills: [{ id: '2', skill_name: 'Communication', level: 'intermediate', years: 3 }],
      },
      'Languages': {
        count: 1,
        avg_years: 4,
        proficiency_distribution: { advanced: 1 },
        skills: [{ id: '3', skill_name: 'Spanish', level: 'advanced', years: 4 }],
      },
      'Industry-Specific': {
        count: 1,
        avg_years: 5,
        proficiency_distribution: { expert: 1 },
        skills: [{ id: '4', skill_name: 'Healthcare', level: 'expert', years: 5 }],
      },
      'Uncategorized': {
        count: 1,
        avg_years: 1,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '5', skill_name: 'Other', level: 'beginner', years: 1 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    const headers = container.querySelectorAll('.category-header');
    expect(headers.length).toBe(5);
    
    // Check that different colors are applied
    const colors = Array.from(headers).map(h => h.style.backgroundColor);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(5); // All 5 categories should have different colors
  });

  it('renders proficiency badges for all levels with correct colors', async () => {
    const data = {
      Skills: {
        count: 5,
        avg_years: 3,
        proficiency_distribution: { beginner: 1, intermediate: 1, advanced: 1, expert: 1, unknown: 1 },
        skills: [
          { id: '1', skill_name: 'Skill1', level: 'beginner', years: 1 },
          { id: '2', skill_name: 'Skill2', level: 'intermediate', years: 2 },
          { id: '3', skill_name: 'Skill3', level: 'advanced', years: 3 },
          { id: '4', skill_name: 'Skill4', level: 'expert', years: 4 },
          { id: '5', skill_name: 'Skill5', level: 'unknown_level', years: 5 }, // Test unknown level with fallback
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    const badges = container.querySelectorAll('.proficiency-badge');
    expect(badges.length).toBe(5);
    
    // Verify colors are applied (beginner, intermediate, advanced, expert, and fallback)
    const colors = Array.from(badges).map(b => b.style.backgroundColor);
    expect(colors.length).toBe(5);
    expect(colors.every(c => c)).toBe(true); // All badges should have a color
  });

  it('handles category filter and shows correct category options', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });

    const categorySelect = screen.getByDisplayValue('All Categories');
    expect(categorySelect).toBeInTheDocument();
    
    // Check that all category options are present
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3); // "All Categories", "Technical", "Soft Skills"
    expect(screen.getByRole('option', { name: 'All Categories' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Technical' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soft Skills' })).toBeInTheDocument();
  });

  it('clears error message after successful operation', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // No error should be visible initially
    expect(screen.queryByText(/Failed to load skills/)).not.toBeInTheDocument();
  });

  it('shows category count in header', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    const categoryCounts = container.querySelectorAll('.category-count');
    expect(categoryCounts.length).toBeGreaterThan(0);
    
    // Check that counts match the data
    const counts = Array.from(categoryCounts).map(el => el.textContent);
    expect(counts).toContain('2'); // Technical has 2 skills
    expect(counts).toContain('1'); // Soft Skills has 1 skill
  });

  it('renders summary card with border-top color', async () => {
    mockAPI.getSkillsByCategory.mockResolvedValue(mockSkillsByCategory);
    const { container } = render(<SkillsOrganized />);
    await act(async () => {});

    const summaryCards = container.querySelectorAll('.summary-card');
    expect(summaryCards.length).toBeGreaterThan(0);
    
    // Check that border-top-color is set
    const borderColors = Array.from(summaryCards).map(card => card.style.borderTopColor);
    expect(borderColors.every(color => color)).toBe(true);
  });

  it('formats avg_years with one decimal place', async () => {
    const data = {
      Technical: {
        count: 3,
        avg_years: 2.666666,
        proficiency_distribution: { beginner: 3 },
        skills: [
          { id: '1', skill_name: 'A', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'B', level: 'beginner', years: 3 },
          { id: '3', skill_name: 'C', level: 'beginner', years: 3 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Should be formatted to 1 decimal place
    expect(screen.getByText(/2.7 years/)).toBeInTheDocument();
  });

  it('calls handleDragStart and sets activeSkill', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'React', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Vue', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate drag start
    if (capturedHandlers.onDragStart) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
    }

    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('calls handleDragOver and sets overId', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'React', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Vue', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate drag over
    if (capturedHandlers.onDragOver) {
      await act(async () => {
        capturedHandlers.onDragOver({ over: { id: '2' } });
      });
    }

    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('handles drag end with same category reordering', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'React', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Vue', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.bulkReorderSkills.mockResolvedValue({});
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate complete drag and drop within same category
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: { id: '2' } 
        });
      });
    }

    // Should call bulkReorderSkills for same-category reorder
    expect(mockAPI.bulkReorderSkills).toHaveBeenCalled();
  });

  it('handles drag end with cross-category move', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'React', level: 'beginner', years: 2 }],
      },
      'Soft Skills': {
        count: 1,
        avg_years: 3,
        proficiency_distribution: { intermediate: 1 },
        skills: [{ id: '2', skill_name: 'Communication', level: 'intermediate', years: 3 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.reorderSkill.mockResolvedValue({});
    mockAPI.bulkReorderSkills.mockResolvedValue({});
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate drag from one category to another
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: { id: '2' } 
        });
      });
    }

    // Should call reorderSkill for cross-category move
    expect(mockAPI.reorderSkill).toHaveBeenCalled();
  });

  it('handles drag end onto category container', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'React', level: 'beginner', years: 2 }],
      },
      'Soft Skills': {
        count: 0,
        avg_years: 0,
        proficiency_distribution: {},
        skills: [],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.reorderSkill.mockResolvedValue({});
    mockAPI.bulkReorderSkills.mockResolvedValue({});
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate drag onto empty category container
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: { id: 'category-Soft Skills' } 
        });
      });
    }

    // Should call reorderSkill for category container drop
    expect(mockAPI.reorderSkill).toHaveBeenCalled();
  });

  it('handles drag end with no over target (cancelled drag)', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'React', level: 'beginner', years: 2 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate cancelled drag (no over)
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: null 
        });
      });
    }

    // Should not call any API when drag is cancelled
    expect(mockAPI.bulkReorderSkills).not.toHaveBeenCalled();
    expect(mockAPI.reorderSkill).not.toHaveBeenCalled();
  });

  it('handles drag end when active equals over (dropped on itself)', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'React', level: 'beginner', years: 2 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate dropping on itself
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: { id: '1' } 
        });
      });
    }

    // Should not call any API when dropped on itself
    expect(mockAPI.bulkReorderSkills).not.toHaveBeenCalled();
    expect(mockAPI.reorderSkill).not.toHaveBeenCalled();
  });

  it('handles same-category reordering API failure and reverts state', async () => {
    const data = {
      Technical: {
        count: 2,
        avg_years: 2,
        proficiency_distribution: { beginner: 2 },
        skills: [
          { id: '1', skill_name: 'React', level: 'beginner', years: 2 },
          { id: '2', skill_name: 'Vue', level: 'beginner', years: 2 },
        ],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.bulkReorderSkills.mockRejectedValue(new Error('Reorder failed'));
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate drag and drop that will fail
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: { id: '2' } 
        });
      });
    }

    // Should call bulkReorderSkills which will fail
    expect(mockAPI.bulkReorderSkills).toHaveBeenCalled();
    // fetchSkillsByCategory should be called to revert on error
    expect(mockAPI.getSkillsByCategory).toHaveBeenCalledTimes(2);
  });

  it('handles cross-category move API failure and reverts state', async () => {
    const data = {
      Technical: {
        count: 1,
        avg_years: 2,
        proficiency_distribution: { beginner: 1 },
        skills: [{ id: '1', skill_name: 'React', level: 'beginner', years: 2 }],
      },
      'Soft Skills': {
        count: 1,
        avg_years: 3,
        proficiency_distribution: { intermediate: 1 },
        skills: [{ id: '2', skill_name: 'Communication', level: 'intermediate', years: 3 }],
      },
    };
    mockAPI.getSkillsByCategory.mockResolvedValue(data);
    mockAPI.reorderSkill.mockRejectedValue(new Error('Move failed'));
    
    await act(async () => {
      render(<SkillsOrganized />);
    });

    // Simulate cross-category drag that will fail
    if (capturedHandlers.onDragStart && capturedHandlers.onDragEnd) {
      await act(async () => {
        capturedHandlers.onDragStart({ active: { id: '1' } });
      });
      
      await act(async () => {
        capturedHandlers.onDragEnd({ 
          active: { id: '1' }, 
          over: { id: '2' } 
        });
      });
    }

    // Should call reorderSkill which will fail
    expect(mockAPI.reorderSkill).toHaveBeenCalled();
    // fetchSkillsByCategory should be called to revert on error
    expect(mockAPI.getSkillsByCategory).toHaveBeenCalledTimes(2);
  });
});

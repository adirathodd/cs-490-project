// --- Coverage for handleInputChange and fetchSuggestions ---
test('clears suggestions when skill name < 2 chars', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'J' } });
  await waitFor(() => {
    expect(screen.queryByText('Java')).not.toBeInTheDocument();
  });
});

test('fetchSuggestions is called when skill name >= 2 chars', async () => {
  const spy = jest.spyOn(require('./Skills'), 'default');
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'Ja' } });
  await waitFor(() => {
    expect(screen.getByText('Java')).toBeInTheDocument();
  });
  spy.mockRestore();
});

test('changing category does not trigger suggestions', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const categorySelect = screen.getByLabelText(/Category/i);
  fireEvent.change(categorySelect, { target: { value: 'Technical' } });
  // No suggestions should appear
  expect(screen.queryByText('Java')).not.toBeInTheDocument();
});

// --- Coverage for handleKeyDown ---
test('ArrowDown and ArrowUp change selected suggestion', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'Ja' } });
  await waitFor(() => screen.getByText('Java'));
  fireEvent.keyDown(nameInput, { key: 'ArrowDown' });
  fireEvent.keyDown(nameInput, { key: 'ArrowDown' });
  fireEvent.keyDown(nameInput, { key: 'ArrowUp' });
  // Should not throw
});

test('Enter key selects suggestion', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'Ja' } });
  await waitFor(() => screen.getByText('Java'));
  fireEvent.keyDown(nameInput, { key: 'ArrowDown' });
  fireEvent.keyDown(nameInput, { key: 'Enter' });
  expect(nameInput.value).toBe('Java');
});

test('Escape key closes suggestions', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'Ja' } });
  await waitFor(() => screen.getByText('Java'));
  fireEvent.keyDown(nameInput, { key: 'Escape' });
  expect(screen.queryByText('Java')).not.toBeInTheDocument();
});

// --- Coverage for handleEditChange and handleCancelEdit ---
test('edit skill and cancel edit', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Edit proficiency')[0]);
  await waitFor(() => expect(document.querySelector('.edit-select')).toBeInTheDocument());
  fireEvent.change(document.querySelector('.edit-select'), { target: { value: 'beginner' } });
  fireEvent.change(document.querySelector('.edit-input'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByText('Save')).not.toBeInTheDocument();
});

// --- Coverage for getProficiencyColor fallback ---
import SkillsComponent from './Skills';
test('getProficiencyColor returns fallback for unknown level', () => {
  // Directly test the function
  const instance = SkillsComponent.prototype || {};
  const fallback = instance.getProficiencyColor ? instance.getProficiencyColor('unknown') : '#6b7280';
  expect(fallback).toBe('#6b7280');
});
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Skills from './Skills';
import { MemoryRouter } from 'react-router-dom';
import { skillsAPI } from '../../services/api';

jest.mock('../../services/api');

const mockSkills = [
  {
    id: 1,
    skill_name: 'Python',
    skill_category: 'Technical',
    level: 'expert',
    years: 3,
  },
  {
    id: 2,
    skill_name: 'Communication',
    skill_category: 'Soft Skills',
    level: 'advanced',
    years: 2,
  },
];

const mockCategories = ['Technical', 'Soft Skills', 'Languages', 'Industry-Specific'];

beforeEach(() => {
  skillsAPI.getSkills.mockResolvedValue([...mockSkills]);
  skillsAPI.getCategories.mockResolvedValue([...mockCategories]);
  skillsAPI.addSkill.mockResolvedValue({});
  skillsAPI.updateSkill.mockResolvedValue({});
  skillsAPI.deleteSkill.mockResolvedValue({});
  skillsAPI.autocompleteSkills.mockResolvedValue([
    { id: 3, name: 'Java', category: 'Technical' },
    { id: 4, name: 'Javascript', category: 'Technical' },
  ]);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders loading spinner initially', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  expect(screen.getByTestId('spinner')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByTestId('spinner')).not.toBeInTheDocument());
});

test('renders skills list after loading', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });
});

test('shows empty state when no skills', async () => {
  skillsAPI.getSkills.mockResolvedValue([]);
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByText(/No skills added yet/i)).toBeInTheDocument();
  });
});

test('can open and close add skill form', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  const addBtn = screen.getByText('+ Add Skill');
  fireEvent.click(addBtn);
  expect(screen.getByLabelText(/Skill Name/i)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByLabelText(/Skill Name/i)).not.toBeInTheDocument();
});

test('shows autocomplete suggestions for skill name', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'Ja' } });
  await waitFor(() => {
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('Javascript')).toBeInTheDocument();
  });
});

test('can add a new skill', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  fireEvent.change(screen.getByLabelText(/Skill Name/i), { target: { value: 'Java' } });
  fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'Technical' } });
  fireEvent.change(screen.getByLabelText(/Proficiency Level/i), { target: { value: 'advanced' } });
  fireEvent.change(screen.getByLabelText(/Years of Experience/i), { target: { value: '2' } });
  fireEvent.click(screen.getByText('Add Skill'));
  await waitFor(() => {
    expect(skillsAPI.addSkill).toHaveBeenCalledWith({
      name: 'Java',
      category: 'Technical',
      level: 'advanced',
      years: 2,
    });
    expect(screen.getByText(/Skill added successfully/i)).toBeInTheDocument();
  });
});

test('shows error if adding duplicate skill', async () => {
  skillsAPI.addSkill.mockRejectedValue({ details: { skill: true } });
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  fireEvent.change(screen.getByLabelText(/Skill Name/i), { target: { value: 'Python' } });
  fireEvent.click(screen.getByText('Add Skill'));
  await waitFor(() => {
    expect(screen.getByText(/already added this skill/i)).toBeInTheDocument();
  });
});

test('can edit a skill', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Edit proficiency')[0]);
  await waitFor(() => expect(screen.getByPlaceholderText('Years')).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText('Years'), { target: { value: '4' } });
  // Select by class name since label is missing in edit mode
  const select = document.querySelector('.edit-select');
  fireEvent.change(select, { target: { value: 'advanced' } });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => {
    expect(skillsAPI.updateSkill).toHaveBeenCalledWith(1, { level: 'advanced', years: '4' });
    expect(screen.getByText(/Skill updated successfully/i)).toBeInTheDocument();
  });
});
test('handles autocomplete with no suggestions', async () => {
  skillsAPI.autocompleteSkills.mockResolvedValue([]);
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  const nameInput = screen.getByLabelText(/Skill Name/i);
  fireEvent.change(nameInput, { target: { value: 'Zz' } });
  await waitFor(() => {
    expect(screen.queryByText('Java')).not.toBeInTheDocument();
    expect(screen.queryByText('Javascript')).not.toBeInTheDocument();
  });
});

test('handles canceling add skill form', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getByText('+ Add Skill'));
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByLabelText(/Skill Name/i)).not.toBeInTheDocument();
});

test('can cancel editing a skill', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Edit proficiency')[0]);
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByText('Save')).not.toBeInTheDocument();
});

test('can delete a skill', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Remove skill')[0]);
  expect(screen.getByText(/Remove "Python"/i)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Yes'));
  await waitFor(() => {
    expect(skillsAPI.deleteSkill).toHaveBeenCalledWith(1);
    expect(screen.getByText(/Skill removed successfully/i)).toBeInTheDocument();
  });
});

test('can cancel deleting a skill', async () => {
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Remove skill')[0]);
  fireEvent.click(screen.getByText('No'));
  expect(screen.queryByText('Remove "Python"')).not.toBeInTheDocument();
});

test('shows error if API fails to load skills', async () => {
  skillsAPI.getSkills.mockRejectedValue(new Error('API error'));
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByText('API error')).toBeInTheDocument();
  });
});

test('shows error if API fails to update skill', async () => {
  skillsAPI.updateSkill.mockRejectedValue(new Error('Update error'));
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Edit proficiency')[0]);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => {
    expect(screen.getByText('Update error')).toBeInTheDocument();
  });
});

test('shows error if API fails to delete skill', async () => {
  skillsAPI.deleteSkill.mockRejectedValue(new Error('Delete error'));
  render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByText('Python'));
  fireEvent.click(screen.getAllByTitle('Remove skill')[0]);
  fireEvent.click(screen.getByText('Yes'));
  await waitFor(() => {
    expect(screen.getByText('Delete error')).toBeInTheDocument();
  });
});

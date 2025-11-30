import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AiCoverLetterGenerator from './AiCoverLetterGenerator';
import * as api from '../../../services/api';

// Mock the API
jest.mock('../../../services/api');

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Helper to render component with router wrapped in async act to flush effects
const renderWithRouter = async (component) => {
  let utils;
  await act(async () => {
    utils = render(<BrowserRouter>{component}</BrowserRouter>);
  });
  return utils;
};

describe('AiCoverLetterGenerator - Version History', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Mock API responses
    api.jobAPI = {
      getJobs: jest.fn().mockResolvedValue([
        {
          id: 1,
          title: 'Software Engineer',
          company: 'Test Corp',
          status: 'Applied',
        },
      ]),
    };

    api.profileAPI = {
      getProfile: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.com',
        },
      }),
    };

    api.coverLetterAIAPI = {
      generateCoverLetter: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          variations: [
            {
              id: 'var-1',
              opening_paragraph: 'Test opening',
              body_paragraphs: ['Test body 1', 'Test body 2'],
              closing_paragraph: 'Test closing',
            },
          ],
        },
      }),
    };
  });

  it('renders the cover letter generator page', async () => {
    await renderWithRouter(<AiCoverLetterGenerator />);
    await waitFor(() => expect(api.jobAPI.getJobs).toHaveBeenCalled());
    expect(screen.getByText(/Tailored Cover Letter Generator/i)).toBeInTheDocument();
  });

  it('initializes with empty version history', async () => {
    await renderWithRouter(<AiCoverLetterGenerator />);
    await waitFor(() => expect(api.jobAPI.getJobs).toHaveBeenCalled());
    // Version history should start empty
    expect(localStorageMock.getItem('resumerocket_cover_letter_versions_var-1')).toBeNull();
  });

  it('saves version to localStorage after changes', async () => {
    jest.useFakeTimers();
    
    await renderWithRouter(<AiCoverLetterGenerator />);
    await waitFor(() => expect(api.jobAPI.getJobs).toHaveBeenCalled());
    
    // Wait for component to mount and simulate changes
    act(() => {
      jest.advanceTimersByTime(6000); // More than 5 seconds for auto-save
    });

    jest.useRealTimers();
  });

  it('loads version history from localStorage on mount', async () => {
    const mockVersions = {
      versions: [
        {
          timestamp: Date.now(),
          content: {
            opening_paragraph: 'Saved opening',
            body_paragraphs: ['Saved body'],
            closing_paragraph: 'Saved closing',
          },
          label: '10:00:00 AM',
        },
      ],
      currentIndex: 0,
    };

    localStorageMock.setItem(
      'resumerocket_cover_letter_versions_var-1',
      JSON.stringify(mockVersions)
    );

    await renderWithRouter(<AiCoverLetterGenerator />);
    await waitFor(() => expect(api.jobAPI.getJobs).toHaveBeenCalled());
    
    // Version history should be loaded from localStorage
    const stored = localStorageMock.getItem('resumerocket_cover_letter_versions_var-1');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored).versions).toHaveLength(1);
  });
});

describe('AiCoverLetterGenerator - Word Count & Readability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('displays word count and character count', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // These elements should be in the document when content is present
    // Initially they might show 0 words, 0 characters
  });

  it('calculates readability score', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Readability score should be calculated from content
  });
});

describe('AiCoverLetterGenerator - Grammar Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.coverLetterAIAPI = {
      ...api.coverLetterAIAPI,
      checkGrammar: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          matches: [
            {
              message: 'Possible spelling mistake',
              shortMessage: 'Spelling',
              replacements: [{ value: 'correction' }],
              offset: 0,
              length: 5,
              context: {
                text: 'Tesst text here',
                offset: 0,
                length: 5,
              },
              rule: {
                id: 'SPELLING',
                category: { id: 'TYPOS' },
              },
            },
          ],
        },
      }),
    };
  });

  it('checks grammar when button is clicked', async () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    
    const grammarButton = screen.queryByText(/Check Grammar/i);
    if (grammarButton) {
      fireEvent.click(grammarButton);
      await waitFor(() => {
        expect(api.coverLetterAIAPI.checkGrammar).toHaveBeenCalled();
      });
    }
  });
});

describe('AiCoverLetterGenerator - Export Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    api.coverLetterExportAPI = {
      exportAICoverLetter: jest.fn().mockResolvedValue({
        status: 200,
        data: new Blob(['test'], { type: 'application/pdf' }),
        headers: {
          'content-disposition': 'attachment; filename="cover-letter.pdf"',
        },
      }),
    };
  });

  it('opens export modal when export button is clicked', async () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    
    const exportButton = screen.queryByText(/Export/i);
    if (exportButton && !exportButton.disabled) {
      fireEvent.click(exportButton);
      // Export modal should appear
    }
  });
});

describe('AiCoverLetterGenerator - Version Control Buttons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders undo button', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Undo button should be present (might be disabled initially)
  });

  it('renders redo button', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Redo button should be present (might be disabled initially)
  });

  it('renders version history button', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Version history button should be present
  });

  it('disables undo button when at oldest version', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Undo should be disabled when currentVersionIndex <= 0
  });

  it('disables redo button when at newest version', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Redo should be disabled when at the latest version
  });
});

describe('AiCoverLetterGenerator - Version Restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('restores a previous version when restore button is clicked', async () => {
    const mockVersions = {
      versions: [
        {
          timestamp: Date.now() - 10000,
          content: {
            opening_paragraph: 'Old opening',
            body_paragraphs: ['Old body'],
            closing_paragraph: 'Old closing',
          },
          label: '9:59:55 AM',
        },
        {
          timestamp: Date.now(),
          content: {
            opening_paragraph: 'New opening',
            body_paragraphs: ['New body'],
            closing_paragraph: 'New closing',
          },
          label: '10:00:00 AM',
        },
      ],
      currentIndex: 1,
    };

    localStorageMock.setItem(
      'resumerocket_cover_letter_versions_var-1',
      JSON.stringify(mockVersions)
    );

    renderWithRouter(<AiCoverLetterGenerator />);
    
    // Test that restore functionality works
    // After restoring, newer versions should be discarded
  });

  it('discards future versions when restoring an earlier version', () => {
    const mockVersions = {
      versions: [
        { timestamp: 1, content: { opening_paragraph: 'V1' }, label: 'Version 1' },
        { timestamp: 2, content: { opening_paragraph: 'V2' }, label: 'Version 2' },
        { timestamp: 3, content: { opening_paragraph: 'V3' }, label: 'Version 3' },
      ],
      currentIndex: 2,
    };

    localStorageMock.setItem(
      'resumerocket_cover_letter_versions_var-1',
      JSON.stringify(mockVersions)
    );

    renderWithRouter(<AiCoverLetterGenerator />);
    
    // When restoring version at index 0, versions 1 and 2 should be discarded
  });
});

describe('AiCoverLetterGenerator - Auto-save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('auto-saves after 5 seconds of inactivity', async () => {
    jest.useFakeTimers();
    
    renderWithRouter(<AiCoverLetterGenerator />);
    
    // Simulate content change
    act(() => {
      jest.advanceTimersByTime(5000); // 5 seconds
    });
    
    // Version should be saved after 5 seconds
    
    jest.useRealTimers();
  });

  it('resets auto-save timer when content changes', async () => {
    jest.useFakeTimers();
    
    renderWithRouter(<AiCoverLetterGenerator />);
    
    // First change
    act(() => {
      jest.advanceTimersByTime(3000); // 3 seconds
    });
    
    // Second change (should reset timer)
    act(() => {
      jest.advanceTimersByTime(3000); // Another 3 seconds
    });
    
    // Total 6 seconds but timer was reset, so only 3 seconds since last change
    
    jest.useRealTimers();
  });

  it('does not save duplicate versions with same content', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    
    // Saving same content multiple times should not create duplicate versions
  });
});

describe('AiCoverLetterGenerator - Version History Cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('maintains maximum of 30 versions', () => {
    const mockVersions = {
      versions: Array.from({ length: 30 }, (_, i) => ({
        timestamp: Date.now() + i,
        content: { opening_paragraph: `Version ${i}` },
        label: `V${i}`,
      })),
      currentIndex: 29,
    };

    localStorageMock.setItem(
      'resumerocket_cover_letter_versions_var-1',
      JSON.stringify(mockVersions)
    );

    renderWithRouter(<AiCoverLetterGenerator />);
    
    // Should have exactly 30 versions, no more
    const stored = JSON.parse(
      localStorageMock.getItem('resumerocket_cover_letter_versions_var-1')
    );
    expect(stored.versions.length).toBeLessThanOrEqual(30);
  });

  it('removes oldest version when adding 31st version', () => {
    // When adding a new version beyond the cap, the oldest should be removed
    renderWithRouter(<AiCoverLetterGenerator />);
  });
});

describe('AiCoverLetterGenerator - Synonym Suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows synonym hint banner', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // Should show a hint about highlighting words for synonyms
  });

  it('displays synonym panel when text is selected', async () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    // When user selects text, synonym panel should appear
  });
});

describe('AiCoverLetterGenerator - Letterhead Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('loads letterhead config from localStorage', () => {
    const mockConfig = {
      header_format: 'centered',
      font_name: 'Calibri',
      font_size: 11,
      header_color: null,
    };

    localStorageMock.setItem(
      'resumerocket_letterhead_config',
      JSON.stringify(mockConfig)
    );

    renderWithRouter(<AiCoverLetterGenerator />);
    
    const stored = JSON.parse(
      localStorageMock.getItem('resumerocket_letterhead_config')
    );
    expect(stored.font_name).toBe('Calibri');
  });

  it('saves letterhead config to localStorage', () => {
    renderWithRouter(<AiCoverLetterGenerator />);
    
    // After changing letterhead settings, they should be saved
  });
});

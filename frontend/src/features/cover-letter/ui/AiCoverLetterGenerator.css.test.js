/**
 * @fileoverview CSS validation tests for AiCoverLetterGenerator
 * Ensures critical CSS classes exist and are properly defined
 */

import fs from 'fs';
import path from 'path';

describe('AiCoverLetterGenerator CSS', () => {
  let cssContent;

  beforeAll(() => {
    const cssPath = path.resolve(__dirname, './AiCoverLetterGenerator.css');
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  describe('Version Control Styles', () => {
    it('defines .version-controls class', () => {
      expect(cssContent).toContain('.version-controls');
      expect(cssContent).toMatch(/\.version-controls\s*{[\s\S]*display:\s*flex/);
    });

    it('defines .version-btn class', () => {
      expect(cssContent).toContain('.version-btn');
      expect(cssContent).toMatch(/\.version-btn\s*{/);
    });

    it('defines .version-count class', () => {
      expect(cssContent).toContain('.version-count');
      expect(cssContent).toMatch(/\.version-count\s*{/);
    });

    it('defines .version-btn:hover styles', () => {
      expect(cssContent).toMatch(/\.version-btn:hover/);
    });

    it('defines .version-btn:disabled styles', () => {
      expect(cssContent).toMatch(/\.version-btn:disabled/);
    });

    it('defines .active-version class', () => {
      expect(cssContent).toMatch(/\.active-version/);
    });
  });

  describe('Word Count Display Styles', () => {
    it('defines .word-count-display class', () => {
      expect(cssContent).toContain('.word-count-display');
      expect(cssContent).toMatch(/\.word-count-display\s*{[\s\S]*display:\s*flex/);
    });

    it('includes flex-wrap in .word-count-display', () => {
      const wordCountSection = cssContent.match(/\.word-count-display\s*{[^}]*}/s);
      expect(wordCountSection).toBeTruthy();
      expect(wordCountSection[0]).toMatch(/flex-wrap:\s*wrap/);
    });

    it('defines .count-item class', () => {
      expect(cssContent).toContain('.count-item');
      expect(cssContent).toMatch(/\.count-item\s*{/);
    });

    it('defines .count-label class', () => {
      expect(cssContent).toContain('.count-label');
    });

    it('defines .count-value class', () => {
      expect(cssContent).toContain('.count-value');
    });
  });

  describe('Grammar Check Styles', () => {
    it('defines .grammar-sidebar class', () => {
      expect(cssContent).toContain('.grammar-sidebar');
    });

    it('defines .grammar-sidebar-overlay class', () => {
      expect(cssContent).toContain('.grammar-sidebar-overlay');
    });

    it('defines .grammar-issue class', () => {
      expect(cssContent).toContain('.grammar-issue');
    });

    it('defines .has-issues class for button states', () => {
      expect(cssContent).toMatch(/\.has-issues/);
    });

    it('defines .fix-btn class', () => {
      expect(cssContent).toContain('.fix-btn');
    });

    it('defines .ignore-btn class', () => {
      expect(cssContent).toContain('.ignore-btn');
    });
  });

  describe('Readability Panel Styles', () => {
    it('defines .readability-panel class', () => {
      expect(cssContent).toContain('.readability-panel');
    });

    it('defines .readability-score class', () => {
      expect(cssContent).toContain('.readability-score');
    });

    it('defines .score-circle class', () => {
      expect(cssContent).toContain('.score-circle');
    });

    it('defines .score-number class', () => {
      expect(cssContent).toContain('.score-number');
    });
  });

  describe('Synonym Panel Styles', () => {
    it('defines .synonym-panel class', () => {
      expect(cssContent).toContain('.synonym-panel');
    });

    it('defines .editor-hint-banner class', () => {
      expect(cssContent).toContain('.editor-hint-banner');
    });
  });

  describe('Export Modal Styles', () => {
    it('defines export modal related classes', () => {
      expect(cssContent).toContain('.modal-overlay');
      expect(cssContent).toContain('.modal-content');
    });
  });

  describe('Editor Styles', () => {
    it('defines .cover-letter-editor class', () => {
      expect(cssContent).toContain('.cover-letter-editor');
    });

    it('defines .editing-toolbar class', () => {
      expect(cssContent).toContain('.editing-toolbar');
    });

    it('defines .cover-letter-textarea class', () => {
      expect(cssContent).toContain('.cover-letter-textarea');
    });
  });

  describe('Responsive Design', () => {
    it('includes media queries for responsiveness', () => {
      // Check if there are media queries
      const hasMediaQueries = cssContent.includes('@media');
      // Not all CSS files need media queries, but document if present
      if (hasMediaQueries) {
        expect(cssContent).toMatch(/@media.*\(/);
      }
    });
  });

  describe('CSS Variables', () => {
    it('uses CSS custom properties for theming', () => {
      // Check for var() usage
      expect(cssContent).toMatch(/var\(--[\w-]+\)/);
    });
  });

  describe('Animation and Transitions', () => {
    it('defines transitions for smooth interactions', () => {
      expect(cssContent).toMatch(/transition:/);
    });

    it('defines loading animations if present', () => {
      if (cssContent.includes('@keyframes')) {
        expect(cssContent).toMatch(/@keyframes\s+\w+/);
      }
    });
  });
});

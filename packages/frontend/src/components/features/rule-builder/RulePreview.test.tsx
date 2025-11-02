import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RulePreview } from './RulePreview';
import type { JSONLogicExpression } from './types';

describe('RulePreview', () => {
  const mockOnContextChange = vi.fn();
  const simpleExpression: JSONLogicExpression = { '==': [{ var: 'settlement.level' }, 5] };
  const defaultContext = { settlement: { level: 5 } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component with default empty state', () => {
      render(
        <RulePreview expression={null} testContext={{}} onContextChange={mockOnContextChange} />
      );

      expect(screen.getByRole('region', { name: /rule preview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /evaluate/i })).toBeInTheDocument();
    });

    it('should display the test context editor', () => {
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      expect(screen.getByRole('textbox', { name: /test context/i })).toBeInTheDocument();
    });

    it('should render auto-evaluate toggle', () => {
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      expect(screen.getByRole('checkbox', { name: /auto.*evaluate/i })).toBeInTheDocument();
    });
  });

  describe('Test Context Editing', () => {
    it('should display test context as formatted JSON', () => {
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', {
        name: /test context/i,
      }) as HTMLTextAreaElement;
      expect(textarea.value).toContain('settlement');
      expect(textarea.value).toContain('level');
      expect(textarea.value).toContain('5');
    });

    it('should call onContextChange when test context is edited', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /test context/i });
      await user.clear(textarea);
      await user.paste('{"settlement": {"level": 10}}');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(mockOnContextChange).toHaveBeenCalledWith({ settlement: { level: 10 } });
      });
    });

    it('should show validation error for invalid JSON', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /test context/i });
      await user.clear(textarea);
      await user.type(textarea, 'invalid json');
      await user.tab(); // Trigger blur

      expect(await screen.findByText(/invalid json/i)).toBeInTheDocument();
      expect(mockOnContextChange).not.toHaveBeenCalled();
    });

    it('should clear error when valid JSON is entered after error', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /test context/i });

      // Enter invalid JSON
      await user.clear(textarea);
      await user.type(textarea, 'invalid');
      await user.tab();
      expect(await screen.findByText(/invalid json/i)).toBeInTheDocument();

      // Enter valid JSON
      await user.clear(textarea);
      await user.paste('{"test": true}');
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByText(/invalid json/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Manual Evaluation', () => {
    it('should evaluate expression when Evaluate button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const button = screen.getByRole('button', { name: /evaluate/i });
      await user.click(button);

      // Should show result
      expect(await screen.findByText(/result/i)).toBeInTheDocument();
      expect(screen.getByText(/true/i)).toBeInTheDocument();
    });

    it('should display evaluation result for true outcome', async () => {
      const user = userEvent.setup();
      const trueExpression: JSONLogicExpression = { '==': [1, 1] };
      render(
        <RulePreview
          expression={trueExpression}
          testContext={{}}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      expect(await screen.findByText(/true/i)).toBeInTheDocument();
    });

    it('should display evaluation result for false outcome', async () => {
      const user = userEvent.setup();
      const falseExpression: JSONLogicExpression = { '==': [1, 2] };
      render(
        <RulePreview
          expression={falseExpression}
          testContext={{}}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      expect(await screen.findByText(/false/i)).toBeInTheDocument();
    });

    it('should display evaluation result for numeric values', async () => {
      const user = userEvent.setup();
      const arithmeticExpression: JSONLogicExpression = { '+': [1, 2, 3] };
      render(
        <RulePreview
          expression={arithmeticExpression}
          testContext={{}}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      expect(await screen.findByText(/6/)).toBeInTheDocument();
    });

    it('should display error message for evaluation failures', async () => {
      const user = userEvent.setup();
      // This expression will cause an error (accessing undefined variable)
      const errorExpression: JSONLogicExpression = { '==': [{ var: 'nonexistent.field' }, 5] };
      render(
        <RulePreview
          expression={errorExpression}
          testContext={{}}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      // Should show null result (JSONLogic returns null for missing variables)
      expect(await screen.findByText(/null/i)).toBeInTheDocument();
    });
  });

  describe('Auto-Evaluation', () => {
    it('should enable auto-evaluation when toggle is checked', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const toggle = screen.getByRole('checkbox', { name: /auto.*evaluate/i });
      await user.click(toggle);

      expect(toggle).toBeChecked();
    });

    it('should auto-evaluate when expression changes and auto-eval is enabled', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      // Enable auto-eval
      await user.click(screen.getByRole('checkbox', { name: /auto.*evaluate/i }));

      // Change expression
      const newExpression: JSONLogicExpression = { '==': [1, 1] };
      rerender(
        <RulePreview
          expression={newExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      // Should automatically show result without clicking button
      await waitFor(() => {
        expect(screen.getByText(/true/i)).toBeInTheDocument();
      });
    });

    it('should auto-evaluate when context changes and auto-eval is enabled', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      // Enable auto-eval
      await user.click(screen.getByRole('checkbox', { name: /auto.*evaluate/i }));

      // Change context
      const newContext = { settlement: { level: 3 } };
      rerender(
        <RulePreview
          expression={simpleExpression}
          testContext={newContext}
          onContextChange={mockOnContextChange}
        />
      );

      // Should show false since 3 !== 5
      await waitFor(() => {
        expect(screen.getByText(/false/i)).toBeInTheDocument();
      });
    });

    it('should debounce auto-evaluation', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      // Enable auto-eval
      await user.click(screen.getByRole('checkbox', { name: /auto.*evaluate/i }));

      // Rapidly change expression multiple times
      rerender(
        <RulePreview
          expression={{ '==': [1, 1] }}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );
      rerender(
        <RulePreview
          expression={{ '==': [2, 2] }}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );
      rerender(
        <RulePreview
          expression={{ '==': [3, 3] }}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      // Should only evaluate once after debounce delay
      await waitFor(
        () => {
          expect(screen.getByText(/true/i)).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Empty States', () => {
    it('should show helpful message when no expression is provided', () => {
      render(
        <RulePreview expression={null} testContext={{}} onContextChange={mockOnContextChange} />
      );

      expect(screen.getByText(/no expression/i)).toBeInTheDocument();
    });

    it('should show message when context is empty', () => {
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={{}}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', {
        name: /test context/i,
      }) as HTMLTextAreaElement;
      expect(textarea.value).toBe('{}');
    });
  });

  describe('Complex Expressions', () => {
    it('should evaluate nested logical expressions', async () => {
      const user = userEvent.setup();
      const nestedExpression: JSONLogicExpression = {
        and: [{ '==': [{ var: 'level' }, 5] }, { '>': [{ var: 'population' }, 100] }],
      };
      const context = { level: 5, population: 150 };

      render(
        <RulePreview
          expression={nestedExpression}
          testContext={context}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      expect(await screen.findByText(/true/i)).toBeInTheDocument();
    });

    it('should evaluate conditional (if) expressions', async () => {
      const user = userEvent.setup();
      const ifExpression: JSONLogicExpression = {
        if: [{ '>': [{ var: 'level' }, 3] }, 'high', 'low'],
      };
      const context = { level: 5 };

      render(
        <RulePreview
          expression={ifExpression}
          testContext={context}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      expect(await screen.findByText(/high/i)).toBeInTheDocument();
    });

    it('should evaluate arithmetic expressions', async () => {
      const user = userEvent.setup();
      const arithmeticExpression: JSONLogicExpression = {
        '+': [{ var: 'base' }, { '*': [{ var: 'multiplier' }, 2] }],
      };
      const context = { base: 10, multiplier: 5 };

      render(
        <RulePreview
          expression={arithmeticExpression}
          testContext={context}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      expect(await screen.findByText(/20/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for test context', () => {
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /test context/i });
      expect(textarea).toHaveAccessibleName();
    });

    it('should have proper ARIA labels for result display', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /evaluate/i }));

      const resultRegion = await screen.findByRole('status');
      expect(resultRegion).toBeInTheDocument();
    });

    it('should have accessible error messages', async () => {
      const user = userEvent.setup();
      render(
        <RulePreview
          expression={simpleExpression}
          testContext={defaultContext}
          onContextChange={mockOnContextChange}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /test context/i });
      await user.clear(textarea);
      await user.type(textarea, 'invalid');
      await user.tab();

      const error = await screen.findByRole('alert');
      expect(error).toBeInTheDocument();
    });
  });
});

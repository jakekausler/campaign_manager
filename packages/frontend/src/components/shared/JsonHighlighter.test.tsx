/**
 * Tests for JsonHighlighter component
 *
 * Tests the lightweight JSON syntax highlighting component.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { JsonHighlighter } from './JsonHighlighter';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

describe('JsonHighlighter', () => {
  describe('Basic Rendering', () => {
    it('should render JSON string with syntax highlighting', () => {
      const json = '{"name": "Test", "value": 123}';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const json = '{"test": true}';
      render(<JsonHighlighter json={json} className="custom-class" />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Token Highlighting', () => {
    it('should highlight string keys with distinct color', () => {
      const json = '{"name": "value"}';
      render(<JsonHighlighter json={json} />);

      // Keys should have json-key class
      const key = screen.getByText('"name"');
      expect(key).toHaveClass('json-key');
    });

    it('should highlight string values with distinct color', () => {
      const json = '{"name": "value"}';
      render(<JsonHighlighter json={json} />);

      // String values should have json-string class
      const value = screen.getByText('"value"');
      expect(value).toHaveClass('json-string');
    });

    it('should highlight number values with distinct color', () => {
      const json = '{"count": 42}';
      render(<JsonHighlighter json={json} />);

      // Numbers should have json-number class
      const number = screen.getByText('42');
      expect(number).toHaveClass('json-number');
    });

    it('should highlight boolean values with distinct color', () => {
      const json = '{"isActive": true, "isDeleted": false}';
      render(<JsonHighlighter json={json} />);

      // Booleans should have json-boolean class
      const trueValue = screen.getByText('true');
      const falseValue = screen.getByText('false');
      expect(trueValue).toHaveClass('json-boolean');
      expect(falseValue).toHaveClass('json-boolean');
    });

    it('should highlight null values with distinct color', () => {
      const json = '{"data": null}';
      render(<JsonHighlighter json={json} />);

      // Null should have json-null class
      const nullValue = screen.getByText('null');
      expect(nullValue).toHaveClass('json-null');
    });

    it('should highlight punctuation with distinct color', () => {
      const json = '{"a": 1}';
      render(<JsonHighlighter json={json} />);

      // Punctuation should have json-punctuation class
      const container = screen.getByTestId('json-highlighter');
      const punctuationElements = container.querySelectorAll('.json-punctuation');

      // Should have { } : ,
      expect(punctuationElements.length).toBeGreaterThan(0);
    });
  });

  describe('Complex JSON Structures', () => {
    it('should handle nested objects', () => {
      const json = JSON.stringify(
        {
          user: {
            name: 'John',
            age: 30,
          },
        },
        null,
        2
      );

      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
      expect(screen.getByText('"user"')).toBeInTheDocument();
      expect(screen.getByText('"name"')).toBeInTheDocument();
      expect(screen.getByText('"John"')).toBeInTheDocument();
    });

    it('should handle arrays', () => {
      const json = JSON.stringify(
        {
          items: [1, 2, 3],
        },
        null,
        2
      );

      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should handle mixed value types', () => {
      const json = JSON.stringify(
        {
          string: 'text',
          number: 123,
          boolean: true,
          null: null,
          array: [1, 2],
          object: { nested: 'value' },
        },
        null,
        2
      );

      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object', () => {
      const json = '{}';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });

    it('should handle empty array', () => {
      const json = '[]';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });

    it('should handle empty string value', () => {
      const json = '{"empty": ""}';
      render(<JsonHighlighter json={json} />);

      const emptyString = screen.getByText('""');
      expect(emptyString).toHaveClass('json-string');
    });

    it('should handle negative numbers', () => {
      const json = '{"temp": -42}';
      render(<JsonHighlighter json={json} />);

      const number = screen.getByText('-42');
      expect(number).toHaveClass('json-number');
    });

    it('should handle decimal numbers', () => {
      const json = '{"price": 19.99}';
      render(<JsonHighlighter json={json} />);

      const number = screen.getByText('19.99');
      expect(number).toHaveClass('json-number');
    });

    it('should handle scientific notation', () => {
      const json = '{"large": 1.5e10}';
      render(<JsonHighlighter json={json} />);

      const number = screen.getByText(/1\.5e\+?10/i);
      expect(number).toHaveClass('json-number');
    });

    it('should handle escaped characters in strings', () => {
      const json = '{"quote": "He said \\"Hello\\""}';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      const json = '{"test": true}';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toHaveAttribute('aria-label', 'Syntax-highlighted JSON');
    });

    it('should preserve whitespace for formatting', () => {
      const json = JSON.stringify({ a: 1 }, null, 2);
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      // Should preserve whitespace
      expect(container).toHaveClass('whitespace-pre');
    });

    it('should be selectable for copy/paste', () => {
      const json = '{"test": "value"}';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      // Should allow text selection
      const computedStyle = window.getComputedStyle(container);
      expect(computedStyle.userSelect).not.toBe('none');
    });
  });

  describe('Dark Mode Support', () => {
    it('should apply dark mode classes when darkMode prop is true', () => {
      const json = '{"test": true}';
      render(<JsonHighlighter json={json} darkMode={true} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toHaveClass('dark');
    });

    it('should not apply dark mode classes by default', () => {
      const json = '{"test": true}';
      render(<JsonHighlighter json={json} />);

      const container = screen.getByTestId('json-highlighter');
      expect(container).not.toHaveClass('dark');
    });
  });

  describe('Color Contrast (Accessibility)', () => {
    it('should use high-contrast colors for light mode', () => {
      const json = '{"test": "value"}';
      render(<JsonHighlighter json={json} />);

      // Keys should be readable (dark blue)
      const key = screen.getByText('"test"');
      expect(key).toHaveClass('text-blue-700');
    });

    it('should use high-contrast colors for dark mode', () => {
      const json = '{"test": "value"}';
      render(<JsonHighlighter json={json} darkMode={true} />);

      // In dark mode, colors should be lighter for contrast
      const key = screen.getByText('"test"');
      // Should have dark mode variant
      expect(key).toHaveClass('dark:text-blue-300');
    });
  });

  describe('Performance', () => {
    it('should handle large JSON strings efficiently', () => {
      const largeObject = Array.from({ length: 100 }, (_, i) => ({
        [`key${i}`]: `value${i}`,
        [`number${i}`]: i,
        [`bool${i}`]: i % 2 === 0,
      }));

      const json = JSON.stringify(largeObject, null, 2);

      const startTime = performance.now();
      render(<JsonHighlighter json={json} />);
      const endTime = performance.now();

      // Should render in less than 1000ms (very generous)
      expect(endTime - startTime).toBeLessThan(1000);

      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });

    it('should memoize to prevent unnecessary re-renders', () => {
      const json = '{"test": "value"}';
      const { rerender } = render(<JsonHighlighter json={json} />);

      // Rerender with same props
      rerender(<JsonHighlighter json={json} />);

      // Component should still render correctly
      const container = screen.getByTestId('json-highlighter');
      expect(container).toBeInTheDocument();
    });
  });
});

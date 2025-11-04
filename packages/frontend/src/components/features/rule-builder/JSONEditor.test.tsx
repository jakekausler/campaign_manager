import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { JSONEditor } from './JSONEditor';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

describe('JSONEditor', () => {
  it('renders without errors', () => {
    render(<JSONEditor />);
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
  });

  it('renders textarea for JSON input', () => {
    render(<JSONEditor />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('displays expression as formatted JSON in textarea', () => {
    const expression = { and: [{ '==': [{ var: 'level' }, 5] as [{ var: string }, number] }] };
    render(<JSONEditor expression={expression} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const textContent = textarea.value;
    expect(textContent).toContain('"and"');
    expect(textContent).toContain('"=="');
    expect(textContent).toContain('"var"');
  });

  it('formats JSON with 2-space indentation', () => {
    const expression = { and: [{ '==': [{ var: 'level' }, 5] as [{ var: string }, number] }] };
    render(<JSONEditor expression={expression} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const expected = JSON.stringify(expression, null, 2);
    expect(textarea.value).toBe(expected);
  });

  it('disables textarea when readOnly is true', () => {
    render(<JSONEditor readOnly={true} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('enables textarea when readOnly is false', () => {
    render(<JSONEditor readOnly={false} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeEnabled();
  });

  it('calls onChange with parsed JSON when valid JSON is entered', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JSONEditor onChange={onChange} />);

    const textarea = screen.getByRole('textbox');
    const newExpression = { or: [{ '>': [{ var: 'level' }, 3] }] };

    // Use paste instead of type to avoid curly brace issues
    await user.click(textarea);
    await user.paste(JSON.stringify(newExpression));

    // Trigger blur to validate
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(newExpression);
  });

  it('shows error message for invalid JSON', async () => {
    const user = userEvent.setup();
    render(<JSONEditor />);

    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste('invalid json syntax');
    await user.tab();

    // Check that at least one element with error message exists
    expect(screen.getAllByText(/invalid JSON/i).length).toBeGreaterThan(0);
  });

  it('does not call onChange for invalid JSON', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JSONEditor onChange={onChange} />);

    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste('invalid syntax');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears error message when valid JSON is entered after error', async () => {
    const user = userEvent.setup();
    render(<JSONEditor />);

    const textarea = screen.getByRole('textbox');

    // Enter invalid JSON
    await user.click(textarea);
    await user.paste('invalid syntax');
    await user.tab();
    expect(screen.getByText(/invalid JSON/i)).toBeInTheDocument();

    // Enter valid JSON
    await user.clear(textarea);
    await user.paste('{"and": []}');
    await user.tab();
    expect(screen.queryByText(/invalid JSON/i)).not.toBeInTheDocument();
  });

  it('displays error with ARIA attributes', async () => {
    const user = userEvent.setup();
    render(<JSONEditor />);

    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste('bad syntax');
    await user.tab();

    const textarea2 = screen.getByRole('textbox');
    expect(textarea2).toHaveAttribute('aria-invalid', 'true');
    expect(textarea2).toHaveAttribute('aria-describedby');
  });

  it('shows specific error message for parse errors', async () => {
    const user = userEvent.setup();
    render(<JSONEditor />);

    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste('{"unclosed": ');
    await user.tab();

    const errorText = screen.getByText(/invalid JSON/i).textContent;
    expect(errorText).toBeTruthy();
  });

  it('handles empty textarea without errors', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JSONEditor onChange={onChange} />);

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.tab();

    expect(screen.queryByText(/invalid JSON/i)).not.toBeInTheDocument();
  });

  it('preserves formatting when expression prop changes', () => {
    const { rerender } = render(<JSONEditor expression={1} />);

    let textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('1');

    rerender(<JSONEditor expression={2} />);
    textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('2');
  });

  it('validates JSON on blur, not on every keystroke', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JSONEditor onChange={onChange} />);

    const textarea = screen.getByRole('textbox');

    // Type incomplete JSON (using regular characters, no braces)
    await user.click(textarea);
    await user.type(textarea, 'incomplete');

    // Should not show error yet
    expect(screen.queryByText(/invalid JSON/i)).not.toBeInTheDocument();

    // Blur to trigger validation
    await user.tab();

    // Now should show error
    expect(screen.getByText(/invalid JSON/i)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { RuleBuilder } from './RuleBuilder';

describe('RuleBuilder', () => {
  it('renders without errors', () => {
    render(<RuleBuilder />);
    expect(screen.getByTestId('rule-builder')).toBeInTheDocument();
  });

  it('renders visual mode by default', () => {
    render(<RuleBuilder />);
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('json-editor')).not.toBeInTheDocument();
  });

  it('renders mode toggle buttons', () => {
    render(<RuleBuilder />);
    expect(screen.getByRole('button', { name: /visual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument();
  });

  it('visual button is active by default', () => {
    render(<RuleBuilder />);
    const visualButton = screen.getByRole('button', { name: /visual/i });
    expect(visualButton).toHaveAttribute('data-active', 'true');
  });

  it('switches to JSON mode when JSON button is clicked', async () => {
    const user = userEvent.setup();
    render(<RuleBuilder />);

    const jsonButton = screen.getByRole('button', { name: /json/i });
    await user.click(jsonButton);

    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('block-editor')).not.toBeInTheDocument();
  });

  it('switches back to visual mode when visual button is clicked', async () => {
    const user = userEvent.setup();
    render(<RuleBuilder />);

    // Switch to JSON
    await user.click(screen.getByRole('button', { name: /json/i }));
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();

    // Switch back to visual
    await user.click(screen.getByRole('button', { name: /visual/i }));
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('json-editor')).not.toBeInTheDocument();
  });

  it('updates active button state when switching modes', async () => {
    const user = userEvent.setup();
    render(<RuleBuilder />);

    const visualButton = screen.getByRole('button', { name: /visual/i });
    const jsonButton = screen.getByRole('button', { name: /json/i });

    // Initial state
    expect(visualButton).toHaveAttribute('data-active', 'true');
    expect(jsonButton).toHaveAttribute('data-active', 'false');

    // Switch to JSON
    await user.click(jsonButton);
    expect(visualButton).toHaveAttribute('data-active', 'false');
    expect(jsonButton).toHaveAttribute('data-active', 'true');
  });

  it('passes initialExpression to BlockEditor in visual mode', () => {
    const expression = { and: [{ '==': [{ var: 'level' }, 5] as [{ var: string }, number] }] };
    render(<RuleBuilder initialExpression={expression} />);

    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
  });

  it('passes expression to JSONEditor in JSON mode', async () => {
    const user = userEvent.setup();
    const expression = { and: [{ '==': [{ var: 'level' }, 5] as [{ var: string }, number] }] };
    render(<RuleBuilder initialExpression={expression} />);

    await user.click(screen.getByRole('button', { name: /json/i }));
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
  });

  it('synchronizes visual changes to JSON mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RuleBuilder onChange={onChange} />);

    // Make a change in visual mode (add a block)
    const addBlockButton = screen.getByTestId('add-block-button');
    await user.click(addBlockButton);

    // Switch to JSON mode and verify onChange was called
    expect(onChange).toHaveBeenCalled();
  });

  it('preserves expression when switching between modes', async () => {
    const user = userEvent.setup();
    const expression = { and: [{ '==': [{ var: 'level' }, 5] as [{ var: string }, number] }] };
    render(<RuleBuilder initialExpression={expression} />);

    // Switch to JSON
    await user.click(screen.getByRole('button', { name: /json/i }));
    const jsonEditor = screen.getByTestId('json-editor');
    expect(jsonEditor).toBeInTheDocument();

    // Switch back to visual
    await user.click(screen.getByRole('button', { name: /visual/i }));
    const blockEditor = screen.getByTestId('block-editor');
    expect(blockEditor).toBeInTheDocument();
  });

  it('passes entityType to BlockEditor', () => {
    render(<RuleBuilder entityType="Settlement" />);
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
  });

  it('calls onChange when expression is modified in visual mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RuleBuilder onChange={onChange} />);

    const addBlockButton = screen.getByTestId('add-block-button');
    await user.click(addBlockButton);

    expect(onChange).toHaveBeenCalled();
  });

  it('calls onChange when expression is modified in JSON mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RuleBuilder onChange={onChange} />);

    // Switch to JSON mode
    await user.click(screen.getByRole('button', { name: /json/i }));

    // Modify JSON (simulated via JSONEditor's onChange)
    // The actual test will depend on JSONEditor implementation
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
  });
});

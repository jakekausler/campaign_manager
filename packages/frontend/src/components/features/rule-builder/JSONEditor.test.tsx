import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { JSONEditor } from './JSONEditor';

describe('JSONEditor', () => {
  it('renders without errors', () => {
    render(<JSONEditor />);
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
  });

  it('displays read-only mode indicator when readOnly is true', () => {
    render(<JSONEditor readOnly={true} />);
    expect(screen.getByText('Mode: Read-only')).toBeInTheDocument();
  });

  it('does not display read-only indicator when readOnly is false', () => {
    render(<JSONEditor readOnly={false} />);
    expect(screen.queryByText('Mode: Read-only')).not.toBeInTheDocument();
  });

  it('displays expression as formatted JSON when provided', () => {
    const testExpression = { if: [{ '==': [{ var: 'level' }, 5] }, true, false] };
    render(<JSONEditor expression={testExpression} />);

    const preElement = screen.getByTestId('json-editor').querySelector('pre');
    expect(preElement).toBeInTheDocument();
    expect(preElement?.textContent).toContain('"if"');
    expect(preElement?.textContent).toContain('"var"');
  });

  it('renders placeholder content', () => {
    render(<JSONEditor />);
    expect(screen.getByText('JSON Editor')).toBeInTheDocument();
    expect(screen.getByText(/Raw JSON editor coming soon/i)).toBeInTheDocument();
  });
});

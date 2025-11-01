import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BlockEditor } from './BlockEditor';

describe('BlockEditor', () => {
  it('renders without errors', () => {
    render(<BlockEditor />);
    expect(screen.getByTestId('block-editor')).toBeInTheDocument();
  });

  it('displays entity type context when provided', () => {
    render(<BlockEditor entityType="Structure" />);
    expect(screen.getByText('Context: Structure')).toBeInTheDocument();
  });

  it('renders placeholder content', () => {
    render(<BlockEditor />);
    expect(screen.getByText('Block Editor')).toBeInTheDocument();
    expect(screen.getByText(/Drag-and-drop block editor coming soon/i)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { RuleBuilder } from './RuleBuilder';

describe('RuleBuilder', () => {
  it('renders without errors', () => {
    render(<RuleBuilder />);
    expect(screen.getByTestId('rule-builder')).toBeInTheDocument();
  });

  it('displays entity type when provided', () => {
    render(<RuleBuilder entityType="Settlement" />);
    expect(screen.getByText('Entity Type: Settlement')).toBeInTheDocument();
  });

  it('displays entity ID when provided', () => {
    render(<RuleBuilder entityId="test-id-123" />);
    expect(screen.getByText('Entity ID: test-id-123')).toBeInTheDocument();
  });

  it('renders placeholder content', () => {
    render(<RuleBuilder />);
    expect(screen.getByText('Rule Builder')).toBeInTheDocument();
    expect(screen.getByText(/Visual rule builder coming soon/i)).toBeInTheDocument();
  });
});

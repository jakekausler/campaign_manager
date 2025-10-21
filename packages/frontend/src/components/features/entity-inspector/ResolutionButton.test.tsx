import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ResolutionButton } from './ResolutionButton';

describe('ResolutionButton', () => {
  describe('Event Entity Type', () => {
    it('renders "Complete Event" label for event type when not resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={false} onClick={onClick} />);

      expect(screen.getByRole('button', { name: /Complete Event/ })).toBeInTheDocument();
    });

    it('renders "Event Completed" label for event type when resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={true} onClick={onClick} />);

      expect(screen.getByRole('button', { name: /Event Completed/ })).toBeInTheDocument();
    });

    it('shows correct tooltip for event type when not resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={false} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Complete Event and execute associated effects');
    });

    it('shows correct tooltip for event type when resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={true} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'This event has already been completed');
    });
  });

  describe('Encounter Entity Type', () => {
    it('renders "Resolve Encounter" label for encounter type when not resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="encounter" isResolved={false} onClick={onClick} />);

      expect(screen.getByRole('button', { name: /Resolve Encounter/ })).toBeInTheDocument();
    });

    it('renders "Encounter Resolved" label for encounter type when resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="encounter" isResolved={true} onClick={onClick} />);

      expect(screen.getByRole('button', { name: /Encounter Resolved/ })).toBeInTheDocument();
    });

    it('shows correct tooltip for encounter type when not resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="encounter" isResolved={false} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Resolve Encounter and execute associated effects');
    });

    it('shows correct tooltip for encounter type when resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="encounter" isResolved={true} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'This encounter has already been resolved');
    });
  });

  describe('Loading State', () => {
    it('renders "Processing..." label when loading', () => {
      const onClick = vi.fn();

      render(
        <ResolutionButton entityType="event" isResolved={false} loading={true} onClick={onClick} />
      );

      expect(screen.getByRole('button', { name: /Processing.../ })).toBeInTheDocument();
    });

    it('shows loading spinner icon when loading', () => {
      const onClick = vi.fn();

      render(
        <ResolutionButton entityType="event" isResolved={false} loading={true} onClick={onClick} />
      );

      const button = screen.getByRole('button');
      // Loader2 icon has class "animate-spin"
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('is disabled when loading', () => {
      const onClick = vi.fn();

      render(
        <ResolutionButton entityType="event" isResolved={false} loading={true} onClick={onClick} />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not call onClick when clicked while loading', () => {
      const onClick = vi.fn();

      render(
        <ResolutionButton entityType="event" isResolved={false} loading={true} onClick={onClick} />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Resolved State', () => {
    it('is disabled when entity is resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={true} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not call onClick when clicked while resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={true} onClick={onClick} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });

    it('uses outline variant when resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={true} onClick={onClick} />);

      const button = screen.getByRole('button');
      // Outline variant doesn't have bg-primary, default variant does
      expect(button.className).not.toContain('bg-primary');
    });
  });

  describe('User Interactions', () => {
    it('calls onClick when clicked (not resolved, not loading)', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={false} onClick={onClick} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is enabled when not resolved and not loading', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={false} onClick={onClick} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Icon Display', () => {
    it('shows CheckCircle icon when not loading', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={false} onClick={onClick} />);

      const button = screen.getByRole('button');
      // CheckCircle icon is present (lucide-react renders svg)
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon?.classList.contains('animate-spin')).toBe(false);
    });

    it('shows Loader2 icon when loading', () => {
      const onClick = vi.fn();

      render(
        <ResolutionButton entityType="event" isResolved={false} loading={true} onClick={onClick} />
      );

      const button = screen.getByRole('button');
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className when provided', () => {
      const onClick = vi.fn();

      render(
        <ResolutionButton
          entityType="event"
          isResolved={false}
          onClick={onClick}
          className="custom-class"
        />
      );

      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('Button Variants', () => {
    it('uses default variant when not resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={false} onClick={onClick} />);

      const button = screen.getByRole('button');
      // Default variant has bg-primary or similar primary color class
      // We check that it's not outline variant (which would have border-input class)
      expect(button.className).not.toContain('border-input');
    });

    it('uses outline variant when resolved', () => {
      const onClick = vi.fn();

      render(<ResolutionButton entityType="event" isResolved={true} onClick={onClick} />);

      const button = screen.getByRole('button');
      // Outline variant has specific classes like border-input
      expect(button.className).toContain('border-input');
    });
  });
});

import { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export interface EventData {
  id: string;
  name: string;
  campaignId: string;
  locationId?: string | null;
  description?: string | null;
  eventType: string;
  scheduledAt?: string | null;
  occurredAt?: string | null;
  isCompleted: boolean;
  variables?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
  [key: string]: unknown;
}

export interface EventPanelProps {
  /** The event entity to display */
  event: EventData;
}

/**
 * EventPanel displays Event-specific information.
 *
 * Features:
 * - Event metadata (name, type, description, eventType)
 * - Scheduling information (scheduledAt, occurredAt, isCompleted)
 * - Typed variables from the variables JSON field
 * - Copy-to-clipboard functionality
 * - Automatic type-based formatting
 */
export function EventPanel({ event }: EventPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Copy text to clipboard and show temporary success indicator
   */
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  /**
   * Format a value for display based on its type
   */
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  /**
   * Format a timestamp for display
   */
  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) {
      return 'N/A';
    }
    try {
      const date = new Date(timestamp);
      // Check if date is invalid (NaN)
      if (isNaN(date.getTime())) {
        return timestamp;
      }
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  /**
   * Convert snake_case to Title Case
   */
  const toTitleCase = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  /**
   * Render a field row with label, value, and copy button
   */
  const renderField = (label: string, value: unknown, fieldKey: string) => {
    const formattedValue = formatValue(value);
    const isCopied = copiedField === fieldKey;

    return (
      <div key={fieldKey} className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        <div className="flex items-start gap-2">
          <div
            className="flex-1 p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono break-all"
            data-testid={`field-${fieldKey}`}
          >
            {formattedValue}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(formattedValue, fieldKey)}
            className="shrink-0 h-8"
            title={isCopied ? 'Copied!' : 'Copy to clipboard'}
          >
            {isCopied ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-slate-500">📋</span>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const variables = event.variables || {};
  const hasVariables = Object.keys(variables).length > 0;

  return (
    <div className="space-y-6">
      {/* Event Attributes Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Event Attributes</h3>
        <div className="space-y-3">
          {renderField('Event Type', event.eventType, 'eventType')}
          {renderField('Campaign ID', event.campaignId, 'campaignId')}
          {event.locationId && renderField('Location ID', event.locationId, 'locationId')}
          {renderField('Description', event.description || 'N/A', 'description')}
          {renderField('Is Completed', event.isCompleted, 'isCompleted')}
        </div>
      </Card>

      {/* Scheduling Information Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Scheduling Information</h3>
        <div className="space-y-3">
          {renderField('Scheduled At', formatTimestamp(event.scheduledAt), 'scheduledAt')}
          {renderField('Occurred At', formatTimestamp(event.occurredAt), 'occurredAt')}
        </div>
      </Card>

      {/* Typed Variables Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Typed Variables</h3>
        {hasVariables ? (
          <div className="space-y-3">
            {Object.entries(variables).map(([key, value]) =>
              renderField(toTitleCase(key), value, `variable-${key}`)
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No typed variables available for this event</p>
        )}
      </Card>
    </div>
  );
}

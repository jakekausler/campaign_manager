import { useState } from 'react';

import { EntityInspector } from '@/components/features/entity-inspector';
import { Button } from '@/components/ui';

/**
 * Demo page for testing the EntityInspector component.
 * This page will be removed once integration is complete in Stage 11.
 */
export default function EntityInspectorDemoPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [entityType, setEntityType] = useState<'settlement' | 'structure'>('settlement');

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Entity Inspector Demo</h1>

      <div className="space-y-4">
        <p className="text-slate-600">
          This is a temporary demo page to test the EntityInspector component during development.
        </p>

        <div className="flex gap-4">
          <Button
            onClick={() => {
              setEntityType('settlement');
              setIsOpen(true);
            }}
          >
            Open Settlement Inspector
          </Button>

          <Button
            onClick={() => {
              setEntityType('structure');
              setIsOpen(true);
            }}
            variant="outline"
          >
            Open Structure Inspector
          </Button>
        </div>
      </div>

      <EntityInspector
        entityType={entityType}
        entityId="demo-entity-123"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}

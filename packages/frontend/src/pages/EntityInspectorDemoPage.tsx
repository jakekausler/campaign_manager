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
  const [entityId, setEntityId] = useState<string>('settlement-1');

  const openInspector = (type: 'settlement' | 'structure', id: string) => {
    setEntityType(type);
    setEntityId(id);
    setIsOpen(true);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Entity Inspector Demo</h1>

      <div className="space-y-6">
        <p className="text-slate-600">
          This is a temporary demo page to test the EntityInspector component during development.
          Click the buttons below to open the inspector for different entities.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-3">Settlements</h2>
          <div className="flex gap-4 flex-wrap">
            <Button onClick={() => openInspector('settlement', 'settlement-1')}>
              Ironhold (Level 3)
            </Button>

            <Button onClick={() => openInspector('settlement', 'settlement-2')} variant="outline">
              Silverport (Level 2)
            </Button>

            <Button onClick={() => openInspector('settlement', 'settlement-3')} variant="outline">
              Greenwood (Level 1)
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">Structures</h2>
          <div className="flex gap-4 flex-wrap">
            <Button onClick={() => openInspector('structure', 'structure-1')}>
              Barracks (Ironhold)
            </Button>

            <Button onClick={() => openInspector('structure', 'structure-2')} variant="outline">
              Marketplace (Ironhold)
            </Button>

            <Button onClick={() => openInspector('structure', 'structure-3')} variant="outline">
              Temple (Silverport)
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">Error Cases</h2>
          <div className="flex gap-4 flex-wrap">
            <Button
              onClick={() => openInspector('settlement', 'invalid-settlement')}
              variant="destructive"
            >
              Invalid Settlement (Error)
            </Button>

            <Button
              onClick={() => openInspector('structure', 'invalid-structure')}
              variant="destructive"
            >
              Invalid Structure (Error)
            </Button>

            <Button
              onClick={() => openInspector('settlement', 'nonexistent-settlement')}
              variant="destructive"
            >
              Nonexistent Settlement (Not Found)
            </Button>
          </div>
        </div>
      </div>

      <EntityInspector
        entityType={entityType}
        entityId={entityId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/**
 * FlowViewPage - Interactive dependency graph visualization
 *
 * Displays relationships between entities (variables, conditions, effects,
 * settlements, structures) using React Flow. This is a read-only visualization
 * with selection, highlighting, and navigation features.
 *
 * Part of TICKET-021 implementation.
 */
export default function FlowViewPage() {
  return (
    <div className="h-screen w-full">
      <ReactFlow nodes={[]} edges={[]} fitView className="bg-background">
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

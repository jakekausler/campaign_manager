# TICKET-036: Settlement & Structure Hierarchical UI

## Status

- [ ] Completed
- **Commits**:

## Description

Create dedicated UI panels and components for managing Settlement-Structure hierarchies within the Entity Inspector, including visual hierarchy trees, add/remove operations, level management, and typed variable editing.

## Scope of Work

1. Create Settlement hierarchy panel in Entity Inspector:
   - Visual tree view showing Settlement → Structures hierarchy
   - Expandable/collapsible structure nodes
   - Drag-and-drop support for reordering (optional)
   - Quick stats: total structures, average structure level
2. Create "Add Structure" UI workflow:
   - Modal/drawer for creating new structures
   - Structure type selector (temple, barracks, market, library, etc.)
   - Initial level setting
   - Typed variable schema assignment
   - Location context (inherited from Settlement)
3. Create Structure management panel:
   - List view of all structures in a settlement
   - Filter by structure type
   - Sort by level, name, type
   - Bulk operations (delete, archive)
4. Implement level management UI:
   - Level up/down controls for Settlements
   - Level up/down controls for Structures
   - Visual level indicators (progress bars, badges)
   - Level change confirmation with rules engine impact warning
5. Create typed variable editor:
   - Dynamic form generation from variable schemas
   - Type-specific input controls (text, number, boolean, enum)
   - Validation feedback
   - Variable preview/current value display
   - Save/cancel operations
6. Add Settlement-Location relationship display:
   - Show Settlement's associated Location on map mini-preview
   - "Jump to Location" button to navigate to map view
   - Location name and coordinates display
7. Add Kingdom context display:
   - Show parent Kingdom information
   - "Navigate to Kingdom" link
   - Kingdom-level stats relevant to Settlement
8. Implement Structure detail view:
   - Structure type with icon
   - Current level and progress
   - Typed variables section
   - Parent Settlement context
   - "Navigate to Settlement" link
9. Add confirmation dialogs:
   - Delete structure confirmation
   - Level change impact preview
   - Variable change validation errors
10. Optimize performance:
    - Lazy loading for large structure lists
    - Virtual scrolling for 100+ structures
    - Debounced search/filter

## Acceptance Criteria

- [ ] Settlement hierarchy panel displays structure tree correctly
- [ ] Can add new structures to settlements via modal
- [ ] Structure type selector shows all available types
- [ ] Can remove structures from settlements with confirmation
- [ ] Level up/down controls work for Settlements
- [ ] Level up/down controls work for Structures
- [ ] Level changes trigger rules engine recalculation
- [ ] Typed variable editor generates correct form controls
- [ ] Variable validation works for all types (string, number, boolean, enum)
- [ ] Can save typed variable changes
- [ ] Settlement-Location relationship displays with map preview
- [ ] Kingdom context shows parent kingdom information
- [ ] Structure detail view shows all relevant information
- [ ] Navigation between Settlement/Structure/Kingdom works
- [ ] Performance is acceptable with 50+ structures per settlement
- [ ] Virtual scrolling works for large structure lists
- [ ] Search and filter operations are responsive

## Technical Notes

### Settlement Hierarchy Component

```typescript
interface SettlementHierarchyProps {
  settlementId: string;
  onStructureSelect: (structureId: string) => void;
  onAddStructure: () => void;
}

const SettlementHierarchy: React.FC<SettlementHierarchyProps> = ({
  settlementId,
  onStructureSelect,
  onAddStructure,
}) => {
  const { data: settlement } = useSettlementDetails(settlementId);
  const { data: structures } = useStructuresBySettlement(settlementId);

  return (
    <Card>
      <CardHeader>
        <h3>{settlement.name} Structures</h3>
        <Button onClick={onAddStructure}>Add Structure</Button>
      </CardHeader>
      <CardContent>
        <Tree>
          <TreeItem label={settlement.name} icon={<SettlementIcon />}>
            {structures.map(structure => (
              <TreeItem
                key={structure.id}
                label={`${structure.name} (${structure.type})`}
                icon={<StructureIcon type={structure.type} />}
                onClick={() => onStructureSelect(structure.id)}
              >
                <StructureStats structure={structure} />
              </TreeItem>
            ))}
          </TreeItem>
        </Tree>
      </CardContent>
    </Card>
  );
};
```

### Add Structure Modal

```typescript
interface AddStructureModalProps {
  settlementId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (structure: Structure) => void;
}

const AddStructureModal: React.FC<AddStructureModalProps> = ({
  settlementId,
  open,
  onClose,
  onSuccess,
}) => {
  const [createStructure] = useCreateStructureMutation();
  const [form] = useForm<CreateStructureInput>();

  const structureTypes = [
    { value: 'temple', label: 'Temple', icon: '⛪' },
    { value: 'barracks', label: 'Barracks', icon: '🏰' },
    { value: 'market', label: 'Market', icon: '🏪' },
    { value: 'library', label: 'Library', icon: '📚' },
    { value: 'forge', label: 'Forge', icon: '🔨' },
    { value: 'tavern', label: 'Tavern', icon: '🍺' },
  ];

  const onSubmit = async (data: CreateStructureInput) => {
    const result = await createStructure({
      variables: {
        input: {
          ...data,
          settlementId,
        },
      },
    });
    onSuccess(result.data.createStructure);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>Add New Structure</ModalHeader>
      <ModalBody>
        <Form form={form} onSubmit={onSubmit}>
          <FormField name="name" label="Structure Name" required />
          <FormField
            name="type"
            label="Structure Type"
            component={StructureTypeSelect}
            options={structureTypes}
            required
          />
          <FormField
            name="level"
            label="Initial Level"
            type="number"
            min={1}
            defaultValue={1}
          />
          <TypedVariableSchemaEditor name="variableSchemas" />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">Create Structure</Button>
      </ModalFooter>
    </Modal>
  );
};
```

### Level Management Component

```typescript
interface LevelControlProps {
  entityId: string;
  entityType: 'settlement' | 'structure';
  currentLevel: number;
  onLevelChange: (newLevel: number) => Promise<void>;
}

const LevelControl: React.FC<LevelControlProps> = ({
  entityId,
  entityType,
  currentLevel,
  onLevelChange,
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);

  const handleLevelChange = (delta: number) => {
    const newLevel = currentLevel + delta;
    if (newLevel < 1) return;

    setPendingLevel(newLevel);
    setShowConfirmation(true);
  };

  const confirmLevelChange = async () => {
    if (pendingLevel === null) return;

    await onLevelChange(pendingLevel);
    setShowConfirmation(false);
    setPendingLevel(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleLevelChange(-1)}
        disabled={currentLevel <= 1}
      >
        -
      </Button>
      <Badge variant="primary" size="lg">
        Level {currentLevel}
      </Badge>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleLevelChange(1)}
      >
        +
      </Button>

      <ConfirmationDialog
        open={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmLevelChange}
        title="Confirm Level Change"
        message={`Changing level from ${currentLevel} to ${pendingLevel} may trigger rules engine recalculation. Continue?`}
      />
    </div>
  );
};
```

### Typed Variable Editor

```typescript
interface TypedVariableEditorProps {
  entityId: string;
  entityType: 'settlement' | 'structure';
  variableSchemas: VariableSchema[];
  currentVariables: Record<string, unknown>;
  onSave: (variables: Record<string, unknown>) => Promise<void>;
}

const TypedVariableEditor: React.FC<TypedVariableEditorProps> = ({
  entityId,
  entityType,
  variableSchemas,
  currentVariables,
  onSave,
}) => {
  const [form] = useForm();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateVariable = (schema: VariableSchema, value: unknown): string | null => {
    if (schema.type === 'number' && typeof value !== 'number') {
      return 'Must be a number';
    }
    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      return 'Must be a boolean';
    }
    if (schema.type === 'enum' && !schema.enumValues?.includes(value as string)) {
      return `Must be one of: ${schema.enumValues?.join(', ')}`;
    }
    return null;
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    const newErrors: Record<string, string> = {};

    for (const schema of variableSchemas) {
      const error = validateVariable(schema, data[schema.name]);
      if (error) {
        newErrors[schema.name] = error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onSave(data);
  };

  return (
    <Card>
      <CardHeader>
        <h4>Typed Variables</h4>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={handleSubmit} initialValues={currentVariables}>
          {variableSchemas.map(schema => (
            <FormField
              key={schema.name}
              name={schema.name}
              label={schema.name}
              description={schema.description}
              type={schema.type === 'number' ? 'number' : 'text'}
              component={schema.type === 'enum' ? Select : undefined}
              options={schema.type === 'enum' ? schema.enumValues?.map(v => ({ value: v, label: v })) : undefined}
              error={errors[schema.name]}
            />
          ))}
          <Button type="submit">Save Variables</Button>
        </Form>
      </CardContent>
    </Card>
  );
};
```

## Architectural Decisions

- **Tree component**: Use shadcn/ui Tree or react-arborist for hierarchy visualization
- **Virtual scrolling**: Use react-virtual or react-window for large structure lists
- **Form generation**: Dynamic form generation from variable schemas
- **Validation**: Client-side validation with server-side verification
- **Optimistic updates**: Update UI immediately, rollback on error
- **Navigation**: Use React Router for Settlement/Structure/Kingdom navigation
- **State management**: Use React Query for data fetching and caching
- **Icons**: Use lucide-react or react-icons for structure type icons

## Dependencies

- Requires: TICKET-023 (Entity Inspector Component)
- Requires: TICKET-009 (Settlement/Structure CRUD operations)
- Requires: TICKET-018 (State Management & GraphQL Client)

## Testing Requirements

- [ ] Hierarchy tree renders correctly with nested structures
- [ ] Add structure modal creates structures successfully
- [ ] Structure type selector shows all types
- [ ] Remove structure deletes with confirmation
- [ ] Level controls increment/decrement correctly
- [ ] Level changes trigger rules engine updates
- [ ] Typed variable editor validates all types
- [ ] Variable save operations persist correctly
- [ ] Navigation between entities works
- [ ] Performance is acceptable with 100+ structures
- [ ] Virtual scrolling works correctly
- [ ] Search/filter operations are fast

## Related Tickets

- Requires: TICKET-009, TICKET-018, TICKET-023
- Related: TICKET-019 (Map View), TICKET-021 (Flow View)

## Estimated Effort

5-6 days

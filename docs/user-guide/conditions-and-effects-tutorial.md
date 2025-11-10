# Conditions and Effects Tutorial

This tutorial will teach you how to create dynamic, responsive campaigns using **Conditions** (rules that determine when things happen) and **Effects** (changes to your world state). These powerful features allow your campaign to react intelligently to player actions and world events.

## Table of Contents

1. [What Are Conditions and Effects?](#what-are-conditions-and-effects)
2. [Understanding Conditions (JSONLogic)](#understanding-conditions-jsonlogic)
3. [Understanding Effects (JSON Patch)](#understanding-effects-json-patch)
4. [Simple Examples](#simple-examples)
5. [Intermediate Examples](#intermediate-examples)
6. [Advanced Examples](#advanced-examples)
7. [Creating Your First Conditional Event](#creating-your-first-conditional-event)
8. [Common Patterns](#common-patterns)
9. [Testing and Debugging](#testing-and-debugging)
10. [Best Practices](#best-practices)

## What Are Conditions and Effects?

### Conditions

**Conditions** are rules that determine **when** something should happen. Think of them as "if-then" logic for your campaign.

**Examples:**

- "If the party has defeated the dragon, then trigger the victory celebration event"
- "If the settlement's morale is below 50, then the rebellion event can occur"
- "If it's winter and the mountain pass is blocked, then travelers must take the long route"

**Technical Implementation:** Conditions use **JSONLogic**, a JSON-based rules engine that evaluates logical expressions.

### Effects

**Effects** are changes that happen **when** an event occurs or resolves. They modify your world state.

**Examples:**

- "When the festival succeeds, increase settlement morale by 10"
- "When the fire event occurs, reduce the settlement's population by 100"
- "When the hero is knighted, add 'Knight' title to their character data"

**Technical Implementation:** Effects use **JSON Patch**, a standard format for describing changes to JSON documents.

### Why Use Them Together?

Conditions and Effects work together to create **reactive, dynamic campaigns**:

1. **Condition checks**: "Should this event happen?"
2. **Event occurs**: The event triggers based on the condition
3. **Effect applies**: The world state changes as a result

**Example Flow:**

```
Condition: Settlement morale < 50
→ Event: "Citizen Uprising" triggers
→ Effect: Settlement loses 5 defense rating
→ New Condition: Defense < 10 allows "Bandit Raid"
→ And so on...
```

## Understanding Conditions (JSONLogic)

JSONLogic uses JSON to represent logical operations. Don't worry—it's simpler than it sounds!

### Basic Structure

All JSONLogic conditions follow this pattern:

```json
{
  "operator": [arguments]
}
```

> 📸 **Screenshot needed: JSONLogic Condition in Entity Inspector**
>
> Show the Entity Inspector displaying an event (e.g., "Swallowtail Festival") with the Conditions section expanded. Display a JSONLogic condition in formatted JSON with syntax highlighting. Include annotations pointing to the operator, variables (`var`), and comparison values. Show the condition evaluation status (true/false) if available.

### Common Operators

#### Comparison Operators

**Greater Than (`>`)**

```json
{
  ">": [{ "var": "settlement.morale" }, 50]
}
```

Translation: "Settlement morale is greater than 50"

**Less Than (`<`)**

```json
{
  "<": [{ "var": "settlement.population" }, 1000]
}
```

Translation: "Settlement population is less than 1000"

**Equal (`==`)**

```json
{
  "==": [{ "var": "event.status" }, "completed"]
}
```

Translation: "Event status equals 'completed'"

**Not Equal (`!=`)**

```json
{
  "!=": [{ "var": "character.class" }, "wizard"]
}
```

Translation: "Character class is not wizard"

#### Logical Operators

**AND (`and`)**

```json
{
  "and": [
    { ">": [{ "var": "settlement.morale" }, 70] },
    { "<": [{ "var": "settlement.defense" }, 5] }
  ]
}
```

Translation: "Morale > 70 AND defense < 5"

**OR (`or`)**

```json
{
  "or": [{ "==": [{ "var": "season" }, "winter"] }, { "==": [{ "var": "season" }, "autumn"] }]
}
```

Translation: "Season is winter OR autumn"

**NOT (`!`)**

```json
{
  "!": {
    "==": [{ "var": "quest.completed" }, true]
  }
}
```

Translation: "Quest is NOT completed"

#### Variable Access (`var`)

The `var` operator accesses data from your campaign:

```json
{"var": "settlement.morale"}          // Access settlement's morale
{"var": "character.level"}            // Access character level
{"var": "event.startDate"}            // Access event start date
{"var": "world.currentDate"}          // Access current world time
```

You can also provide default values:

```json
{ "var": ["settlement.gold", 0] } // Default to 0 if gold doesn't exist
```

#### Array Operations

**In (`in`)**

```json
{
  "in": ["Sandpoint", { "var": "settlement.allies" }]
}
```

Translation: "Sandpoint is in the list of settlement allies"

**Some/Any**

```json
{
  "some": [{ "var": "party.members" }, { ">": [{ "var": "level" }, 10] }]
}
```

Translation: "At least one party member has level > 10"

**All**

```json
{
  "all": [{ "var": "settlements" }, { ">": [{ "var": "morale" }, 50] }]
}
```

Translation: "All settlements have morale > 50"

### Building Complex Conditions

You can nest operators to create sophisticated logic:

```json
{
  "and": [
    { ">": [{ "var": "settlement.morale" }, 60] },
    {
      "or": [
        { "==": [{ "var": "season" }, "summer"] },
        { ">": [{ "var": "settlement.gold" }, 10000] }
      ]
    },
    { "!": { "in": ["plague", { "var": "settlement.conditions" }] } }
  ]
}
```

Translation:
"Morale > 60 AND (season is summer OR gold > 10000) AND settlement doesn't have plague"

## Understanding Effects (JSON Patch)

JSON Patch describes changes to JSON data using a series of operations.

### Basic Structure

Each effect is an array of operations:

```json
[
  {
    "op": "operation_type",
    "path": "/path/to/data",
    "value": new_value
  }
]
```

> 📸 **Screenshot needed: JSON Patch Effect in Entity Inspector**
>
> Show the Entity Inspector displaying an event's Effects section with a JSON Patch operation visible. Highlight the operation structure (op, path, value) with annotations. Show multiple effects if the event has them, and indicate the execution phase (PRE/ON_RESOLVE/POST) and priority number for each effect.

### Common Operations

#### Add (`add`)

Adds a new value or appends to an array:

```json
[
  {
    "op": "add",
    "path": "/settlement/variables/festivals_held",
    "value": 1
  }
]
```

**Use Cases:**

- Adding new properties
- Appending to arrays
- Creating new data fields

#### Replace (`replace`)

Replaces an existing value:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": 75
  }
]
```

**Use Cases:**

- Updating existing values
- Changing status fields
- Modifying counters

#### Remove (`remove`)

Removes a value or array element:

```json
[
  {
    "op": "remove",
    "path": "/settlement/variables/temporary_bonus"
  }
]
```

**Use Cases:**

- Removing temporary effects
- Deleting expired data
- Clearing flags

#### Increment/Decrement

While JSON Patch doesn't have built-in increment, you can achieve it by reading the current value and replacing it:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": { "$add": [{ "var": "settlement.variables.morale" }, 10] }
  }
]
```

This is a convention used by the campaign tool to increment by 10.

### Path Syntax

Paths use `/` to separate levels:

```json
"/settlement/variables/morale"           // settlement.variables.morale
"/character/inventory/0/name"            // First item in inventory
"/events/goblin_raid/status"             // Specific event status
```

### Multiple Operations

Effects can include multiple operations that execute in order:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": 80
  },
  {
    "op": "add",
    "path": "/settlement/variables/festivals_held",
    "value": 1
  },
  {
    "op": "remove",
    "path": "/settlement/variables/festival_planned"
  }
]
```

This effect:

1. Sets morale to 80
2. Increments festivals_held counter
3. Removes the festival_planned flag

## Simple Examples

### Example 1: Time-Based Event

**Scenario:** A festival should only occur in summer.

**Condition:**

```json
{
  "==": [{ "var": "world.currentSeason" }, "summer"]
}
```

**Effect:** (When festival occurs)

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": 85
  }
]
```

### Example 2: Resource Check

**Scenario:** Building a temple requires 5000 gold.

**Condition:**

```json
{
  ">=": [{ "var": "settlement.variables.gold" }, 5000]
}
```

**Effect:** (When temple is built)

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/gold",
    "value": { "$subtract": [{ "var": "settlement.variables.gold" }, 5000] }
  },
  {
    "op": "add",
    "path": "/settlement/structures/-",
    "value": {
      "name": "Temple of Desna",
      "type": "temple",
      "level": 1
    }
  }
]
```

### Example 3: Status Check

**Scenario:** A celebration event requires previous quest completion.

**Condition:**

```json
{
  "==": [{ "var": "events.goblin_raid.status" }, "completed"]
}
```

**Effect:** (When celebration occurs)

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": { "$add": [{ "var": "settlement.variables.morale" }, 15] }
  },
  {
    "op": "add",
    "path": "/settlement/variables/celebrations",
    "value": 1
  }
]
```

## Intermediate Examples

### Example 4: Multiple Conditions

**Scenario:** A trade fair requires good morale, summer season, and no active plague.

**Condition:**

```json
{
  "and": [
    { ">": [{ "var": "settlement.variables.morale" }, 60] },
    { "==": [{ "var": "world.currentSeason" }, "summer"] },
    { "!": { "in": ["plague", { "var": "settlement.variables.active_conditions" }] } }
  ]
}
```

**Effect:**

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/gold",
    "value": { "$add": [{ "var": "settlement.variables.gold" }, 2000] }
  },
  {
    "op": "replace",
    "path": "/settlement/variables/trade_reputation",
    "value": { "$add": [{ "var": "settlement.variables.trade_reputation" }, 5] }
  }
]
```

### Example 5: Cascading Effects

**Scenario:** A successful defense increases morale, which might trigger a recruitment event.

**Event 1: Defense Success**

Condition: (Always true, triggered by encounter completion)

```json
{ "==": [1, 1] }
```

Effect:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": { "$add": [{ "var": "settlement.variables.morale" }, 20] }
  },
  {
    "op": "replace",
    "path": "/settlement/variables/defense_rating",
    "value": { "$add": [{ "var": "settlement.variables.defense_rating" }, 2] }
  }
]
```

**Event 2: Recruitment Drive** (automatically eligible after morale increase)

Condition:

```json
{
  ">": [{ "var": "settlement.variables.morale" }, 75]
}
```

Effect:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/guard_count",
    "value": { "$add": [{ "var": "settlement.variables.guard_count" }, 10] }
  }
]
```

### Example 6: Variable Comparisons

**Scenario:** Issue a warning if defense is less than threat level.

**Condition:**

```json
{
  "<": [
    { "var": "settlement.variables.defense_rating" },
    { "var": "region.variables.threat_level" }
  ]
}
```

**Effect:**

```json
[
  {
    "op": "add",
    "path": "/settlement/variables/warnings/-",
    "value": {
      "type": "defense_inadequate",
      "date": { "var": "world.currentDate" },
      "message": "Defense rating insufficient for current threat level"
    }
  }
]
```

## Advanced Examples

### Example 7: Complex Event Chain

**Scenario:** A corruption mechanic that spreads over time.

**Event: Corruption Spreads**

Condition: (Region has corruption and it's been 30 days)

```json
{
  "and": [
    { ">": [{ "var": "region.variables.corruption_level" }, 0] },
    {
      ">=": [{ "var": "world.daysSinceEvent.corruption_started" }, 30]
    }
  ]
}
```

Effect:

```json
[
  {
    "op": "replace",
    "path": "/region/variables/corruption_level",
    "value": { "$multiply": [{ "var": "region.variables.corruption_level" }, 1.1] }
  },
  {
    "op": "replace",
    "path": "/region/variables/traversable",
    "value": {
      "$if": [{ ">": [{ "var": "region.variables.corruption_level" }, 75] }, false, true]
    }
  }
]
```

This increases corruption by 10% and makes the region untraversable if corruption exceeds 75.

### Example 8: Dynamic Quest Rewards

**Scenario:** Reward scales based on party level.

**Event: Quest Completion**

Condition: (Quest completed)

```json
{
  "==": [{ "var": "quest.status" }, "completed"]
}
```

Effect:

```json
[
  {
    "op": "add",
    "path": "/party/gold",
    "value": {
      "$multiply": [{ "var": "party.averageLevel" }, 100]
    }
  },
  {
    "op": "add",
    "path": "/party/reputation",
    "value": {
      "$min": [
        {
          "$divide": [{ "var": "party.averageLevel" }, 2]
        },
        10
      ]
    }
  }
]
```

This gives 100 gold per party level, and reputation based on level (capped at 10).

### Example 9: Branching Scenarios

**Scenario:** Different outcomes based on player choice.

**Choice 1: Negotiate**

Condition:

```json
{
  "==": [{ "var": "encounter.playerChoice" }, "negotiate"]
}
```

Effect:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/gold",
    "value": { "$subtract": [{ "var": "settlement.variables.gold" }, 1000] }
  },
  {
    "op": "replace",
    "path": "/settlement/variables/peace_treaties",
    "value": { "$add": [{ "var": "settlement.variables.peace_treaties" }, 1] }
  },
  {
    "op": "add",
    "path": "/settlement/variables/allies/-",
    "value": "Goblin Tribe"
  }
]
```

**Choice 2: Attack**

Condition:

```json
{
  "==": [{ "var": "encounter.playerChoice" }, "attack"]
}
```

Effect:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": { "$add": [{ "var": "settlement.variables.morale" }, 10] }
  },
  {
    "op": "replace",
    "path": "/settlement/variables/enemies/-",
    "value": "Goblin Tribe"
  },
  {
    "op": "add",
    "path": "/region/variables/hostilities/-",
    "value": {
      "faction": "Goblins",
      "intensity": "high"
    }
  }
]
```

## Creating Your First Conditional Event

Let's create a complete event from scratch: **A Harvest Festival**

### Step 1: Define the Scenario

**Event:** Autumn Harvest Festival

- **When:** Only in autumn, when food stores are adequate
- **Effect:** Increases morale, costs gold for preparations

### Step 2: Create the Event

1. Go to **Timeline View**
2. Click **"Create Event"**
3. Fill in basic details:
   - Name: "Autumn Harvest Festival"
   - Description: "The town celebrates a successful harvest with feasting and festivities."
   - Date: Select a date in autumn

### Step 3: Add the Condition

Click **"Add Condition"** and enter:

```json
{
  "and": [
    { "==": [{ "var": "world.currentSeason" }, "autumn"] },
    { ">": [{ "var": "settlement.variables.food_stores" }, 500] },
    { ">=": [{ "var": "settlement.variables.gold" }, 200] }
  ]
}
```

**What this checks:**

- Season is autumn
- Food stores > 500 (adequate surplus)
- Gold ≥ 200 (can afford festival costs)

### Step 4: Add the Effects

Click **"Add Effect"** and enter:

```json
[
  {
    "op": "replace",
    "path": "/settlement/variables/gold",
    "value": {"$subtract": [{"var": "settlement.variables.gold"}, 200]}
  },
  {
    "op": "replace",
    "path": "/settlement/variables/morale",
    "value": {"$add": [{"var": "settlement.variables.morale"}, 15]}
  },
  {
    "op": "replace",
    "path": "/settlement/variables/food_stores",
    "value": {"$subtract": [{"var": "settlement.variables.food_stores"}, 100]}
  },
  {
    "op": "add",
    "path": "/settlement/variables/festivals_held",
    "value": {"$add": [{"var": "settlement.variables.festivals_held", 0}, 1]}
  }
]
```

**What this does:**

1. Spends 200 gold on festival
2. Increases morale by 15
3. Consumes 100 food for feast
4. Increments festivals counter

### Step 5: Test the Event

1. Set your world time to autumn
2. Ensure settlement has food_stores > 500 and gold ≥ 200
3. The event should now be eligible to trigger
4. Resolve the event and verify effects apply correctly

## Common Patterns

### Pattern 1: Threshold Monitoring

Monitor a variable and trigger events at specific thresholds:

```json
// Low Morale Warning
{
  "<": [{"var": "settlement.variables.morale"}, 30]
}

// Population Boom
{
  ">": [{"var": "settlement.population"}, 5000]
}

// Resource Depletion
{
  "<": [{"var": "settlement.variables.food_stores"}, 100]
}
```

### Pattern 2: Time-Based Triggers

Events that occur at specific times or intervals:

```json
// Winter Event
{
  "==": [{"var": "world.currentSeason"}, "winter"]
}

// Anniversary (every 365 days)
{
  "==": [
    {"$mod": [{"var": "world.daysSinceEpoch"}, 365]},
    0
  ]
}

// Monthly Event (every 30 days)
{
  "==": [
    {"$mod": [{"var": "world.daysSinceEpoch"}, 30]},
    0
  ]
}
```

### Pattern 3: Prerequisite Chains

Events that require other events to complete first:

```json
{
  "and": [
    { "==": [{ "var": "events.quest_1.status" }, "completed"] },
    { "==": [{ "var": "events.quest_2.status" }, "completed"] },
    { "!": { "==": [{ "var": "events.quest_3.status" }, "completed"] } }
  ]
}
```

### Pattern 4: Resource Management

Effects that manage settlement resources:

```json
[
  // Collect taxes
  {
    "op": "replace",
    "path": "/settlement/variables/gold",
    "value": {
      "$add": [
        { "var": "settlement.variables.gold" },
        { "$multiply": [{ "var": "settlement.population" }, 0.1] }
      ]
    }
  },
  // Pay guards
  {
    "op": "replace",
    "path": "/settlement/variables/gold",
    "value": {
      "$subtract": [
        { "var": "settlement.variables.gold" },
        { "$multiply": [{ "var": "settlement.variables.guard_count" }, 5] }
      ]
    }
  }
]
```

### Pattern 5: State Machines

Create state-based progression:

```json
// Transition from "building" to "completed"
[
  {
    "op": "replace",
    "path": "/structure/variables/construction_state",
    "value": {
      "$switch": [
        { "var": "structure.variables.construction_progress" },
        [
          [{ "<": [{ "var": "" }, 50] }, "foundation"],
          [{ "<": [{ "var": "" }, 80] }, "walls"],
          [{ "<": [{ "var": "" }, 100] }, "roof"],
          [{ ">=": [{ "var": "" }, 100] }, "completed"]
        ],
        "unknown"
      ]
    }
  }
]
```

## Testing and Debugging

### Testing Conditions

**Method 1: Manual Variable Setting**

1. Create test settlement with specific variable values
2. Create event with condition
3. Verify condition evaluates correctly

**Method 2: Condition Tester (if available)**

1. Use built-in condition tester tool
2. Enter sample data
3. Test condition logic

### Testing Effects

**Method 1: Before/After Snapshot**

1. Note current settlement variables
2. Trigger event
3. Verify variables changed as expected

**Method 2: Effect Preview (if available)**

1. View effect before applying
2. See predicted changes
3. Confirm or cancel

### Common Issues

**Condition never evaluates to true:**

- Check variable paths are correct
- Verify data types match (number vs string)
- Use condition tester to debug logic

**Effect doesn't apply:**

- Verify path syntax is correct
- Check that the path exists
- Ensure operation type matches target (can't replace non-existent value)

**Effect applies incorrectly:**

- Check operation order (operations execute sequentially)
- Verify arithmetic is correct
- Test with simple values first

### Debugging Tips

1. **Start Simple:** Begin with basic conditions and effects, then add complexity
2. **Test Incrementally:** Test each operation individually
3. **Use Defaults:** Provide default values in `var` operations: `{"var": ["path", 0]}`
4. **Log State:** Track variable values over time to verify changes
5. **Use Comments:** Add description fields to explain complex logic

## Best Practices

### Condition Best Practices

**DO:**

- ✅ Use clear, descriptive variable names
- ✅ Provide default values for optional data
- ✅ Keep conditions as simple as possible
- ✅ Document complex logic with event descriptions
- ✅ Test edge cases (zero, negative, null values)

**DON'T:**

- ❌ Create overly complex nested conditions
- ❌ Rely on undocumented variable names
- ❌ Assume data always exists
- ❌ Use magic numbers (document what thresholds mean)

### Effect Best Practices

**DO:**

- ✅ Apply effects in logical order
- ✅ Validate data before modifying
- ✅ Use atomic operations when possible
- ✅ Document what each operation does
- ✅ Consider downstream consequences

**DON'T:**

- ❌ Modify the same path multiple times in one effect
- ❌ Create circular dependencies
- ❌ Delete critical data without backup
- ❌ Forget to update related variables

### Organization Best Practices

**Naming Conventions:**

- Use descriptive event names: "Harvest Festival Success" not "Event_42"
- Use consistent variable naming: `snake_case` for multi-word variables
- Prefix related variables: `festival_morale_bonus`, `festival_gold_cost`

**Documentation:**

- Explain what conditions check in event descriptions
- Document expected variable ranges
- Note dependencies on other events
- Track which events modify which variables

**Versioning:**

- When changing conditions/effects, create new events instead of modifying existing
- Use branches to test complex changes
- Document changes in event history

---

**Next Steps:**

Now that you understand conditions and effects, explore these related tutorials:

- **[Event Resolution Tutorial](event-resolution-tutorial.md)**: Learn how to execute events and apply effects during gameplay
- **[Settlement Management Tutorial](settlement-management-tutorial.md)**: Understand settlement variables you can check and modify
- **[Branching Tutorial](branching-tutorial.md)**: Use conditions to create diverging storylines

**Practice Exercise:**

Create a complete event system:

1. **Event 1:** "Training Recruits" - Costs gold, increases guard count
2. **Event 2:** "Bandit Raid" - Condition: defense_rating < 5, Effect: reduces gold and morale
3. **Event 3:** "Successful Defense" - Condition: guard_count > 10, Effect: increases morale
4. Link them with dependencies and test the complete flow

**Advanced Challenge:**

Create a seasonal economy system:

- Spring: Plant crops (spend gold, set crops_planted variable)
- Summer: Crops grow (increase crops_planted over time)
- Autumn: Harvest (convert crops_planted to food_stores and gold)
- Winter: Consume food (decrease food_stores, morale effects if depleted)

Happy automating! ⚙️

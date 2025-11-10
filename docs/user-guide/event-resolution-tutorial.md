# Event & Encounter Resolution Tutorial

## Introduction

Events and encounters represent key moments in your campaign timeline—festivals, battles, negotiations, discoveries, and more. **Resolving** these events is how you record that they've happened and apply their consequences to the world.

This tutorial will teach you:

- **What resolution means** and when to use it
- **How to resolve events and encounters** step-by-step
- **How effects are applied** automatically during resolution
- **How to track consequences** using the audit trail
- **Best practices** for managing campaign progression

By the end, you'll be comfortable resolving events, understanding their effects, and tracking how your campaign world evolves over time.

---

## What is Resolution?

**Resolution** is the process of marking an event or encounter as "completed" and applying its effects to the world.

Think of it like checking off a task on a to-do list—but instead of just marking it done, the system automatically applies consequences based on what happened.

### Events vs. Encounters

| Aspect           | **Events**                                                      | **Encounters**                                          |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| **What**         | Story moments, festivals, political meetings, natural disasters | Combat, exploration challenges, puzzles, investigations |
| **When**         | Scheduled at specific campaign times                            | Scheduled or triggered by dependencies                  |
| **Resolution**   | "Complete Event" button                                         | "Resolve Encounter" button                              |
| **Status Field** | `isCompleted` (true/false)                                      | `isResolved` (true/false)                               |
| **Timestamp**    | `occurredAt` (when completed)                                   | `resolvedAt` (when resolved)                            |
| **Effects**      | Same system—JSON Patch operations applied in phases             | Same system—JSON Patch operations applied in phases     |

**Key Similarity**: Both use the exact same effect system with PRE → ON_RESOLVE → POST phases.

---

## When to Resolve Events/Encounters

**You should resolve an event or encounter when:**

✅ The scheduled time has passed in your campaign
✅ The party has experienced the event/completed the encounter
✅ You want to apply the event's consequences to the world
✅ You're ready to move forward in the story

**You should NOT resolve yet if:**

❌ The event hasn't happened yet in the story
❌ The party prevented the event from occurring (consider creating a branch instead)
❌ You want to test "what if" scenarios (use a branch to experiment safely)

**Important**: Resolution is **permanent**. Once an event/encounter is marked as completed/resolved, it cannot be undone. If you want to experiment with different outcomes, create a branch first.

---

## Step-by-Step: Resolving an Event

Let's walk through resolving the **Swallowtail Festival** event from the demo campaign.

### Step 1: Navigate to the Timeline View

1. Open your campaign (e.g., "Rise of the Runelords")
2. Click the **Timeline** tab at the top
3. You'll see events displayed as cards along a timeline

**Visual Indicators**:

- 🔵 **Blue** = Scheduled (future event)
- 🟢 **Green** = Completed (already resolved)
- 🔴 **Red** = Overdue (past scheduled time but not completed)

### Step 2: Select the Event

Click on the **Swallowtail Festival** event card. This opens the **Entity Inspector** drawer on the right side of the screen.

**What You See**:

```
┌─ Entity Inspector ─────────────────────────┐
│ 🎉 Swallowtail Festival                     │
│                                             │
│ [Overview] [Details] [Links] [Conditions]  │
│ [Effects] [Versions]                        │
│                                             │
│ Status: Pending                             │
│ Type: Story Event                           │
│ Scheduled: Rova 21, 4707 AR at 10:00 AM    │
│ Location: Sandpoint                         │
│                                             │
│ Description:                                │
│ A harvest festival celebrating the          │
│ completion of the new cathedral. The town   │
│ gathers for games, contests, and the        │
│ consecration ceremony.                      │
│                                             │
│ [Complete Event] button                     │
└─────────────────────────────────────────────┘
```

### Step 3: Review Event Details

Before resolving, click through the tabs to understand what will happen:

#### **Details Tab**

Shows custom variables for this event:

```yaml
attendees: 800
festivitiesPlanned: true
mainAttraction: 'consecration ceremony'
specialGuests: ['Mayor Deverin', 'Father Zantus', 'Sheriff Hemlock']
```

#### **Conditions Tab**

Shows preconditions that must be true for the event to trigger:

```javascript
Settlement population > 1000 AND primaryIndustry == "fishing"
```

**What This Means**: The festival only happens if Sandpoint has more than 1,000 residents and relies on fishing. If conditions aren't met, the event won't trigger automatically (but you can still manually complete it).

#### **Effects Tab**

Shows what will happen when you resolve the event:

```
┌─ POST Phase ──────────────────────────────┐
│ Effect: "Boost settlement morale"         │
│ Priority: 10                              │
│                                           │
│ What Changes:                             │
│ • Add field: /variables/festivalMorale    │
│   Value: 85                               │
└───────────────────────────────────────────┘
```

**What This Means**: After the festival completes, Sandpoint will gain a new variable `festivalMorale = 85`, representing the town's elevated spirits.

#### **Links Tab**

Shows dependency relationships:

```
Triggers:
→ Goblin Raid on Sandpoint (scheduled 10 hours later)
```

**What This Means**: Completing this event will make the goblin raid eligible to trigger (it's waiting for the festival to finish).

### Step 4: Click "Complete Event"

When you're ready, click the **"Complete Event"** button at the bottom of the inspector.

This opens the **Resolution Dialog**:

```
┌─ Complete Event: Swallowtail Festival ────┐
│                                           │
│ Current Status: Pending                   │
│                                           │
│ Effects to Execute:                       │
│                                           │
│ ┌─ POST Phase (1 effect) ────────────┐   │
│ │ • Boost settlement morale           │   │
│ │   Priority: 10                      │   │
│ │   Target: /variables/festivalMorale │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ ⚠️ This action is permanent and cannot    │
│    be undone.                             │
│                                           │
│ [Cancel]              [Confirm] ←         │
└───────────────────────────────────────────┘
```

> 📸 **Screenshot needed: Event Resolution Dialog**
>
> Show the resolution confirmation dialog for an event (e.g., "Swallowtail Festival"). Display the event name, current status, list of effects to execute organized by phase (PRE/ON_RESOLVE/POST), warning message about permanence, and Cancel/Confirm buttons. Highlight the effects summary showing what will change.

### Step 5: Confirm Resolution

Review the effect preview, then click **"Confirm"** (or press **Enter**).

**What Happens Behind the Scenes**:

1. ✅ **Validation** - System checks that the event can be completed (not already completed, has valid name, etc.)
2. ✅ **PRE Phase** - Any preparation effects execute (none in this example)
3. ✅ **ON_RESOLVE Phase** - Event is marked as `isCompleted = true` and `occurredAt = [current campaign time]`
4. ✅ **POST Phase** - Settlement gains `festivalMorale = 85` variable
5. ✅ **Audit Entry** - Resolution is recorded in the Versions tab

**Success Notification**:

```
✓ Event completed successfully. Effects executed: 1
```

The dialog closes, the inspector updates to show "Status: Completed ✅", and the timeline card turns green.

### Step 6: Verify Consequences

Click the **Versions** tab in the Entity Inspector to see the resolution history:

```
┌─ Versions Tab ────────────────────────────┐
│                                           │
│ 📅 Rova 21, 4707 AR at 10:00 AM          │
│ [EVENT COMPLETED] (green badge)           │
│                                           │
│ Effects Executed: 1 of 1                  │
│                                           │
│ Changes:                                  │
│ • isCompleted: false → true               │
│                                           │
│ Effect Summary:                           │
│ • PRE: 0 effects                          │
│ • ON_RESOLVE: 0 effects                   │
│ • POST: 1 effect (1 succeeded)            │
│                                           │
│ [Expand for details] ↓                    │
└───────────────────────────────────────────┘
```

Click **"Expand for details"** to see exactly which effect executed and what paths were modified:

```
┌─ Effect Execution Details ────────────────┐
│                                           │
│ Effect: "Boost settlement morale"         │
│ Timing: POST                              │
│ Priority: 10                              │
│ Status: ✅ Succeeded                       │
│                                           │
│ JSON Patch Operations:                    │
│ 1. ADD /variables/festivalMorale = 85     │
│                                           │
│ Affected Paths:                           │
│ • /variables/festivalMorale               │
└───────────────────────────────────────────┘
```

---

## Step-by-Step: Resolving an Encounter

Encounters work almost identically to events, with a few differences. Let's resolve the **Goblin Raid - Initial Assault** encounter.

### Step 1: Find the Encounter

1. Go to the **Timeline** tab
2. Locate the **"Goblin Raid - Initial Assault"** encounter (scheduled Rova 21, 4707 AR at 8:30 PM)
3. Click on it to open the Entity Inspector

### Step 2: Review Encounter Details

#### **Details Tab**

```yaml
difficulty: 2 (out of 5)
goblinCount: 20
civilianCasualties: 0 (will be updated by effects)
defenseRating: 15
tribes: ['Mosswood', 'Birdcruncher', 'Licktoad', 'Thistletop']
```

#### **Links Tab**

Shows this encounter is part of a dependency chain:

```
Prerequisites:
← Swallowtail Festival (must complete first)

Triggers:
→ Goblin Ambush in Town Square (happens after this resolves)

Related:
⇄ Aftermath Investigation (parallel storyline)
```

**What This Means**: You couldn't resolve this encounter until the festival was completed (which we just did). Once you resolve this, it will enable the "Goblin Ambush" encounter to trigger.

#### **Effects Tab**

```
┌─ POST Phase (1 effect) ───────────────────┐
│ Effect: "Apply raid consequences"         │
│ Priority: 10                              │
│                                           │
│ What Changes:                             │
│ • Replace: /variables/civilianCasualties  │
│   New Value: 12                           │
│ • Replace: /variables/goblinCount         │
│   New Value: 8 (12 goblins killed)        │
└───────────────────────────────────────────┘
```

**What This Means**: When you resolve this encounter, Sandpoint will record 12 civilian casualties and the goblin force will be reduced to 8 remaining raiders.

### Step 3: Resolve the Encounter

Click **"Resolve Encounter"** button (same process as events, but different button text).

The **Resolution Dialog** appears:

```
┌─ Resolve Encounter: Goblin Raid ─────────┐
│                                           │
│ Current Status: Scheduled                 │
│ Difficulty: 2 (Medium)                    │
│                                           │
│ Effects to Execute:                       │
│                                           │
│ ┌─ POST Phase (1 effect) ────────────┐   │
│ │ • Apply raid consequences           │   │
│ │   Priority: 10                      │   │
│ │   Targets:                          │   │
│ │     /variables/civilianCasualties   │   │
│ │     /variables/goblinCount          │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ ⚠️ This action is permanent and cannot    │
│    be undone.                             │
│                                           │
│ [Cancel]              [Confirm] ←         │
└───────────────────────────────────────────┘
```

Click **"Confirm"** to proceed.

**Success Notification**:

```
✓ Encounter resolved successfully. Effects executed: 1
```

### Step 4: Check Consequences Across Entities

**Important**: Effects can modify **other entities**, not just the event/encounter itself. Let's see what changed:

1. **Encounter Variables** (updated):
   - `civilianCasualties: 0 → 12`
   - `goblinCount: 20 → 8`

2. **Linked Encounters** (now available):
   - "Goblin Ambush in Town Square" is now eligible to trigger because its prerequisite (this encounter) is resolved

3. **Settlement State** (may be affected):
   - If the effect targeted Sandpoint's population or morale, you'd see those changes in the settlement's details

**To verify**, navigate to:

- **Flow View** → See dependency graph update (resolved encounter shows green checkmark)
- **Map View** → Click Sandpoint settlement → Check if population/morale variables changed
- **Timeline View** → See "Goblin Ambush" encounter now active

---

## Understanding Effects: What Happens During Resolution

Effects are **automated actions** that change the world when events/encounters resolve. They use **JSON Patch operations** to modify entity data.

### The Three Phases of Effect Execution

Effects execute in **three distinct phases** in this exact order:

```
┌─────────────────────────────────────────┐
│ PHASE 1: PRE (Preparation)              │
│ • Rare, used for setup tasks            │
│ • Entity NOT yet marked as completed    │
│ • Example: Lock doors before battle     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ PHASE 2: ON_RESOLVE (Main Logic)        │
│ • Most common phase                     │
│ • Entity marked as completed/resolved   │
│ • Example: Reduce population, add item  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ PHASE 3: POST (Cascading Consequences)  │
│ • Secondary effects and cleanup         │
│ • Entity already completed              │
│ • Example: Trigger follow-up events     │
└─────────────────────────────────────────┘
```

**Why Three Phases?**

This structure allows complex scenarios like:

- **PRE**: Disable merchant shops before a siege
- **ON_RESOLVE**: Mark siege as completed, reduce city population
- **POST**: Trigger "Aftermath Investigation" event, add "besieged" tag to city

### Effect Priority (Execution Order)

Within each phase, effects execute in **priority order** (lowest number first):

```
POST Phase:
├─ Priority 5:  "Update civilian casualties" (executes first)
├─ Priority 10: "Reduce goblin count" (executes second)
└─ Priority 20: "Award XP to party" (executes third)
```

**Why This Matters**: If one effect depends on another's result, use priority to control the sequence. For example, calculate casualties (priority 5) before updating morale based on casualties (priority 10).

### Common Effect Operations

Effects modify data using **JSON Patch** operations. Here are the most common ones:

#### **1. Replace (Change a Value)**

Most common operation. Changes an existing field:

```javascript
{
  op: 'replace',
  path: '/variables/population',
  value: 1450  // Changes population from 1500 to 1450
}
```

**Real-World Use**: Update population after casualties, change morale after events, adjust resource counts.

#### **2. Add (Create New Field or Append to Array)**

Adds a new field or adds an item to an array:

```javascript
{
  op: 'add',
  path: '/variables/festivalMorale',
  value: 85  // Creates new field: festivalMorale = 85
}

{
  op: 'add',
  path: '/tags/-',  // The "-" means "append to array"
  value: 'rebuilt'  // Adds "rebuilt" to tags array
}
```

**Real-World Use**: Track new metrics, add tags for categorization, append to history logs.

#### **3. Remove (Delete Field or Array Element)**

Removes a field or array item:

```javascript
{
  op: 'remove',
  path: '/variables/temporaryBoost'  // Deletes the temporaryBoost field
}

{
  op: 'remove',
  path: '/tags/0'  // Removes first tag from array
}
```

**Real-World Use**: Clean up temporary data, remove expired buffs, delete obsolete tags.

### Protected Fields (Cannot Be Modified)

For safety, certain fields are **protected** and cannot be changed by effects:

❌ `/id` - Entity unique identifier
❌ `/createdAt` - Creation timestamp
❌ `/updatedAt` - Last update timestamp
❌ `/deletedAt` - Soft delete timestamp
❌ `/version` - Audit version number
❌ `/campaignId` - Campaign ownership
❌ `/kingdomId` - Kingdom ownership (for kingdoms)
❌ `/locationId` - Location reference (for entities at locations)

**Why**: These are system-managed fields. Modifying them could break relationships or audit trails.

### Example: Multi-Effect Resolution

Let's look at a complex event with multiple effects in different phases.

**Event**: "Autumn Harvest Festival"

```
┌─ PRE Phase ────────────────────────────────┐
│ Effect: "Prepare market stalls"            │
│ Priority: 5                                │
│ Operation:                                 │
│   { op: 'add',                             │
│     path: '/variables/marketStallsReady',  │
│     value: true }                          │
└────────────────────────────────────────────┘

┌─ ON_RESOLVE Phase ─────────────────────────┐
│ Effect: "Mark event complete"              │
│ (Automatic - system handles this)          │
└────────────────────────────────────────────┘

┌─ POST Phase (2 effects) ───────────────────┐
│ Effect 1: "Increase treasury from sales"   │
│ Priority: 10                               │
│ Operation:                                 │
│   { op: 'replace',                         │
│     path: '/variables/treasury',           │
│     value: 5000 } (was 3000, +2000 gold)   │
│                                            │
│ Effect 2: "Boost morale from celebration"  │
│ Priority: 15                               │
│ Operation:                                 │
│   { op: 'replace',                         │
│     path: '/variables/morale',             │
│     value: 75 } (was 60, +15 morale)       │
└────────────────────────────────────────────┘
```

**Execution Sequence**:

1. **PRE Phase** → `marketStallsReady = true` (priority 5)
2. **ON_RESOLVE Phase** → `isCompleted = true`, `occurredAt = [current time]` (automatic)
3. **POST Phase** → `treasury = 5000` (priority 10), then `morale = 75` (priority 15)

**Result**: Four changes applied in deterministic order.

---

## Tracking Consequences: Using the Audit Trail

Every resolution creates a permanent record in the **Versions** tab. This is your campaign's history log.

### What the Audit Trail Shows

**Resolution Entry Format**:

```
┌─ Versions Tab ────────────────────────────┐
│                                           │
│ 📅 Rova 21, 4707 AR at 8:30 PM           │
│ [ENCOUNTER RESOLVED] ← Green badge        │
│                                           │
│ Effects Executed: 3 of 3 ✅               │
│                                           │
│ Changes:                                  │
│ • isResolved: false → true                │
│ • resolvedAt: null → 4707-09-21T20:30:00Z │
│                                           │
│ Effect Summary:                           │
│ • PRE: 1 effect (1 succeeded)             │
│ • ON_RESOLVE: 0 effects                   │
│ • POST: 2 effects (2 succeeded)           │
│                                           │
│ [Expand for details] ↓                    │
└───────────────────────────────────────────┘
```

### Expanding Effect Details

Click **"Expand for details"** to see the complete execution log:

```
┌─ Effect Execution Log ────────────────────┐
│                                           │
│ PRE Phase:                                │
│ ┌───────────────────────────────────────┐ │
│ │ Effect: "Prepare market stalls"       │ │
│ │ Status: ✅ Succeeded                   │ │
│ │ Timestamp: 4707-09-21T20:30:00.123Z   │ │
│ │                                       │ │
│ │ Operations:                           │ │
│ │ • ADD /variables/marketStallsReady    │ │
│ │   Value: true                         │ │
│ │                                       │ │
│ │ Affected Paths:                       │ │
│ │ • /variables/marketStallsReady        │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ POST Phase:                               │
│ ┌───────────────────────────────────────┐ │
│ │ Effect: "Increase treasury"           │ │
│ │ Status: ✅ Succeeded                   │ │
│ │ Priority: 10                          │ │
│ │                                       │ │
│ │ Operations:                           │ │
│ │ • REPLACE /variables/treasury         │ │
│ │   Old: 3000                           │ │
│ │   New: 5000                           │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ Effect: "Boost morale"                │ │
│ │ Status: ✅ Succeeded                   │ │
│ │ Priority: 15                          │ │
│ │                                       │ │
│ │ Operations:                           │ │
│ │ • REPLACE /variables/morale           │ │
│ │   Old: 60                             │ │
│ │   New: 75                             │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

### Understanding Effect Status

Each effect can have one of two statuses:

✅ **Succeeded** - Effect applied successfully, world state changed
❌ **Failed** - Effect encountered an error, no change applied

**What Happens if an Effect Fails?**

- The error is logged in the audit trail with a specific error message
- Subsequent effects still execute (failures don't block the rest)
- The summary shows partial success: "2 of 3 effects executed (1 failed)"
- You can review the error message and manually fix the issue if needed

**Common Failure Reasons**:

- Trying to modify a protected field (`/id`, `/createdAt`, etc.)
- Invalid JSON Patch syntax (typo in operation or path)
- Path doesn't exist (trying to replace a field that doesn't exist—use `add` instead)
- Value type mismatch (trying to set a number field to a string)

---

## Common Resolution Scenarios

Here are typical scenarios you'll encounter while resolving events and encounters.

### Scenario 1: Simple Event with One Effect

**Event**: "Weekly Market Day"

**Effect**: Add 500 gold to settlement treasury

**Resolution**:

1. Click event in Timeline
2. Review effect (adds `/variables/treasury` +500)
3. Click "Complete Event"
4. Confirm → Treasury increases

**Audit Trail**: Shows single POST effect succeeded, treasury value change

---

### Scenario 2: Encounter Chain with Dependencies

**Encounters**:

1. "Goblin Raid - Initial Assault"
2. "Goblin Ambush in Town Square" (prerequisite: #1 must resolve)
3. "Aftermath Investigation" (prerequisite: #2 must resolve)

**Resolution Order**:

1. Resolve #1 → Applies casualties, reduces goblin count → Unlocks #2
2. Resolve #2 → Applies ambush damage, awards XP → Unlocks #3
3. Resolve #3 → Discovers clues, updates quest state → Chain complete

**Flow View**: Shows green checkmarks on #1 and #2, blue pending on #3

**Why Dependencies Matter**: The story flows logically—you can't investigate the aftermath before the ambush happens.

---

### Scenario 3: Event with Multiple Cascading Effects

**Event**: "Cathedral Consecration Ceremony"

**Effects**:

1. **PRE** (Priority 5): Prepare ceremony → Add `ceremonyActive = true`
2. **POST** (Priority 10): Increase clergy → Replace `/variables/clergy` from 3 to 5
3. **POST** (Priority 15): Boost faith → Replace `/variables/faithLevel` from 2 to 3
4. **POST** (Priority 20): Award reputation → Add `/variables/templeReputation = 80`

**Resolution**:

- All 4 effects execute in sequence
- Audit trail shows "4 of 4 effects executed"
- Each effect's changes visible in expanded view

**Result**: Temple is now more influential with more clergy and higher faith level.

---

### Scenario 4: Resolving with Warnings (Non-Blocking)

**Event**: "Mysterious Disappearance"

**Validation Warning**: "⚠️ Missing occurredAt timestamp"

**What This Means**: The event doesn't have a specific occurrence time set, but you can still resolve it. The system will use the current campaign time.

**Resolution**:

1. Click "Complete Event"
2. Dialog shows warning (yellow, not red)
3. You can click "Confirm" anyway (warning doesn't block)
4. Event completes with `occurredAt` set to current time

**When You See Warnings**: These are informational, not errors. You can proceed safely, but the warning might indicate missing data you should fill in later.

---

### Scenario 5: Blocked Resolution (Validation Errors)

**Event**: "Autumn Harvest Festival" (already completed)

**Validation Error**: "❌ Event has already been completed"

**What This Means**: This event was resolved previously. You cannot re-resolve it.

**Resolution Dialog**:

```
┌─ Complete Event: Autumn Harvest Festival ┐
│                                           │
│ ❌ Validation Error:                      │
│    Event has already been completed       │
│                                           │
│ This event was completed on:              │
│ Rova 21, 4707 AR at 10:00 AM             │
│                                           │
│ [Close] ← Only option available           │
└───────────────────────────────────────────┘
```

**What to Do**: Close the dialog. If you want to "undo" the resolution, you would need to:

- Create a new branch from before the event
- Resolve differently in the new timeline
- Keep the original timeline as-is (resolution is permanent)

**Other Common Validation Errors**:

- "❌ Invalid or empty event name" (event data is corrupted)
- "❌ Missing required location reference" (event not associated with a location)

---

## Advanced: Cross-Entity Effects

Effects can target **other entities**, not just the event/encounter being resolved. This creates dynamic world interactions.

### Example: Event Affects Settlement

**Event**: "Plague Outbreak"
**Target**: Sandpoint settlement

**Effect**:

```javascript
{
  name: "Reduce population from plague deaths",
  timing: "POST",
  priority: 10,
  targetEntityType: "Settlement",  // ← Targets a different entity
  targetEntityId: "sandpoint-id",
  payload: [
    { op: 'replace', path: '/variables/population', value: 1200 }  // Was 1500
  ]
}
```

**What Happens**:

1. You resolve the "Plague Outbreak" event
2. The effect targets **Sandpoint settlement** (not the event itself)
3. Sandpoint's population drops from 1500 to 1200
4. Audit trail shows the effect modified the settlement
5. If you open Sandpoint's inspector → Versions tab → You see an entry: "Modified by event: Plague Outbreak"

### Example: Encounter Affects Multiple Structures

**Encounter**: "Siege of Sandpoint"

**Effects**:

1. Damage city walls → Modify "City Walls" structure's defense rating
2. Destroy smithy → Mark "Gilded Hammer" structure as inactive
3. Reduce population → Modify Sandpoint settlement's population

**Result**: Three entities affected by one encounter resolution.

### How to See Cross-Entity Effects

**Before Resolution**:

- Effects Tab shows **Target Entity** field for each effect
- Example: "Target: Sandpoint (Settlement)"

**After Resolution**:

- Event's Versions tab shows: "Effect modified: Sandpoint settlement"
- Settlement's Versions tab shows: "Modified by: Plague Outbreak event"
- Bi-directional audit trail for tracking

---

## Best Practices for Resolution

### ✅ DO

**1. Review Before Resolving**

- Always read the Effects tab to understand what will change
- Check the Links tab to see what will be unlocked
- Verify conditions are met (if applicable)

**2. Resolve in Chronological Order**

- Follow the timeline from past to present
- Respect dependency chains (prerequisites first)
- This keeps your campaign story coherent

**3. Use Branches for "What-If" Scenarios**

- Want to test what happens if the festival is prevented? Create a branch.
- Experiment in the branch, keep the main timeline clean
- See the [Branching Tutorial](branching-tutorial.md) for details

**4. Check the Audit Trail After Resolution**

- Verify all effects succeeded (look for "X of X effects executed")
- If failures occurred, investigate the error messages
- Expand details to see what actually changed

**5. Document Custom Variables**

- If effects create new variables (like `festivalMorale`), add descriptions in the entity's Details tab
- Future you will thank present you for the context

**6. Resolve Events/Encounters Together (for Narrative Cohesion)**

- If multiple events happen "at the same time" in the story, resolve them in a batch
- Example: Resolve "Festival Opens" → "Goblin Raid" → "Rescue Civilians" in one session

### ❌ DON'T

**1. Don't Resolve Events Out of Order (Unless Intentional)**

- Resolving "Aftermath Investigation" before "Goblin Raid" breaks narrative logic
- Dependency links prevent this automatically, but manual resolution allows it

**2. Don't Ignore Validation Errors**

- Red errors block resolution for a reason (data integrity, prevents corruption)
- Fix the underlying issue before proceeding

**3. Don't Resolve in Main Timeline if Unsure**

- **Always create a branch first** if you're experimenting or uncertain
- Main timeline should be your "canon" story

**4. Don't Forget to Check Cross-Entity Effects**

- An event might modify multiple entities (settlements, structures, other events)
- Review all affected entities' Versions tabs to see the full impact

**5. Don't Re-Use Event Names**

- If you have two "Goblin Raid" events, distinguishing them in the audit trail is hard
- Use unique, descriptive names: "Goblin Raid - Initial Assault", "Goblin Raid - Second Wave"

**6. Don't Resolve Events That Didn't Happen**

- If the party prevented the goblin raid, don't mark it as completed
- Instead: Create a branch showing the "prevented" timeline, or create a new event "Goblin Raid Prevented" with different effects

---

## Troubleshooting

### Problem: "Complete Event" Button is Grayed Out

**Possible Causes**:

- Event is already completed (check Status badge)
- You don't have permission to resolve events (check your role)
- Event data is invalid or corrupted

**Solution**:

- Check the Status badge in the inspector
- If already completed, view the Versions tab to see when it was resolved
- If data is invalid, contact your campaign administrator

---

### Problem: Effect Failed to Execute

**What You See**:

```
Effects Executed: 2 of 3 (1 failed) ⚠️
```

**Possible Causes**:

1. **Protected field**: Effect tried to modify `/id` or `/createdAt`
2. **Invalid path**: Effect tried to `replace` a field that doesn't exist (should use `add`)
3. **Type mismatch**: Effect tried to set a number field to a string

**Solution**:

1. Expand the effect execution details
2. Read the error message (e.g., "Cannot modify protected field: /id")
3. If the effect was important, manually apply the change:
   - Navigate to the target entity
   - Edit the field manually in the Details tab
4. Report the broken effect to your administrator (they can fix the effect definition)

**Example Error Message**:

```
❌ Effect: "Update casualties"
   Error: Path '/casualties' does not exist. Use 'add' operation instead of 'replace'.
```

**Manual Fix**: Add a `casualties` variable to the encounter with the intended value.

---

### Problem: Resolution Completed But Nothing Changed

**Possible Causes**:

1. No effects defined for this event/encounter
2. Effects targeted a different entity (cross-entity effect)
3. Effects executed but made no visible changes (e.g., set a field to its current value)

**Solution**:

1. Check the Effects tab—if it's empty, no effects were configured
2. Look at the audit trail's "Affected Paths" list
3. If cross-entity, navigate to the target entity and check its Versions tab
4. If intentional (e.g., testing), you can ignore this

---

### Problem: Can't Find Resolved Event in Timeline

**What Happened**: Resolved events might scroll off-screen if your timeline is long.

**Solution**:

1. Use the **Timeline Filters**:
   - Filter by status: "Completed"
   - Filter by date range: Include the resolution date
2. Use the **Search Bar**:
   - Type the event name (e.g., "Swallowtail Festival")
   - Click the result to jump to it
3. Check the **Flow View**:
   - Resolved events/encounters have green checkmarks
   - Easier to see dependency chains

---

### Problem: Accidentally Resolved the Wrong Event

**What to Do**:

**Option 1: Create a Branch from Before the Mistake**

1. Note the exact time you resolved the wrong event (check Versions tab)
2. Create a new branch from just before that time
3. Work in the new branch going forward
4. Keep the mistaken timeline as a "rejected" branch

**Option 2: Manually Undo Changes**

1. Review the audit trail to see what effects executed
2. Manually reverse each change:
   - If population was reduced, increase it back
   - If a variable was added, remove it
3. Leave the event marked as completed (you can't un-resolve it)
4. Add a note in the event's description: "Resolved by mistake, changes reversed manually"

**Option 3: Database Rollback (Advanced)**

- Contact your campaign administrator
- They can restore a database backup from before the resolution
- Only use for catastrophic mistakes

---

## Integration with Other Features

### Resolution + Timeline View

- **Color Coding**: Completed events = green, pending = blue, overdue = red
- **Click to Inspect**: Single-click opens inspector with resolution button
- **Multi-Select**: Ctrl+Click to select multiple events/encounters (useful for reviewing, but can only resolve one at a time)

### Resolution + Flow View

- **Dependency Visualization**: Shows which events/encounters unlock after resolution
- **Status Indicators**: Green checkmarks on resolved nodes, blue on pending
- **Click Nodes**: Opens inspector, same resolution workflow

### Resolution + Map View

- **Location Context**: See events/encounters at their geographic locations
- **Visual Effects**: Resolved events might change location appearance (if effects modify location variables)
- **Settlement Updates**: Settlement resolution effects update map data immediately

### Resolution + Cross-View Selection

- **Synchronized Selection**: Selecting an event in Timeline also selects it in Flow and Map
- **Consistent Inspector**: Same resolution UI regardless of which view you're in

### Resolution + Branching

- **Branch-Specific Resolutions**: Resolving an event in one branch doesn't affect other branches
- **Testing Outcomes**: Create a branch, resolve events with different variables, compare results
- **See [Branching Tutorial](branching-tutorial.md)** for details

### Resolution + Audit Trail

- **Complete History**: Every resolution logged in Versions tab
- **Effect Details**: See exactly what changed and when
- **Cross-Entity Tracking**: See which entities were affected by resolution

---

## Practice Exercise

**Scenario**: The **"Goblin Raid on Sandpoint"** event is scheduled for Rova 21, 4707 AR at 8:00 PM. You need to resolve it and track the consequences.

### Step 1: Navigate and Inspect

1. Open the "Rise of the Runelords" campaign
2. Go to the Timeline tab
3. Find "Goblin Raid on Sandpoint"
4. Click to open the Entity Inspector

**Questions to Answer**:

- What is the event's status? (Pending/Completed)
- Are there any preconditions? (Check Conditions tab)
- What effects will execute? (Check Effects tab)
- What entities will be affected? (Look for target entities in effects)

### Step 2: Review Dependencies

1. Click the **Links** tab
2. Identify prerequisites (what must resolve first?)
3. Identify triggers (what will this unlock?)

**Questions**:

- Can you resolve this event now, or do prerequisites need to resolve first?
- What event/encounter will become available after this resolves?

### Step 3: Resolve the Event

1. Click **"Complete Event"**
2. Review the Resolution Dialog
   - How many effects will execute?
   - What phases are they in?
   - What paths will be modified?
3. Click **"Confirm"**

**What to Watch For**:

- Success notification: "Event completed successfully. Effects executed: X"
- Inspector status changes to "Completed ✅"
- Timeline card turns green

### Step 4: Verify Consequences

1. Click the **Versions** tab in the inspector
2. Find the resolution entry (top of the list)
3. Expand the effect details

**Questions**:

- How many effects executed successfully?
- What paths were modified? (e.g., `/variables/population`)
- Were there any failures? (If so, what was the error message?)

### Step 5: Check Cross-Entity Impact

1. Navigate to **Sandpoint** settlement (if effects targeted it)
2. Open its inspector → Versions tab
3. Look for an entry: "Modified by event: Goblin Raid on Sandpoint"

**Questions**:

- What fields were changed in the settlement?
- Can you see the before/after values?

### Step 6: Review Unlocked Content

1. Go back to the Timeline view
2. Look for the next encounter in the chain (e.g., "Goblin Ambush in Town Square")
3. Check if it's now active (should be blue/scheduled, not grayed out)

**Questions**:

- Is the dependent encounter now available to resolve?
- How does the Flow view show this dependency relationship?

---

## Next Steps

You now understand how to resolve events and encounters, apply effects, and track consequences. Here's what to explore next:

### Related Tutorials

- **[Conditions and Effects Tutorial](conditions-and-effects-tutorial.md)** - Deep dive into JSONLogic conditions and JSON Patch effects
- **[Branching Tutorial](branching-tutorial.md)** - Create alternate timelines to experiment with different resolutions
- **[Settlement Management Tutorial](settlement-management-tutorial.md)** - Understand how effects modify settlement and structure state
- **[Map Editing Tutorial](map-editing-tutorial.md)** - Create events tied to geographic locations

### Advanced Topics

- **Creating Custom Effects** - Build your own effect definitions with JSON Patch
- **Effect Debugging** - Troubleshoot failed effects using the audit trail
- **Complex Dependency Chains** - Design multi-stage story arcs with prerequisites and triggers
- **Cross-Branch Resolution Comparison** - Resolve the same event differently in multiple branches and compare outcomes

### Best Practices

- **Resolve regularly**: Don't let your timeline fall too far behind. Resolve events as you play sessions.
- **Use branches liberally**: Experiment with "what if" scenarios before committing to the main timeline.
- **Document custom variables**: When effects create new variables, add descriptions so you remember what they mean.
- **Review audit trails**: Periodically check the Versions tab to ensure effects are working as expected.

---

## Quick Reference

### Resolution Workflow

1. **Navigate** → Timeline/Flow/Map view
2. **Select** → Click event/encounter
3. **Review** → Check Details, Conditions, Effects tabs
4. **Resolve** → Click "Complete Event" or "Resolve Encounter"
5. **Confirm** → Review dialog, click "Confirm"
6. **Verify** → Check Versions tab for audit trail

### Effect Phases

- **PRE**: Preparation (rare, executes first)
- **ON_RESOLVE**: Main logic (most common, entity marked complete here)
- **POST**: Cascading consequences (cleanup, secondary effects)

### Effect Operations

- **replace**: Change existing field value
- **add**: Create new field or append to array
- **remove**: Delete field or array element

### Status Indicators

- 🔵 **Blue** = Scheduled/Pending
- 🟢 **Green** = Completed/Resolved
- 🔴 **Red** = Overdue (past scheduled time, not resolved)

### Validation

- ❌ **Red Errors** = Block resolution (must fix first)
- ⚠️ **Yellow Warnings** = Informational (can proceed)

### Keyboard Shortcuts

- **Enter** = Confirm resolution (in dialog)
- **Escape** = Cancel resolution (close dialog)
- **Ctrl+Click** = Multi-select events (in Timeline/Flow)

---

## Glossary

**Resolution**: The process of marking an event/encounter as completed and applying its effects.

**Effect**: An automated action that modifies entity data during resolution.

**Phase**: One of three execution stages (PRE, ON_RESOLVE, POST) for effects.

**Priority**: A number determining execution order within a phase (lower = earlier).

**JSON Patch**: A standard format for describing changes to JSON data (used by effects).

**Audit Trail**: The historical record of all resolutions and changes (Versions tab).

**Cross-Entity Effect**: An effect that modifies a different entity than the one being resolved.

**Validation Error**: A blocking error that prevents resolution (shown in red).

**Validation Warning**: A non-blocking informational message (shown in yellow).

**Dependency Link**: A relationship between events/encounters (prerequisite, triggers, related).

---

**Happy Resolving!** You're now equipped to manage your campaign's timeline, apply effects, and track the evolving state of your world. If you have questions, consult the [Getting Started Guide](getting-started.md) or explore other tutorials.

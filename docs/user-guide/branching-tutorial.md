# Branching Tutorial

This tutorial will teach you how to create **alternate timeline branches** in your campaign, allowing you to explore "what-if" scenarios and experiment with different narrative paths without affecting your main timeline.

## Table of Contents

1. [What Are Branches?](#what-are-branches)
2. [Why Use Branches?](#why-use-branches)
3. [Understanding Branch Concepts](#understanding-branch-concepts)
4. [Creating Your First Branch](#creating-your-first-branch)
5. [Switching Between Timelines](#switching-between-timelines)
6. [Exploring Branch Examples](#exploring-branch-examples)
7. [Merging Branches](#merging-branches)
8. [Branch Management](#branch-management)
9. [Best Practices](#best-practices)
10. [Common Scenarios](#common-scenarios)

## What Are Branches?

**Branches** are alternate timelines in your campaign. They let you explore different versions of your story based on "what if" questions:

- "What if the heroes **failed** to stop the goblin raid?"
- "What if the party chose to **negotiate** instead of fight?"
- "What if the festival happened **without** any interruptions?"

Each branch maintains its own history while preserving the original timeline. Changes in a branch don't affect your main campaign unless you explicitly merge them back.

**Real-World Analogy:**

Think of branches like save files in a video game. You can save your progress, then create a new save to try a different approach. If things go well, you can continue from that save. If not, you still have your original save intact.

## Why Use Branches?

### Experimentation Without Risk

Branches let you test ideas without commitment:

- **Try different narrative paths** - See how the story unfolds if players make different choices
- **Test game balance** - Experiment with settlement changes or event outcomes
- **Plan ahead** - Explore consequences of upcoming decisions before committing
- **Learn the system** - Practice using features without affecting your main campaign

### Collaborative Storytelling

Branches enable creative collaboration:

- **Player-driven scenarios** - Let players explore "what if" questions between sessions
- **GM preparation** - Plan multiple story branches based on possible player choices
- **Sandbox exploration** - Experiment with world-building ideas
- **Session planning** - Prepare different scenarios for upcoming sessions

### Historical Tracking

Branches preserve alternative histories:

- **Document failed attempts** - Keep a record of battles that went wrong
- **Preserve rejected paths** - Save story directions you didn't pursue
- **Compare outcomes** - See how different choices led to different results
- **Campaign archives** - Maintain a complete record of all story possibilities

## Understanding Branch Concepts

### Parent and Child Branches

Branches form a **family tree** structure:

```
Main Timeline (parent)
├─ Peaceful Festival (child)
├─ Shadow Conspiracy (child)
└─ Goblin Resurgence (child)
   └─ Goblin Alliance (grandchild)
```

**Key Properties:**

- **Main Timeline**: The original campaign (has no parent)
- **Child Branch**: Created from a parent at a specific point in time
- **Inheritance**: Child branches inherit all history from their parent up to the divergence point
- **Isolation**: Changes in a child branch don't affect the parent or sibling branches

> 📸 **Diagram needed: Branch Hierarchy Tree**
>
> Create a visual diagram showing the branch hierarchy structure. Display the Main Timeline at the top with three child branches below it (Peaceful Festival, Shadow Conspiracy, Goblin Resurgence). Show Goblin Resurgence with a grandchild branch (Goblin Alliance). Use connecting lines to show parent-child relationships. Include timestamps for divergence points. Use different colors/icons to distinguish active vs inactive branches.

### Divergence Points

When you create a branch, you specify a **divergence point** - the exact moment in world time when the timeline splits.

**Example:**

```
Main Timeline:
├─ Sept 21, 4707 at 19:00 - Festival preparations complete
├─ Sept 21, 4707 at 20:00 - Town guards patrol (← DIVERGENCE POINT)
├─ Sept 21, 4707 at 20:30 - Goblin raid begins (main timeline)
└─ ...

Branch "Peaceful Festival":
├─ Sept 21, 4707 at 20:00 - Guards discover goblin scouts (← DIVERGENCE POINT)
├─ Sept 21, 4707 at 20:15 - Sheriff mobilizes militia
├─ Sept 21, 4707 at 21:00 - Goblins dispersed, festival continues peacefully
└─ ...
```

**Before** the divergence point, both timelines are identical. **After** the divergence point, they differ.

### Version Inheritance

Each entity (settlement, character, event, etc.) can have different versions in different branches.

**How It Works:**

1. **Branch Creation**: When you create a branch, it inherits all entity versions from the parent up to the divergence point
2. **Independent Changes**: Changes in the branch create new versions only in that branch
3. **Parent Fallback**: If a branch doesn't have its own version of an entity, it uses the parent's version

**Example:**

```
Sandpoint Settlement:

Main Timeline:
├─ Version 1 (Sept 1): Population 1,000, Morale 75
└─ Version 2 (Sept 25): Population 980, Morale 60 (after raid)

Branch "Peaceful Festival" (diverged Sept 21):
├─ (inherits Version 1 from parent)
└─ Version 2 (Sept 22): Population 1,000, Morale 85 (festival success!)
```

In the main timeline, the raid reduced population and morale. In the branch, the peaceful festival **increased** morale while preserving population.

## Creating Your First Branch

Let's create a branch to explore an alternate scenario in the demo campaign.

### Step 1: Navigate to Branch Management

1. Open the **"Rise of the Runelords"** campaign
2. Look for the **Branch Selector** in the top navigation (usually shows "Main Timeline")
3. Click the branch selector to open the branch management interface
4. Click **"Create New Branch"**

### Step 2: Configure the Branch

You'll need to provide:

**Branch Name** (required)

A short, descriptive name for the alternate timeline.

**Examples:**

- "Peaceful Festival"
- "Goblin Alliance"
- "Sandpoint Destroyed"

**Description** (optional but recommended)

A detailed explanation of what makes this timeline different.

**Example:**

```
An alternate timeline where the town guards discovered the goblin
tribes gathering and dispersed them before the raid. The Swallowtail
Festival concluded peacefully, and Sandpoint never experienced the
attack. Without captured goblins to interrogate, the location of
Thistletop fortress remains unknown.
```

**Parent Branch** (auto-filled)

The timeline you're currently viewing. Usually the main timeline, but you can create branches from other branches too!

**Divergence Point** (required)

The world time when the timeline splits. This is usually set to the current world time, but you can specify a different time.

**Example:**

- Date: September 21, 4707 (Absalom Reckoning)
- Time: 20:00 (8:00 PM)

### Step 3: Fork the Timeline

Click **"Create Branch"** to fork the timeline. This creates:

1. A new child branch with the specified name
2. Copies of all entity versions at the divergence point
3. A complete, independent timeline ready for changes

**What Gets Copied:**

- World state (regions, locations, settlements, structures)
- Characters and parties
- Events and encounters (at their current state)
- All entity variables and properties

**What Stays Shared:**

- Campaign configuration (world time system, calendar)
- Branch history (you can still view parent timeline)
- User permissions and settings

### Step 4: Make Changes in the Branch

Now you're viewing the new branch! The interface looks the same, but you're in an alternate timeline.

**Try making changes:**

1. **Navigate to Sandpoint** on the map
2. **Open the Entity Inspector** to view settlement details
3. **Edit the morale variable** - Increase it from 75 to 85 (festival success!)
4. **Edit the population** - Keep at 1,000 (no casualties from raid)
5. **Save changes**

These changes only affect the branch. Your main timeline remains unchanged.

## Switching Between Timelines

### Using the Branch Selector

The **Branch Selector** (top navigation) shows your current branch and lets you switch between timelines.

**To switch branches:**

1. Click the **Branch Selector** (shows current branch name)
2. View the list of available branches
3. Click a branch name to switch to that timeline
4. The entire interface updates to show that branch's state

**Visual Indicators:**

- **Main Timeline** - Usually shown in bold or with a special icon
- **Current Branch** - Highlighted in the branch selector
- **Child Branches** - Indented under their parent in hierarchical view

### Viewing Branch Information

When viewing a branch, you can see:

- **Branch Name and Description** - What this timeline represents
- **Divergence Point** - When it split from the parent
- **Parent Branch** - Where it came from
- **Number of Changes** - How many entities have been modified

### Comparing Branches

The branch interface may include comparison tools:

**Side-by-Side Comparison:**

View the same entity in two different timelines to see how they differ.

**Example:**

```
Sandpoint (Main Timeline)        |  Sandpoint (Peaceful Festival)
Population: 980                   |  Population: 1,000
Morale: 60                        |  Morale: 85
Defense: 42                       |  Defense: 45
```

**Change History:**

See what changed in a branch compared to its parent:

- **Modified Entities** - Settlements, characters, etc. that differ
- **New Events** - Events added only in this branch
- **Different Outcomes** - Encounters that resolved differently

## Exploring Branch Examples

The demo campaign includes three example branches. Let's explore them!

### Example 1: Peaceful Festival

**Scenario:** Guards discovered goblin scouts and dispersed them before the raid.

**To explore:**

1. Switch to the **"Peaceful Festival"** branch
2. Navigate to **Sandpoint** on the map
3. Check the **Timeline View** around September 21-22, 4707

**What's Different:**

- **No Goblin Raid Event** - The raid never happened
- **Higher Morale** - Festival concluded successfully (morale +10)
- **Full Population** - No casualties (population stays at 1,000)
- **Unknown Fortress** - Without captured goblins, Thistletop location unknown
- **Different Quest Hooks** - New events trigger based on the peaceful outcome

**Key Insight:**

This branch shows a **preventive scenario** - where proactive action prevented a disaster. The town is safer but also less motivated (no shared trauma to unite against a common threat).

### Example 2: Shadow Conspiracy

**Scenario:** Spy network remained undetected in Castle Korvosa.

**To explore:**

1. Switch to the **"Shadow Conspiracy"** branch
2. Navigate to **Korvosa** on the map
3. Check events around November 15, 4707

**What's Different:**

- **Failed Investigation** - Guards didn't uncover the spy network
- **Assassination Plot Proceeds** - Threat to Queen Ileosa remains
- **Political Instability** - Conspiracy theories spread, trust erodes
- **Compromised Guards** - Some guards are infiltrators
- **Different Political Landscape** - Events unfold based on unchecked conspiracy

**Key Insight:**

This branch shows a **failure scenario** - where the party failed a critical investigation. The consequences ripple through the political structure, creating a darker, more paranoid timeline.

### Example 3: Goblin Resurgence

**Scenario:** The assault on Thistletop fortress ended in disaster.

**To explore:**

1. Switch to the **"Goblin Resurgence"** branch
2. Navigate to **Thistletop** on the map (if visible)
3. Check encounters around September 25, 4707

**What's Different:**

- **Failed Raid** - Adventurers were defeated at Thistletop
- **Heavy Casualties** - Party lost members, morale devastated
- **Emboldened Goblins** - Chief Ripnugget united tribes under his banner
- **Ongoing Raids** - Sustained goblin campaign against settlements
- **Defensive Posture** - Sandpoint and nearby settlements fortify, lose expansion

**Key Insight:**

This branch shows a **defeat scenario** - where a major encounter went badly. The power dynamic shifts, with goblins gaining the upper hand and settlements forced into a defensive war.

## Merging Branches

Sometimes you want to bring changes from a branch back into the main timeline (or another branch). This is called **merging**.

### When to Merge

**Good reasons to merge:**

- **Liked the outcome** - The alternate scenario worked out well
- **Want to preserve changes** - Specific edits you made in the branch
- **Experiment succeeded** - Tested something and want to keep it
- **Collaborative work** - Another GM worked in a branch, ready to integrate

**When NOT to merge:**

- **Pure experimentation** - Just exploring, not committing
- **Failed scenarios** - Things went badly, keeping for reference only
- **Contradictory changes** - Branch conflicts too much with main timeline
- **Still exploring** - Not ready to finalize the changes

### How Merging Works

Merging brings changes from a **source branch** into a **target branch** (usually main timeline).

**Merge Process:**

1. **Select branches** - Choose source (what to merge) and target (where to merge into)
2. **Review changes** - See what will be merged
3. **Resolve conflicts** - Decide how to handle entities that changed in both branches
4. **Apply merge** - Integrate the changes
5. **Verify results** - Check that merge worked as expected

### Three-Way Merge Strategy

The system uses a **three-way merge** algorithm:

```
Common Ancestor (divergence point)
        /              \
  Main Timeline    Branch Timeline
        \              /
         Merged Result
```

**Merge Logic:**

- **Only in branch** → Add to main timeline
- **Only in main** → Keep in main timeline
- **Changed in branch only** → Use branch version
- **Changed in main only** → Keep main version
- **Changed in both** → **CONFLICT** - requires manual resolution

### Conflict Resolution

When the same entity changes in both branches, you must choose which version to keep.

**Example Conflict:**

```
Sandpoint Settlement:

Common Ancestor (Sept 21):
- Population: 1,000
- Morale: 75

Main Timeline (Sept 25):
- Population: 980 (raid casualties)
- Morale: 60 (raid trauma)

Branch "Peaceful Festival" (Sept 22):
- Population: 1,000 (no casualties)
- Morale: 85 (festival success)

CONFLICT: Both timelines modified morale
```

**Resolution Options:**

1. **Keep Main** - Use main timeline value (morale 60)
2. **Use Branch** - Use branch value (morale 85)
3. **Manual Value** - Choose a custom value (e.g., morale 70 - a compromise)
4. **Skip Entity** - Don't merge this entity, keep main version

**Best Practice:**

Review conflicts carefully. Consider the narrative implications of each choice. Sometimes a compromise value makes the most sense!

### Merge Strategies

**Strategy 1: Selective Merge**

Merge only specific entities, not the entire branch.

**When to use:**

- You made several changes but only want some of them
- Experimenting with different aspects, want to cherry-pick

**How:**

1. In merge interface, **deselect** entities you don't want to merge
2. Review selected entities
3. Complete merge with only those entities

**Strategy 2: Full Branch Merge**

Merge everything from the branch.

**When to use:**

- Branch represents a complete alternate timeline you want to adopt
- All changes in branch are desirable

**How:**

1. Review all changes
2. Resolve any conflicts
3. Merge entire branch at once

**Strategy 3: Hierarchical Merge**

Merge a child branch back into its parent, preserving the branch history.

**When to use:**

- Multiple GMs working in parallel branches
- Want to preserve branch for historical reference

**How:**

1. Merge branch into parent
2. **Don't delete** the branch after merge
3. Branch remains as historical record of the alternate path

## Branch Management

### Viewing Branch Hierarchy

The **Branch Hierarchy** shows the family tree of all branches.

**Example Hierarchy:**

```
📍 Main Timeline (current)
├─ 🌿 Peaceful Festival
│  └─ 🌿 Extended Peace (child of Peaceful Festival)
├─ 🌿 Shadow Conspiracy
│  └─ 🌿 Queen Assassinated (child of Shadow Conspiracy)
└─ 🌿 Goblin Resurgence
   ├─ 🌿 Goblin Alliance
   └─ 🌿 Fortress Reclaimed
```

**Icons may indicate:**

- 📍 Current branch
- 🌿 Available branch
- 🔒 Locked branch (permissions)
- 🗑️ Deleted/archived branch

### Editing Branch Details

You can edit branch name and description after creation:

1. Open **Branch Management**
2. Select the branch to edit
3. Click **"Edit Branch"**
4. Update name or description
5. Save changes

**Note:** You cannot change the parent branch or divergence point after creation. These are fixed when the branch is created.

### Deleting Branches

To delete a branch:

1. Open **Branch Management**
2. Select the branch to delete
3. Click **"Delete Branch"**
4. Confirm deletion

**⚠️ Important:**

- Deleting a branch **removes all its unique versions**
- Child branches of the deleted branch may become orphaned
- This action may be irreversible (check with admin)
- Consider archiving instead of deleting if you want to preserve history

### Branch Permissions

Depending on your role, you may have different branch permissions:

**Admin:**

- Create, edit, delete any branch
- Merge any branch
- View all branches

**Game Master:**

- Create and edit branches for campaigns they manage
- Merge branches in their campaigns
- View all branches in their campaigns

**Player:**

- View branches (read-only)
- May be restricted from seeing certain branches
- Cannot create or merge branches

## Best Practices

### Planning Branches

**Before creating a branch:**

1. **Define the scenario clearly** - What's the core difference?
2. **Choose the divergence point carefully** - When does the timeline split?
3. **Write a detailed description** - Future you will thank you!
4. **Consider the scope** - Small change or major divergence?

**Naming Conventions:**

- **Descriptive** - Name should hint at what's different ("Peaceful Festival" not "Branch 1")
- **Concise** - Keep it short (2-4 words ideal)
- **Consistent** - Use similar naming patterns for related branches

### Working in Branches

**Do:**

- ✅ Make meaningful changes that explore the scenario
- ✅ Document why you made changes (use entity notes/descriptions)
- ✅ Test conditions and effects in branches before using in main timeline
- ✅ Use branches for session prep to plan different outcomes
- ✅ Keep branches focused on specific scenarios

**Don't:**

- ❌ Make random changes without purpose
- ❌ Create too many branches (gets confusing)
- ❌ Forget which branch you're in when making changes
- ❌ Mix multiple unrelated experiments in one branch
- ❌ Leave branches without descriptions

### Merge Hygiene

**Before merging:**

1. **Review all changes** - Know what you're merging
2. **Test in the branch** - Make sure everything works
3. **Communicate** - If collaborating, tell others about the merge
4. **Backup** - Consider exporting main timeline first (if available)

**After merging:**

1. **Verify results** - Check that merge worked correctly
2. **Test affected systems** - Make sure conditions, effects still work
3. **Document the merge** - Note what was merged in campaign notes
4. **Decide on branch** - Keep for history or delete?

### Branch Organization

**Keep it manageable:**

- **Limit active branches** - 3-5 active branches per campaign is plenty
- **Archive old branches** - Delete or mark as archived when done
- **Use child branches** - Create sub-branches for related scenarios
- **Regular cleanup** - Periodically review and remove unused branches

**Hierarchical Organization:**

```
Main Timeline
├─ Combat Outcomes (parent for battle variants)
│  ├─ Victory at Thistletop
│  ├─ Defeat at Thistletop
│  └─ Negotiated Peace
└─ Political Paths (parent for political variants)
   ├─ Queen Assassinated
   └─ Conspiracy Exposed
```

Group related scenarios under parent branches for better organization.

## Common Scenarios

### Scenario 1: Testing Event Balance

**Problem:** You created a complex event with conditions and effects, but you're not sure if it's balanced.

**Solution:**

1. Create a branch called "Event Test - [Event Name]"
2. Set divergence point just before the event triggers
3. In the branch, manually trigger the event
4. Observe the effects on settlement variables, character states, etc.
5. Adjust the event conditions/effects in the branch
6. Test again until balanced
7. Apply the same changes to main timeline (or merge)

**Why use a branch?**

You can test destructive effects (population loss, structure damage) without risking your main campaign.

### Scenario 2: Player Choice Preparation

**Problem:** Next session, players will make a major choice. You want to prepare for both outcomes.

**Solution:**

1. Set world time to the current session endpoint
2. Create branch "Choice A - [Brief Description]"
3. Create branch "Choice B - [Brief Description]"
4. In each branch, set up the consequences of that choice
5. During the session, when players choose, switch to the appropriate branch
6. Merge that branch into main timeline after session

**Why use branches?**

Both paths are prepared and ready. You just switch to the one that matches the players' choice.

### Scenario 3: Collaborative Campaign

**Problem:** Multiple GMs are working on the same campaign. You want to avoid stepping on each other's toes.

**Solution:**

1. Each GM creates their own branch: "GM [Name] - [Area/Focus]"
2. GMs work independently in their branches
3. Periodically, GMs merge their branches into main timeline
4. Resolve conflicts through discussion
5. Keep branches for historical record

**Why use branches?**

Parallel work without conflicts. Each GM's changes are isolated until ready to integrate.

### Scenario 4: Long-Term Campaign Arcs

**Problem:** You're planning a multi-session story arc with branching paths based on cumulative player decisions.

**Solution:**

1. Create main arc branch at the story arc start
2. As the arc progresses, create child branches for major decision points
3. Players' choices determine which branch becomes "canon"
4. Merge the chosen path into main timeline at arc conclusion
5. Archive other branches as "roads not taken"

**Why use branches?**

Preserves alternate paths as campaign history. Players can see what might have been.

### Scenario 5: Sandbox Exploration

**Problem:** You're learning the system and want to experiment with features without affecting your real campaign.

**Solution:**

1. Create a branch called "Sandbox" or "Experimentation"
2. Try new features, create complex events, test effects
3. Break things, learn from mistakes
4. Delete the branch when done (or keep for reference)
5. Apply lessons learned to main timeline with confidence

**Why use a branch?**

Risk-free learning environment. Your main campaign remains pristine while you master the system.

## Summary

### Key Takeaways

✅ **Branches are alternate timelines** - Explore "what-if" scenarios without affecting main campaign

✅ **Divergence points matter** - Branches inherit history up to the split, then diverge

✅ **Isolation protects your work** - Changes in branches don't affect parent or siblings

✅ **Merging integrates changes** - Bring successful experiments back to main timeline

✅ **Conflict resolution is manual** - You decide how to handle entities changed in both timelines

✅ **Organization is key** - Use clear names, descriptions, and hierarchical structure

### Quick Reference

| Action             | Steps                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Create Branch**  | Branch Selector → Create New Branch → Set name, description, divergence point → Create    |
| **Switch Branch**  | Branch Selector → Click branch name                                                       |
| **Merge Branch**   | Branch Management → Select source and target → Review changes → Resolve conflicts → Merge |
| **Delete Branch**  | Branch Management → Select branch → Delete → Confirm                                      |
| **View Hierarchy** | Branch Management → Hierarchy View                                                        |

### Next Steps

Now that you understand branching, try:

1. **Create a test branch** in the demo campaign
2. **Make some changes** to explore branch isolation
3. **Switch back to main timeline** to see that it's unchanged
4. **Try merging** the branch (optional)
5. **Explore the example branches** to see different scenarios

For more advanced topics, see:

- **[Settlement Management Tutorial](settlement-management-tutorial.md)** - Track settlement state across branches
- **[Event Resolution Tutorial](event-resolution-tutorial.md)** - How events interact with branches
- **[Conditions and Effects Tutorial](conditions-and-effects-tutorial.md)** - Create branch-specific conditions

**Technical Details:**

For developers or curious users who want to understand how branching works under the hood, see:

- **[Branching System Documentation](../features/branching-system.md)** - Technical architecture and implementation

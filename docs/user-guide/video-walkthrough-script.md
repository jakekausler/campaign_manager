# Video Walkthrough Script

**Duration**: 15-20 minutes
**Audience**: Game Masters and Players interested in campaign management tools
**Prerequisites**: Application running with demo seed data loaded

---

## Script Overview

This video demonstrates the Campaign Management Tool through a guided tour of the "Rise of the Runelords" demo campaign. The walkthrough showcases all major features in a logical progression that mirrors a typical game master's workflow.

**Feature Coverage:**

1. **Interface Overview** (2 min) - Navigation, tabs, inspector, world time
2. **Map View** (3 min) - Geographic visualization, locations, settlements, regions
3. **Timeline View** (3 min) - Chronological event tracking, filtering, world time
4. **Flow View** (2 min) - Dependency graph visualization
5. **Settlement Management** (2 min) - Settlement state, structures, levels, variables
6. **Conditions & Effects** (3 min) - JSONLogic conditions, JSON Patch effects
7. **Event Resolution** (2 min) - Resolving events, applying effects, audit trail
8. **Branching** (2 min) - Creating alternate timelines, branch management
9. **Cross-View Selection** (1 min) - Synchronized entity selection across views
10. **Wrap-up** (1 min) - Key takeaways, next steps

**Total**: ~18-20 minutes

---

## Script

### [00:00 - 00:30] Introduction (30 sec)

**[SCREEN: Application login page]**

**PRESENTER:**

> "Welcome! Today I'm going to show you a powerful campaign management tool designed for tabletop RPGs. Whether you're managing a sprawling epic or a tight episodic campaign, this tool helps you track locations, events, settlements, and complex storylines—all in one place."

**[ACTION: Type demo credentials]**

- Username: `demo@campaign.local`
- Password: `demo123`

**[ACTION: Click "Log In"]**

**PRESENTER:**

> "Let's dive right in. I'm logging in with our demo account to explore the 'Rise of the Runelords' campaign—a pre-built example showcasing all the features."

---

### [00:30 - 02:30] Interface Overview (2 min)

**[SCREEN: Dashboard loads, showing World/Campaign selector]**

**[ACTION: Click on "Golarion" world]**

**PRESENTER:**

> "The tool is organized hierarchically. At the top level, you have **Worlds**—the entire setting or universe. Here's 'Golarion', the world from Pathfinder. Within a world, you have **Campaigns**—specific adventures or storylines."

**[ACTION: Click on "Rise of the Runelords" campaign]**

**[SCREEN: Main campaign interface appears with three tabs: Map, Timeline, Flow]**

**PRESENTER:**

> "Once you select a campaign, you see three main views: **Map**, **Timeline**, and **Flow**. Each view shows your campaign from a different perspective."

**[ACTION: Point to navigation tabs at top]**

**PRESENTER:**

> "The **Map** view shows geographic locations. The **Timeline** shows events chronologically. And the **Flow** view visualizes dependencies between events and encounters."

**[ACTION: Point to right sidebar]**

**PRESENTER:**

> "On the right, there's an **Inspector** panel. Click on any entity—a region, location, settlement, event—and the inspector shows all its details. You can edit properties, manage relationships, and more."

**[ACTION: Point to top-right corner]**

**PRESENTER:**

> "And up here is the **World Time** indicator. This shows the current in-game date and time. You can advance time, which automatically triggers scheduled events and updates settlement states."

**[ACTION: Hover over world time to show current date: "Rova 23, 4707 AR (September 23, 4707)"]**

**PRESENTER:**

> "Right now, we're in late September, 4707 AR—just after the Swallowtail Festival. Let's explore what happened."

---

### [02:30 - 05:30] Map View (3 min)

**[SCREEN: Map tab active, showing Varisia region with Sandpoint visible]**

**PRESENTER:**

> "The Map view is your geographic canvas. You can see **Regions** like Varisia here, shaded in purple. Regions represent large areas—kingdoms, provinces, wilderness zones."

**[ACTION: Zoom out to show full Varisia region]**

**PRESENTER:**

> "Within regions, you have **Locations**—point markers for landmarks, dungeons, or points of interest."

**[ACTION: Zoom in on Sandpoint area, click on "Thistletop" location]**

**[SCREEN: Inspector opens showing Thistletop details]**

**PRESENTER:**

> "Here's **Thistletop**, a goblin fortress. The inspector shows its type—Ruin—and its description. This is where several encounters will take place later in the campaign."

**[ACTION: Close inspector, click on Sandpoint settlement]**

**[SCREEN: Inspector opens showing Sandpoint settlement]**

**PRESENTER:**

> "**Settlements** are special. They represent towns and cities with populations, economies, and structures. Sandpoint is a small town with about 1,200 residents."

**[ACTION: Scroll down in inspector to show settlement variables]**

**PRESENTER:**

> "Settlements have **typed variables** that track dynamic state. Sandpoint has five variables: **economy**, **defense**, **morale**, **resources**, and **reputation**. Right now, morale is high—85—because the Swallowtail Festival just happened."

**[ACTION: Scroll down to "Structures" section, expand it]**

**PRESENTER:**

> "Within Sandpoint, there are **Structures**—individual buildings like the Rusty Dragon Inn, the Cathedral, the Town Hall. Each structure can have its own variables and level."

**[ACTION: Click on "Rusty Dragon Inn" in the structures list]**

**[SCREEN: Inspector switches to show Rusty Dragon Inn details]**

**PRESENTER:**

> "The Rusty Dragon Inn has three variables: **guests**, **morale**, and **quality**. The inn is Level 2, meaning it's a well-established business with good service."

**[ACTION: Close inspector]**

**PRESENTER:**

> "You can **draw new regions** using the polygon tool, **add locations** with the pin tool, and **create settlements** from scratch. All the drawing tools are in the map toolbar."

**[ACTION: Briefly highlight drawing tools in toolbar (don't actually draw)]**

**PRESENTER:**

> "For now, let's see what's been happening in this campaign. Let's switch to the **Timeline** view."

---

### [05:30 - 08:30] Timeline View (3 min)

**[ACTION: Click "Timeline" tab]**

**[SCREEN: Timeline view appears showing events in chronological order]**

**PRESENTER:**

> "The Timeline view shows **Events** and **Encounters** chronologically. Events are story beats—festivals, meetings, discoveries. Encounters are battles or challenges your players face."

**[ACTION: Scroll to show the event list, pointing out different types]**

**PRESENTER:**

> "You can filter by type, location, or resolution status. Let's look at the **Swallowtail Festival** event."

**[ACTION: Click on "Swallowtail Festival Begins" event]**

**[SCREEN: Inspector opens showing event details]**

**PRESENTER:**

> "This event started on Rova 21 at 10:00 AM—September 21st in the campaign calendar. Events have **conditions** and **effects**."

**[ACTION: Scroll to "Conditions" section in inspector]**

**PRESENTER:**

> "**Conditions** determine _when_ an event can be resolved. This event's condition checks if we're on or after the scheduled date and if Sandpoint's morale is at least 50. Both are true, so this event could be resolved."

**[ACTION: Scroll to "Effects" section]**

**PRESENTER:**

> "**Effects** define _what happens_ when you resolve the event. This event has one effect: it increases Sandpoint's morale by 15 points. Effects use **JSON Patch** operations to modify entity state."

**[ACTION: Expand effect to show JSON Patch operation]**

**PRESENTER:**

> "Here's the JSON Patch: it replaces the `/state/variables/morale` field with a new value—the old morale plus 15. When we resolve this event, Sandpoint's morale will increase."

**[ACTION: Scroll down to see "Status: RESOLVED" indicator]**

**PRESENTER:**

> "This event has already been resolved. You can see the resolution timestamp and who resolved it."

**[ACTION: Close inspector, scroll down timeline to "Goblin Raid on Sandpoint" encounter]**

**[SCREEN: Inspector opens showing Goblin Raid encounter]**

**PRESENTER:**

> "Encounters work the same way. Here's the **Goblin Raid on Sandpoint**—a combat encounter that happened right after the festival. It's marked as **UNRESOLVED**, meaning the players haven't finished it yet."

**[ACTION: Scroll to "Difficulty" field showing "2"]**

**PRESENTER:**

> "Encounters have a **difficulty** rating—this one is level 2, appropriate for early-game players. They also have **dependencies**, which we'll see in the Flow view."

**[ACTION: Click "Timeline" filter dropdown]**

**PRESENTER:**

> "You can filter the timeline by resolution status, type, or even specific locations. This makes it easy to see what's coming up or what's unresolved."

**[ACTION: Select "Show Unresolved Only" filter]**

**[SCREEN: Timeline filters to show only unresolved events/encounters]**

**PRESENTER:**

> "Now we're seeing only unresolved items—things the players still need to handle. Let's switch to the **Flow** view to see how these encounters are connected."

**[ACTION: Clear filter]**

---

### [08:30 - 10:30] Flow View (2 min)

**[ACTION: Click "Flow" tab]**

**[SCREEN: Flow view appears showing nodes and edges representing events/encounters]**

**PRESENTER:**

> "The Flow view visualizes **dependencies** between events and encounters. Each box is an event or encounter, and the arrows show how they're connected."

**[ACTION: Point to "Goblin Raid" node]**

**PRESENTER:**

> "Here's the **Goblin Raid** encounter. You can see it has arrows pointing to other encounters—meaning it **triggers** or is a **prerequisite** for other events."

**[ACTION: Click on "Goblin Raid" node]**

**[SCREEN: Inspector opens showing Goblin Raid details with dependency links visible]**

**PRESENTER:**

> "The inspector shows three dependency links. The Goblin Raid is a **prerequisite** for 'Investigate Goblin Tracks'—you have to finish the raid before investigating. It also **triggers** 'Local Heroes' Meeting'—completing the raid will automatically make that event available."

**[ACTION: Click on "Local Heroes' Meeting" node in the flow graph]**

**[SCREEN: Flow graph highlights the connection, inspector updates]**

**PRESENTER:**

> "Dependencies help you manage complex storylines. If your players skip an encounter, the Flow view shows which downstream events won't trigger."

**[ACTION: Zoom out to show entire flow graph]**

**PRESENTER:**

> "You can arrange nodes manually or use the **auto-layout** button to organize them automatically. The Flow view is great for planning branching narratives or seeing the big picture."

**[ACTION: Click "Auto Layout" button]**

**[SCREEN: Nodes rearrange into a hierarchical flow]**

**PRESENTER:**

> "There—much cleaner. Now let's dive deeper into **Settlements** and how they evolve over time."

---

### [10:30 - 12:30] Settlement Management (2 min)

**[ACTION: Click "Map" tab to return to map view]**

**[ACTION: Click on Sandpoint settlement]**

**[SCREEN: Inspector opens showing Sandpoint details]**

**PRESENTER:**

> "Settlements are dynamic entities with **levels** and **typed variables**. Sandpoint is currently Level 2, meaning it's a small town with basic infrastructure."

**[ACTION: Scroll to "Level" field showing "2"]**

**PRESENTER:**

> "As the campaign progresses, settlements can **level up**. When Sandpoint reaches Level 3, it might become a regional trade hub with new structures and resources."

**[ACTION: Scroll to "State" section showing variables: economy=70, defense=60, morale=85, resources=65, reputation=60]**

**PRESENTER:**

> "Settlement state is tracked through **typed variables**. Each variable has a schema defining its type, default value, and description. Sandpoint has five variables tracking economy, defense, morale, resources, and reputation."

**[ACTION: Scroll down to "Structures" section]**

**PRESENTER:**

> "Within Sandpoint, there are **Structures**. Let's look at the Cathedral."

**[ACTION: Click on "Cathedral of Desna" in structures list]**

**[SCREEN: Inspector switches to Cathedral details]**

**PRESENTER:**

> "The Cathedral is a Temple-type structure at Level 2. It has two variables: **blessing** (currently 80) and **capacity** (150 worshippers). Structures can also level up independently of the settlement."

**[ACTION: Scroll to show structure level and variables]**

**PRESENTER:**

> "Events and encounters can modify settlement and structure variables through **effects**. For example, the Swallowtail Festival increased Sandpoint's morale by 15 points."

**[ACTION: Click "Audit Trail" button in inspector]**

**[SCREEN: Audit trail modal opens showing history of changes]**

**PRESENTER:**

> "The **Audit Trail** tracks every change to an entity. You can see when variables changed, who changed them, and what effects caused the changes. This is invaluable for debugging or reviewing campaign history."

**[ACTION: Close audit trail modal and inspector]**

**PRESENTER:**

> "Now let's look at **Conditions and Effects** in more detail."

---

### [12:30 - 15:30] Conditions & Effects (3 min)

**[ACTION: Click "Timeline" tab]**

**[ACTION: Click on "Autumn Harvest Festival" event]**

**[SCREEN: Inspector opens showing event details]**

**PRESENTER:**

> "Let's examine the **Autumn Harvest Festival** event. This is a scheduled event that occurs in mid-autumn if certain conditions are met."

**[ACTION: Scroll to "Conditions" section]**

**PRESENTER:**

> "Conditions use **JSONLogic**—a simple, declarative way to define complex logic. This condition has three parts connected with `and`."

**[ACTION: Expand condition to show JSON]**

**[SCREEN: JSON shown in inspector]**

```json
{
  "and": [
    {
      ">=": [{ "var": "settlement.state.variables.economy" }, 50]
    },
    {
      ">=": [{ "var": "settlement.state.variables.morale" }, 60]
    },
    {
      ">=": [{ "var": "worldTime" }, "4707-10-15T00:00:00Z"]
    }
  ]
}
```

**PRESENTER:**

> "This reads as: 'The festival can happen IF economy is at least 50 AND morale is at least 60 AND the date is October 15th or later.' All three conditions must be true."

**[ACTION: Scroll to "Effects" section]**

**PRESENTER:**

> "When you resolve this event, its **effects** execute. Effects use **JSON Patch** to modify entity state."

**[ACTION: Expand first effect to show JSON Patch operation]**

**[SCREEN: JSON Patch shown in inspector]**

```json
{
  "op": "replace",
  "path": "/state/variables/morale",
  "value": 95
}
```

**PRESENTER:**

> "This effect replaces Sandpoint's morale with 95—representing the joy and celebration of a successful harvest. Effects can also `add` fields, `remove` fields, or perform custom operations."

**[ACTION: Scroll down to show second effect]**

**[SCREEN: Second effect shown: increase economy by 10]**

**PRESENTER:**

> "This event has two effects. The second one increases the economy variable by 10, representing trade and commerce from the festival. Effects execute in order based on their **priority** value."

**[ACTION: Point to priority field showing "100" for first effect, "200" for second]**

**PRESENTER:**

> "Effects with lower priority values execute first. Here, morale updates (priority 100) before economy (priority 200). This matters when effects depend on each other."

**[ACTION: Close inspector]**

**PRESENTER:**

> "Conditions and effects are the heart of dynamic campaigns. You can create complex event chains, faction systems, resource management—all through conditions and effects."

**[ACTION: Click on "Local Heroes' Meeting" event]**

**[SCREEN: Inspector opens showing event with complex condition]**

**PRESENTER:**

> "Here's a more complex condition. This event requires the **Goblin Raid encounter to be resolved** AND Sandpoint's reputation to be at least 50. Notice the `var` reference to another entity's status."

**[ACTION: Highlight condition JSON showing reference to encounter status]**

**PRESENTER:**

> "JSONLogic can reference other entities, check arrays, perform calculations—it's very powerful. Now let's see how to **resolve** an event."

---

### [15:30 - 17:30] Event Resolution (2 min)

**[ACTION: Click on "Goblin Raid on Sandpoint" encounter (UNRESOLVED)]**

**[SCREEN: Inspector opens showing unresolved encounter]**

**PRESENTER:**

> "This encounter is **UNRESOLVED**. Once your players complete the encounter, you'll resolve it here to apply its effects."

**[ACTION: Scroll down to see "Resolve" button]**

**PRESENTER:**

> "First, review the effects. This encounter has one effect: it reduces Sandpoint's defense by 10 points, representing damage to town fortifications during the raid."

**[ACTION: Expand effect to show JSON Patch]**

**[SCREEN: JSON Patch shown: decrement defense by 10]**

**PRESENTER:**

> "The effect uses a `replace` operation with a calculation: current defense minus 10. When we resolve, this effect will execute immediately."

**[ACTION: Click "Resolve" button]**

**[SCREEN: Confirmation dialog appears: "Are you sure you want to resolve this encounter? Effects will be applied immediately."]**

**PRESENTER:**

> "Resolving is a **permanent action**. You can't undo it, so the tool asks for confirmation."

**[ACTION: Click "Confirm"]**

**[SCREEN: Resolution in progress spinner, then success message: "Encounter resolved successfully. 1 effect applied."]**

**PRESENTER:**

> "Done! The encounter is now marked RESOLVED. Let's check Sandpoint's defense value."

**[ACTION: Click on Sandpoint settlement on map]**

**[SCREEN: Inspector opens showing Sandpoint with defense now at 50 (was 60)]**

**PRESENTER:**

> "Defense dropped from 60 to 50—the effect worked! You can see the change in the audit trail."

**[ACTION: Click "Audit Trail" button]**

**[SCREEN: Audit trail opens showing recent "REPLACE /state/variables/defense" entry with before/after values]**

**PRESENTER:**

> "The audit trail records every change. Here's the defense modification from resolving the Goblin Raid. It shows the old value, new value, who made the change, and when."

**[ACTION: Close audit trail and inspector]**

**PRESENTER:**

> "Resolution is how you advance the campaign. As events resolve, settlement states change, new events trigger, and the world evolves. Now let's explore **branching**."

---

### [17:30 - 19:30] Branching (2 min)

**[ACTION: Click "Branches" dropdown in top navigation bar]**

**[SCREEN: Dropdown shows "Main Timeline" (active) and three alternate branches: "Peaceful Festival", "Shadow Conspiracy", "Goblin Resurgence"]**

**PRESENTER:**

> "Branches let you create **alternate timelines**. What if the goblin raid was prevented? What if the players made different choices? Branches let you explore those scenarios without affecting the main timeline."

**[ACTION: Click on "Peaceful Festival" branch]**

**[SCREEN: Interface reloads showing "Peaceful Festival" branch active, visual indicator in top bar changes]**

**PRESENTER:**

> "We're now in the **Peaceful Festival** branch. This branch diverged from the main timeline on September 21st, just before the goblin raid."

**[ACTION: Click "Timeline" tab]**

**[SCREEN: Timeline shows different events—no "Goblin Raid" encounter, but "Prevention Patrol Success" event instead]**

**PRESENTER:**

> "In this timeline, the guards prevented the goblin raid. Notice the 'Goblin Raid' encounter is missing—it never happened here. Instead, there's a 'Prevention Patrol Success' event."

**[ACTION: Click on Sandpoint settlement]**

**[SCREEN: Inspector shows Sandpoint with different state: defense=65 (higher), morale=90 (higher)]**

**PRESENTER:**

> "Sandpoint's state is different too. Defense is higher (65 instead of 50) because the raid didn't damage fortifications. Morale is also higher (90 instead of 85) because the town wasn't attacked."

**[ACTION: Switch back to Main Timeline via branch dropdown]**

**[SCREEN: Interface reloads showing Main Timeline, Sandpoint state returns to normal]**

**PRESENTER:**

> "Switching back to the main timeline, Sandpoint's state returns to what we saw before. Each branch maintains its own version of all entities."

**[ACTION: Open "Create New Branch" dialog from branch dropdown]**

**[SCREEN: Dialog appears with fields: Branch Name, Divergence Date, Parent Branch]**

**PRESENTER:**

> "Creating a branch is simple. Give it a name, choose when it diverges from the parent timeline, and start making changes. Branches are great for 'what-if' scenarios, testing encounters, or parallel storylines."

**[ACTION: Close dialog without creating branch]**

**PRESENTER:**

> "You can also **merge** branches back together, resolving conflicts between timelines. This is useful for collaborative campaigns where different game masters manage different branches."

**[ACTION: Click back to "Map" tab]**

**PRESENTER:**

> "Now let's see one more cool feature: **cross-view selection**."

---

### [19:30 - 20:30] Cross-View Selection & Wrap-up (1 min)

**[ACTION: Click on Sandpoint settlement on map]**

**[SCREEN: Inspector opens showing Sandpoint, map highlights Sandpoint]**

**PRESENTER:**

> "When you select an entity in one view, it's automatically highlighted in all views. Let's switch to the Timeline."

**[ACTION: Click "Timeline" tab while Sandpoint is selected]**

**[SCREEN: Timeline loads with events filtered/highlighted for Sandpoint location]**

**PRESENTER:**

> "The Timeline automatically filters to show events related to Sandpoint. This **cross-view selection** makes it easy to explore relationships between geography, time, and dependencies."

**[ACTION: Click "Flow" tab]**

**[SCREEN: Flow view loads with Sandpoint-related nodes highlighted]**

**PRESENTER:**

> "Same in the Flow view—encounters at Sandpoint are highlighted. This synchronized selection works across all three views, making navigation seamless."

**[ACTION: Close inspector]**

**PRESENTER:**

> "And that's the Campaign Management Tool! Let's quickly recap what we covered."

**[SCREEN: Fade to summary slide or return to dashboard]**

**PRESENTER:**

> "We explored:
>
> - **Map View** for geographic visualization
> - **Timeline View** for chronological event tracking
> - **Flow View** for dependency management
> - **Settlements and Structures** with dynamic state tracking
> - **Conditions and Effects** using JSONLogic and JSON Patch
> - **Event Resolution** to advance your campaign
> - **Branching** for alternate timelines
> - **Cross-View Selection** for seamless navigation
>
> This tool helps you manage complex campaigns, track evolving world state, and create dynamic, reactive storylines. Whether you're running a published adventure or your own homebrew campaign, this tool scales with your needs."

**[ACTION: Show contact/documentation links]**

**PRESENTER:**

> "Check out the documentation at [link] for detailed tutorials on each feature. Thanks for watching, and happy adventuring!"

**[SCREEN: Fade to end card with links]**

---

## Production Notes

### Visual Assets Needed

- **Intro/Outro Cards**: Title card, end card with documentation links
- **Annotations**: On-screen labels for first-time viewers (e.g., "Inspector Panel", "World Time", "Drawing Tools")
- **Zoom Highlights**: Highlight UI elements (buttons, tabs, fields) when mentioned
- **Screenshot Placeholders**: Consider adding static screenshots in documentation if live recording isn't feasible

### Pacing Tips

- **Talk While Clicking**: Minimize silent time during transitions
- **Pause for Effect**: Let viewers absorb complex JSON snippets (2-3 sec pause)
- **Rehearse Transitions**: Practice switching between Map/Timeline/Flow smoothly
- **Time Checkpoints**: Aim to hit each section's timestamp (adjust talking speed as needed)

### Technical Considerations

- **Screen Resolution**: Record at 1920x1080 minimum for readability
- **Zoom Level**: Ensure text/JSON is readable at target resolution
- **Cursor Highlighting**: Use cursor highlighting tool so viewers can follow clicks
- **Audio Quality**: Use good microphone; avoid background noise
- **Edit Points**: Leave 2-3 seconds of buffer at each major section for editing

### Alternative Delivery Formats

- **Segmented Videos**: Split into 3-5 minute clips for each major feature
- **Interactive Demo**: Convert script to interactive walkthrough in-app
- **Live Webinar**: Use script as outline for live Q&A session

### Localization Notes

- **Terminology**: "Tabletop RPG" may need explanation for non-gaming audiences
- **Date Formats**: "Rova 23, 4707 AR" uses Pathfinder calendar—explain if audience is unfamiliar
- **Technical Jargon**: JSONLogic/JSON Patch might need brief definition cards

---

## Testing Checklist

Before recording, verify:

- [ ] Demo account credentials work (`demo@campaign.local` / `demo123`)
- [ ] Seed data is loaded (Golarion world, Rise of the Runelords campaign)
- [ ] All entities referenced in script exist (Sandpoint, Thistletop, Goblin Raid, etc.)
- [ ] Branches are created ("Peaceful Festival", "Shadow Conspiracy", "Goblin Resurgence")
- [ ] All three views (Map, Timeline, Flow) load without errors
- [ ] Inspector panel shows all referenced fields (variables, conditions, effects)
- [ ] Resolution workflow works (can resolve Goblin Raid encounter)
- [ ] Audit trail captures resolution changes
- [ ] Cross-view selection highlights work across all three views
- [ ] Auto-layout in Flow view organizes nodes correctly

---

## Revision History

- **Version 1.0** (Initial Draft): 18-20 minute script covering all major features with timed segments and presenter notes.

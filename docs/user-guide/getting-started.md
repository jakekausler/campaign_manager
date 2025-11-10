# Getting Started Guide

Welcome to the Campaign Management Tool! This guide will help you get up and running with your first campaign.

## Table of Contents

1. [What is the Campaign Management Tool?](#what-is-the-campaign-management-tool)
2. [First Login](#first-login)
3. [Understanding the Interface](#understanding-the-interface)
4. [Exploring the Demo Campaign](#exploring-the-demo-campaign)
5. [Creating Your First Campaign](#creating-your-first-campaign)
6. [Basic Navigation](#basic-navigation)
7. [Next Steps](#next-steps)

## What is the Campaign Management Tool?

The Campaign Management Tool is a comprehensive platform for managing tabletop RPG campaigns. It helps Game Masters (GMs) organize:

- **World Geography**: Create and manage maps with regions, locations, settlements, and structures
- **Events & Encounters**: Plan and track story events, combat encounters, and their outcomes
- **Timeline Management**: Track when events occur in your world's time
- **Branching Narratives**: Explore "what-if" scenarios with alternate timeline branches
- **Settlement Management**: Track settlement populations, resources, and structures
- **Conditions & Effects**: Create dynamic rules that respond to world state changes

Whether you're running a one-shot adventure or a multi-year campaign, this tool helps you keep everything organized and connected.

## First Login

### Demo Credentials

The system comes pre-configured with demo accounts and sample data:

- **Admin Account**:
  - Email: `admin@campaign.local`
  - Password: (set during setup)
  - Full access to create, edit, and delete content

- **Regular User Account**:
  - Email: `user@campaign.local`
  - Password: (set during setup)
  - Read-only access to view campaigns

### Logging In

1. Navigate to the application URL (typically `http://localhost:9263` for local development)
2. Enter your email address and password
3. Click "Login"

> 📸 **Screenshot needed: Login Page**
>
> Show the login screen with email/password fields and login button. Highlight the clean, modern interface with the application logo at top.

You'll be taken to the main dashboard where you can see all available campaigns.

> 📸 **Screenshot needed: Campaign Dashboard**
>
> Show the campaigns list view displaying available campaigns (including "Rise of the Runelords" demo campaign). Highlight campaign cards showing campaign name, world, and quick stats.

## Understanding the Interface

The Campaign Management Tool uses a modern, tabbed interface to help you navigate different aspects of your campaign:

### Main Navigation

- **Campaigns List**: Your home screen showing all campaigns you have access to
- **Campaign Dashboard**: Overview of a specific campaign with quick access to key features

### Campaign Views (Tabs)

When viewing a campaign, you'll see several tabs at the top:

- **Map View**: Geographic visualization showing regions, locations, settlements, and structures
- **Timeline View**: Chronological visualization of events and encounters
- **Flow View**: Dependency graph showing how events and encounters relate to each other
- **Lists**: Detailed tables for browsing entities (settlements, events, encounters, etc.)

> 📸 **Screenshot needed: Main Interface Overview**
>
> Show the campaign view with all three main tabs (Map, Timeline, Flow) visible at the top. Include the Entity Inspector panel on the right side and World Time display in the top-right corner. Annotate key UI elements with labels.

### Entity Inspector

When you select any entity (settlement, event, encounter, etc.), the **Entity Inspector** opens on the right side:

- View detailed information about the selected entity
- Edit properties and relationships
- See related entities and dependencies
- Access entity-specific actions

### World Time Display

In the top-right corner, you'll see the current world time for your campaign. This tracks the in-game date and time according to your world's calendar.

## Exploring the Demo Campaign

The application comes with a demo campaign called **"Rise of the Runelords"** set in the fantasy world of Golarion. This demo showcases all major features:

### Demo Campaign Overview

- **World**: Golarion with custom "Absalom Reckoning" calendar
- **Regions**: 5 distinct regions (Varisia, Cheliax, Worldwound, Osirion, Mwangi Expanse)
- **Settlements**: Multiple settlements including Sandpoint, Magnimar, and Korvosa
- **Events**: 16 story events with complex conditions and effects
- **Encounters**: 12 combat/exploration encounters with difficulty ratings
- **Branches**: 3 alternate timeline scenarios

### Exploring the Map View

1. From the dashboard, select the "Rise of the Runelords" campaign
2. The Map View opens by default, showing the world geography
3. **Navigation**:
   - **Pan**: Click and drag to move around the map
   - **Zoom**: Use mouse wheel or pinch gestures to zoom in/out
   - **Select**: Click on any colored region or marker to select it

4. **What you'll see**:
   - **Regions**: Large colored polygons (Varisia, Cheliax, etc.)
   - **Locations**: Pin markers for specific points of interest
   - **Settlements**: City markers (Sandpoint, Magnimar, Korvosa)
   - **Structures**: Building markers within settlements

5. **Try it**: Click on the Varisia region (northwest area) to see its details in the Entity Inspector

> 📸 **Screenshot needed: Map View with Demo Data**
>
> Show the Map View displaying the Varisia region (colored polygon) with Sandpoint settlement marker and surrounding locations (Thistletop, etc.). Include the Entity Inspector on the right showing details of a selected entity (e.g., Sandpoint). Annotate map controls, drawing tools, and zoom level.

### Exploring the Timeline View

1. Click the **Timeline** tab at the top
2. You'll see a horizontal timeline with events and encounters plotted chronologically
3. **Navigation**:
   - **Pan**: Click and drag horizontally to move through time
   - **Zoom**: Use controls or mouse wheel to zoom time scale
   - **Select**: Click on any event/encounter card to view details

4. **What you'll see**:
   - **Events**: Story events like "Swallowtail Festival" and "Ancient Ruins Discovery"
   - **Encounters**: Combat/exploration encounters organized by location
   - **Dependencies**: Visual lines showing how events relate to each other

5. **Try it**: Click on "Swallowtail Festival" (earliest event, September 4707) to see its details

> 📸 **Screenshot needed: Timeline View with Events**
>
> Show the Timeline View displaying events and encounters chronologically from September-December 4707. Highlight several event cards (Swallowtail Festival, Goblin Raid, etc.) with timestamps. Show the Entity Inspector displaying details of the selected "Swallowtail Festival" event including its conditions and effects.

### Exploring the Flow View

1. Click the **Flow** tab at the top
2. You'll see a graph with nodes (events/encounters) and edges (dependencies)
3. **Navigation**:
   - **Pan**: Click and drag to move around the graph
   - **Zoom**: Use mouse wheel or controls to zoom
   - **Select**: Click any node to select it
   - **Arrange**: The graph auto-arranges based on dependencies

4. **What you'll see**:
   - **Event Nodes**: Rectangular nodes for story events
   - **Encounter Nodes**: Rounded nodes for encounters
   - **Dependency Arrows**: Lines showing prerequisites, triggers, and related connections

5. **Try it**: Follow the dependency chain from "Goblin Raid on Sandpoint" to see what events it triggers

> 📸 **Screenshot needed: Flow View with Dependency Graph**
>
> Show the Flow View displaying the dependency graph with event/encounter nodes connected by arrows. Highlight the "Goblin Raid on Sandpoint" node and show its connections to downstream events ("Investigate Goblin Tracks", "Local Heroes' Meeting"). Use different colors/shapes for events vs encounters. Include auto-layout button and zoom controls.

### Understanding Branches

The demo includes 3 alternate timeline branches showing different outcomes:

1. Click the **branch selector** dropdown (usually in the top navigation)
2. You'll see:
   - **Main Timeline**: The primary campaign progression
   - **Peaceful Festival**: What if the goblin raid was prevented?
   - **Shadow Conspiracy**: What if spies went undetected?
   - **Goblin Resurgence**: What if the heroes failed to stop the fortress raid?

3. **Try it**: Switch to "Peaceful Festival" branch and explore how the timeline differs

> 📸 **Screenshot needed: Branch Selector Dropdown**
>
> Show the branch selector dropdown menu open, displaying the Main Timeline (currently active, indicated with a checkmark) and three alternate branches ("Peaceful Festival", "Shadow Conspiracy", "Goblin Resurgence"). Include visual indicator showing which branch is currently active.

## Creating Your First Campaign

Ready to create your own campaign? Here's how:

### Step 1: Create a World

1. From the campaigns list, click **"Create New World"**
2. Fill in the details:
   - **Name**: Your world's name (e.g., "Forgotten Realms", "Homebrew World")
   - **Description**: A brief overview of your world setting
   - **Calendar**: Choose default calendar or create custom one
     - Standard calendars: Gregorian, Fantasy (12 months)
     - Custom: Define month names, days per month, etc.
3. Click **"Create World"**

### Step 2: Create a Campaign

1. Click **"Create New Campaign"**
2. Fill in the details:
   - **Name**: Your campaign name (e.g., "Dragon Heist Chronicles")
   - **World**: Select the world you just created
   - **Description**: Campaign overview and premise
   - **Start Date**: When does your campaign begin? (in world time)
3. Click **"Create Campaign"**

### Step 3: Add Your First Region

1. Open your new campaign
2. Click the **Map** tab
3. Click the **"Draw Region"** button in the toolbar
4. Draw a polygon on the map by clicking points (double-click to finish)
5. In the Entity Inspector, fill in:
   - **Name**: Region name (e.g., "Northern Territories")
   - **Description**: Describe the region's terrain, climate, culture
6. Click **"Save"**

### Step 4: Add a Settlement

1. Still in Map View, click the **"Add Settlement"** button
2. Click on the map where you want the settlement
3. In the Entity Inspector, fill in:
   - **Name**: Settlement name (e.g., "Thornhaven")
   - **Type**: City, Town, Village, Hamlet, etc.
   - **Population**: Current population
   - **Description**: Settlement details
4. Configure **Settlement Variables** (optional):
   - Resources, morale, defenses, etc.
   - These can be modified by events and effects
5. Click **"Save"**

### Step 5: Create Your First Event

1. Click the **Timeline** tab
2. Click the **"Create Event"** button
3. Fill in the details:
   - **Name**: Event name (e.g., "Bandit Raid Warning")
   - **Description**: What happens in this event
   - **Date & Time**: When does it occur?
   - **Location**: Where does it happen? (optional)
4. **Add Conditions** (optional): Define when this event should trigger
5. **Add Effects** (optional): Define what changes when this event occurs
6. Click **"Save"**

Congratulations! You've created your first campaign elements.

## Basic Navigation

### Switching Between Campaigns

- Click the **campaign name** in the top navigation
- Select a different campaign from the dropdown
- Or return to the campaigns list to see all available campaigns

### Selecting Entities

The tool uses **cross-view selection** - selecting an entity in one view highlights it everywhere:

- Select a settlement in Map View → it's highlighted in Timeline and Flow views too
- Select an event in Timeline → it's shown on the Map and in the Flow graph
- This makes it easy to see connections and relationships

### Using the Entity Inspector

The Entity Inspector is your primary tool for viewing and editing:

1. **Selection**: Click any entity in any view to open the inspector
2. **Tabs**: Switch between Overview, Variables, Relationships, History
3. **Editing**: Click edit buttons to modify properties
4. **Actions**: Access entity-specific actions (resolve, duplicate, delete)
5. **Close**: Click the X or click empty space to deselect

### Search and Filters

Most list views include search and filter capabilities:

- **Search**: Type entity names or descriptions
- **Filters**: Filter by type, status, date range, location, etc.
- **Sort**: Click column headers to sort
- **Export**: Export filtered results to CSV (if enabled)

### Keyboard Shortcuts

Common keyboard shortcuts to speed up your workflow:

- **Esc**: Close inspector or cancel current action
- **Ctrl/Cmd + F**: Focus search box
- **Ctrl/Cmd + Z**: Undo last action (where supported)
- **Delete**: Delete selected entity (with confirmation)
- **Arrow Keys**: Navigate between entities in list views

## Next Steps

Now that you're familiar with the basics, explore these tutorials to learn specific features:

### Feature Tutorials

- **[Map Editing Tutorial](map-editing-tutorial.md)**: Master the drawing tools, create locations, and manage geography
- **[Settlement Management Tutorial](settlement-management-tutorial.md)**: Learn about settlement types, structures, levels, and typed variables
- **[Conditions & Effects Tutorial](conditions-and-effects-tutorial.md)**: Create dynamic rules with JSONLogic and JSON Patch
- **[Event Resolution Tutorial](event-resolution-tutorial.md)**: Execute encounters, apply effects, and track consequences
- **[Branching Tutorial](branching-tutorial.md)**: Create alternate timelines and explore "what-if" scenarios

### Best Practices

**Start Small**: Don't try to map your entire world at once. Start with:

- One region
- 2-3 settlements
- A few initial events

**Use the Demo**: Reference the "Rise of the Runelords" demo campaign to see examples of:

- How to structure events and encounters
- How to use conditions and effects
- How to organize dependencies

**Iterate**: Your campaign structure will evolve. Don't worry about getting everything perfect initially:

- Add details as they become relevant
- Reorganize events as the story develops
- Create branches to explore different narrative paths

**Link Everything**: Use relationships and dependencies to connect:

- Events to locations
- Encounters to events
- Settlements to regions

**Track World State**: Use Settlement and Structure variables to track:

- Resources and population
- Morale and reputation
- Defenses and infrastructure

### Getting Help

- **Technical Documentation**: See `docs/features/` for detailed feature documentation
- **API Documentation**: See `docs/api/` for GraphQL API reference (advanced users)
- **Contributing**: See `CONTRIBUTING.md` if you want to contribute to the project
- **Issues**: Report bugs or request features on the project repository

## Glossary

Quick reference for common terms:

- **World**: The setting/universe where campaigns take place
- **Campaign**: A specific story/adventure within a world
- **Region**: A large geographic area (country, territory, etc.)
- **Location**: A specific point of interest (dungeon, landmark, etc.)
- **Settlement**: A populated place (city, town, village, etc.)
- **Structure**: A building or facility within a settlement
- **Event**: A story occurrence that happens at a specific time
- **Encounter**: A challenge or interaction (combat, social, exploration)
- **Condition**: A rule that determines when something should happen (JSONLogic)
- **Effect**: A change to the world state (JSON Patch)
- **Branch**: An alternate timeline showing different outcomes
- **Dependency**: A relationship between events/encounters (prerequisite, trigger, related)
- **Entity Inspector**: The side panel that shows details about selected entities

---

**Ready to start your adventure?** Open the application and dive in! Remember: the best way to learn is by doing. Create a simple campaign and experiment with the features. You can always reference this guide or the feature tutorials as you go.

Happy adventuring! 🎲

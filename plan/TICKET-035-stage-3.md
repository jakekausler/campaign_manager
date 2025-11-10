# TICKET-035 - Stage 3: User Documentation

## Goal

Create comprehensive user-facing documentation including getting started guide, feature tutorials, and video walkthrough scripts.

## Context

User documentation should help end users (game masters and players) understand how to use the campaign management tool effectively. This includes:

- **Getting Started Guide**: First-time setup, creating a campaign, basic navigation
- **Feature Tutorials**: Step-by-step guides for major features
- **Video Walkthrough Scripts**: Scripts that can be used to create video tutorials

**Existing Feature Documentation** (in `docs/features/`):

These documents are developer/technical focused. User docs should reference them but be written for non-technical users.

**Files to Create:**

- `docs/user-guide/getting-started.md`
- `docs/user-guide/map-editing-tutorial.md`
- `docs/user-guide/conditions-and-effects-tutorial.md`
- `docs/user-guide/branching-tutorial.md`
- `docs/user-guide/settlement-management-tutorial.md`
- `docs/user-guide/event-resolution-tutorial.md`
- `docs/user-guide/video-walkthrough-script.md`

## Tasks

### Development Tasks

- [x] Create `docs/user-guide/` directory
- [x] Write getting started guide covering first login, campaign creation, basic navigation
- [x] Write map editing tutorial covering drawing tools, location management, region editing
- [x] Write conditions and effects tutorial covering JSONLogic basics and effect creation
- [x] Write branching tutorial covering creating branches, switching between timelines, merging
- [x] Write settlement management tutorial covering creation, structures, levels, typed variables
- [x] Write event resolution tutorial covering encounter execution, applying effects, tracking consequences
- [x] Write video walkthrough script covering 15-20 minute demo of all major features
- [ ] Add screenshots/diagrams where helpful (placeholders with descriptions if needed)

### Review and Commit Tasks

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

- Created `docs/user-guide/` directory - ready for user documentation files
- **Getting Started Guide** (`getting-started.md`): Comprehensive onboarding document with 8 main sections:
  - Introduction explaining what the tool is and what it helps with
  - First login instructions with demo account credentials
  - Interface overview covering navigation, tabs, inspector, and world time
  - Demo campaign exploration using "Rise of the Runelords" with guided tours of Map/Timeline/Flow views
  - Step-by-step campaign creation guide (world → campaign → region → settlement → event)
  - Basic navigation including cross-view selection, inspector usage, search/filters, keyboard shortcuts
  - Next steps linking to feature tutorials and best practices
  - Glossary defining all key terms
  - Used concrete examples from the seed data (Golarion, Varisia, Sandpoint, etc.)
  - Non-technical language focused on "how to use" for end users (GMs and players)
- **Map Editing Tutorial** (`map-editing-tutorial.md`): Comprehensive 594-line guide covering all geographic editing:
  - Overview of 4 entity types: Regions (polygons), Locations (pins), Settlements (cities/towns), Structures (buildings)
  - Step-by-step instructions for drawing regions with polygon tools
  - Adding point-based locations with type categorization
  - Creating settlements with population, type, and typed variables (economy, defense, morale, resources, reputation)
  - Adding structures within settlements with service tracking
  - Editing existing entities: properties, geometry, movement, deletion
  - Advanced techniques: multi-region editing, layer management, geographic variables, event integration
  - Best practices: planning, naming conventions, scale/detail management, geographic realism, version control
  - Troubleshooting section with common issues and performance tips
  - Practice exercise to reinforce learning
  - Used concrete examples (Ironforge town, Gilded Hammer smithy, Frostpeak Range, etc.)
- **Conditions and Effects Tutorial** (`conditions-and-effects-tutorial.md`): Comprehensive 1065-line guide demystifying JSONLogic and JSON Patch:
  - Introduction explaining conditions (when things happen) and effects (what changes occur)
  - JSONLogic fundamentals: operators (comparison, logical, variable access, arrays), basic structure, nested logic
  - JSON Patch fundamentals: operations (add, replace, remove, increment), path syntax, multiple operations
  - Progressive examples: Simple (9 examples) → Intermediate (6 examples) → Advanced (3 examples)
  - Complete walkthrough creating "Autumn Harvest Festival" with multi-part condition and effect
  - Common patterns: threshold monitoring, time-based triggers, prerequisite chains, resource management, state machines
  - Testing and debugging: manual testing, condition/effect testers, common issues, debugging tips
  - Best practices: DOs/DON'Ts for conditions and effects, naming conventions, documentation, versioning
  - Practice exercises and advanced challenges (seasonal economy system)
  - Bridges technical concepts (JSONLogic/JSON Patch) to game scenarios users understand
- **Branching Tutorial** (`branching-tutorial.md`): Comprehensive 733-line guide to alternate timeline branches:
  - Introduction to branching: what branches are, why use them (experimentation, collaboration, historical tracking)
  - Core concepts: parent/child hierarchy, divergence points, version inheritance with concrete examples
  - Step-by-step branch creation walkthrough (navigate, configure, fork, make changes)
  - Switching between timelines with branch selector and visual indicators
  - Detailed exploration of 3 demo branch examples (Peaceful Festival, Shadow Conspiracy, Goblin Resurgence)
  - Complete merging guide: when to merge, three-way merge strategy, conflict resolution with examples
  - Merge strategies: selective merge, full branch merge, hierarchical merge
  - Branch management: hierarchy view, editing details, deletion, permissions by role
  - Best practices: planning branches, working in branches (DOs/DON'Ts), merge hygiene, organization
  - 5 common scenarios with solutions: event testing, player choice prep, collaborative campaigns, long-term arcs, sandbox exploration
  - Quick reference table and next steps linking to other tutorials
  - Uses seed data examples (Peaceful Festival, Shadow Conspiracy, Goblin Resurgence branches with detailed scenarios)
  - Non-technical language with real-world analogies (save files, family trees)
- **Settlement Management Tutorial** (`settlement-management-tutorial.md`): Comprehensive 1344-line guide to managing settlements and structures:
  - Introduction to settlements: what they are, why they matter (player hubs, economy, quest hooks, dynamic state)
  - Settlement basics: hierarchy (World → Kingdom → Settlement → Structure), types by population, common variables
  - Step-by-step settlement creation: navigation, basic info, defining typed variables with complete schemas
  - Understanding typed variables: flexible vs rigid approaches, benefits, schema best practices (naming, types, defaults, descriptions)
  - Common variable patterns: economic, military, social variables with complete examples
  - Settlement levels and progression: 1-5 level system, what levels affect, when to level up, progression example (Sandpoint)
  - Adding structures: structure basics, creation workflow, choosing types, naming, initial levels, defining variables
  - Structure types and variables: detailed examples for 6 structure types (inns, smithies, temples, military, libraries, docks)
  - Structure levels and upgrades: what levels represent, upgrade process, typical upgrade paths, when to upgrade
  - Managing settlement state: viewing state, manual editing, effect-driven changes, tracking history with version system
  - 5 common patterns: population growth, event impact on morale, structure prerequisites, settlement under siege, economic simulation
  - Best practices: settlement design (DOs/DON'Ts), variable management, structure organization, maintenance, documentation
  - Advanced topics: cross-settlement dynamics (trade networks, political relationships), dynamic settlement types, disasters, integration with conditions/effects
  - Quick reference table and next steps linking to other tutorials
  - Uses seed data examples (Sandpoint, Magnimar, Korvosa, Wati, Sothis settlements with structures like Rusty Dragon Inn, Naval Shipyard, The Occularium)
  - Non-technical language focused on game master workflows and campaign management
- **Event Resolution Tutorial** (`event-resolution-tutorial.md`): Comprehensive 1,127-line guide to resolving events and encounters:
  - Introduction explaining what resolution is and when to use it (permanent action that applies effects)
  - Events vs. Encounters comparison table showing both use the same effect system
  - Step-by-step event resolution walkthrough (Swallowtail Festival example with 6 detailed steps)
  - Step-by-step encounter resolution walkthrough (Goblin Raid example with 4 detailed steps)
  - Understanding effects: three-phase execution model (PRE, ON_RESOLVE, POST) with visual diagrams
  - Effect priority and execution order within phases (lowest priority number executes first)
  - Common JSON Patch operations: replace (change value), add (create field/append array), remove (delete)
  - Protected fields that cannot be modified (/id, /createdAt, /updatedAt, ownership fields)
  - Multi-effect resolution example (Autumn Harvest Festival with 4 effects across phases)
  - Audit trail usage: what's tracked, how to view resolution history, effect execution logs
  - Understanding effect status (succeeded vs. failed), partial failures, common failure reasons
  - 5 common resolution scenarios: simple event, encounter chain, cascading effects, warnings, validation errors
  - Advanced cross-entity effects: events/encounters modifying other entities (settlements, structures)
  - Best practices: DOs (review before resolving, chronological order, use branches) and DON'Ts (out of order, ignore errors)
  - Troubleshooting section: grayed out buttons, failed effects, nothing changed, can't find resolved event, accidental resolution
  - Integration with other features: Timeline/Flow/Map views, cross-view selection, branching, audit trail
  - Practice exercise with 6 steps guiding users through complete resolution workflow
  - Next steps linking to related tutorials (conditions/effects, branching, settlement management)
  - Quick reference card with workflow, phases, operations, status indicators, keyboard shortcuts
  - Glossary defining all key terms (resolution, effect, phase, priority, JSON Patch, audit trail, etc.)
  - Uses seed data examples (Swallowtail Festival, Goblin Raid, Cathedral Consecration, encounter chains)
  - Non-technical language with real-world analogies (to-do list, checking off tasks, etc.)
- **Video Walkthrough Script** (`video-walkthrough-script.md`): Production-ready 18-20 minute demo script:
  - Comprehensive script structure with 10 timed segments covering all major features
  - Dual-track format: presenter talking points + on-screen actions clearly separated
  - Progressive complexity: starts with simple navigation, builds to advanced features (conditions/effects, branching)
  - Uses actual seed data (Golarion, Rise of the Runelords, Sandpoint, Varisia) for authentic workflows
  - 10 feature segments: Interface Overview (2min), Map View (3min), Timeline View (3min), Flow View (2min), Settlement Management (2min), Conditions & Effects (3min), Event Resolution (2min), Branching (2min), Cross-View Selection (1min), Wrap-up (1min)
  - Production notes section: visual assets needed, pacing tips, technical considerations (resolution, cursor highlighting, audio)
  - Alternative delivery formats: segmented videos, interactive demos, live webinars
  - Testing checklist with 11 verification items for pre-recording setup
  - Localization notes for terminology, date formats, technical jargon
  - Detailed presenter dialogue with visual cues ([SCREEN], [ACTION]) for each segment
  - Examples include: navigating views, inspecting entities (Sandpoint, Thistletop, Goblin Raid), examining conditions/effects JSON, resolving encounters with effects, exploring branch timelines
  - Demonstrates cross-view selection synchronization across Map/Timeline/Flow views
  - Includes JSON examples inline (JSONLogic conditions, JSON Patch effects) with explanations

## Commit Hash

_Added when final commit task is complete_

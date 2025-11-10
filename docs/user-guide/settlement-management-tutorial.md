# Settlement Management Tutorial

This tutorial will teach you how to create and manage **settlements** (cities, towns, villages) in your campaign. You'll learn how to track population, add structures (buildings), manage settlement progression through levels, and use typed variables to create dynamic, evolving communities.

## Table of Contents

1. [What Are Settlements?](#what-are-settlements)
2. [Settlement Basics](#settlement-basics)
3. [Creating Your First Settlement](#creating-your-first-settlement)
4. [Understanding Typed Variables](#understanding-typed-variables)
5. [Settlement Levels and Progression](#settlement-levels-and-progression)
6. [Adding Structures](#adding-structures)
7. [Structure Types and Variables](#structure-types-and-variables)
8. [Structure Levels and Upgrades](#structure-levels-and-upgrades)
9. [Managing Settlement State](#managing-settlement-state)
10. [Common Patterns](#common-patterns)
11. [Best Practices](#best-practices)
12. [Advanced Topics](#advanced-topics)

## What Are Settlements?

**Settlements** are populated places in your world - cities, towns, villages, outposts, or any other community where people live and work. They are central to campaign management because they:

- **Serve as player hubs** - Places to rest, resupply, and gather information
- **Drive the economy** - Markets, crafters, and trade opportunities
- **Provide quest hooks** - NPCs with problems to solve
- **React to events** - Population, morale, and resources change based on what happens
- **Evolve over time** - Grow, decline, or transform as the campaign progresses

Unlike simple **Locations** (which are just pins on the map), settlements have:

- **Population tracking** - How many people live there
- **Typed variables** - Custom properties like morale, defense, resources
- **Structures** - Buildings and facilities within the settlement
- **Levels** - Progression from hamlet to metropolis
- **Dynamic state** - Variables that change based on events and effects

## Settlement Basics

### Settlement Hierarchy

Settlements fit into the world structure:

```
World (Golarion)
└─ Kingdom (Varisia)
   └─ Settlement (Sandpoint)
      ├─ Structure (Rusty Dragon Inn)
      ├─ Structure (Sandpoint Cathedral)
      └─ Structure (Locksmith's Shop)
```

**Key Relationships:**

- Settlements belong to **Kingdoms** (political entities)
- Settlements are located at **Locations** (geographic coordinates on the map)
- Settlements contain **Structures** (buildings and facilities)
- Settlements have **Variables** that track their state

### Settlement Types (by Size)

While not enforced by the system, settlements typically fall into these categories:

| Type           | Population   | Description                                          |
| -------------- | ------------ | ---------------------------------------------------- |
| **Hamlet**     | 20-80        | Tiny rural community, few services                   |
| **Village**    | 81-400       | Small settlement, basic services                     |
| **Town**       | 401-2,000    | Moderate settlement, most services available         |
| **City**       | 2,001-25,000 | Large urban center, all services, multiple districts |
| **Metropolis** | 25,000+      | Massive city, political/economic center              |

**Note:** These are guidelines, not rules. Your campaign may use different definitions!

### Settlement Variables

Settlements use **typed variables** to track their state. Common variables include:

- **population** (number) - How many people live here
- **defenseRating** (number) - Military strength (1-20 scale)
- **hasWalls** (boolean) - Whether the settlement has defensive walls
- **primaryIndustry** (enum) - Main economic activity (agriculture, trade, mining, etc.)
- **marketSize** (enum) - Size of the marketplace (small, medium, large, metropolis)
- **militiaSize** (number) - Number of guards/soldiers

You can create **custom variables** for anything you want to track!

## Creating Your First Settlement

Let's create a settlement step-by-step using the demo campaign as context.

### Step 1: Navigate to Settlement Creation

There are two ways to create a settlement:

**Method 1: From the Map**

1. Open the **Map View**
2. Click **"Add Settlement"** in the map toolbar
3. Click a location on the map where you want the settlement
4. The settlement creation form opens

**Method 2: From the Lists View**

1. Open the **Lists** tab
2. Select **"Settlements"** from the entity type dropdown
3. Click **"Create New Settlement"**
4. Fill in the creation form

### Step 2: Fill in Basic Information

**Name** (required)

The settlement's name. Make it memorable and fitting for your world!

**Examples:**

- Sandpoint (coastal town)
- Magnimar (city of monuments)
- Ironforge (dwarven mining town)
- Riverwatch (guard outpost)

**Kingdom** (required)

Which kingdom/political entity does this settlement belong to?

**Example:** Varisia (frontier kingdom)

**Location** (required if creating from lists)

The geographic coordinates where the settlement exists. If you created the settlement from the map, this is auto-filled.

**Level** (optional, defaults to 1)

Settlement level represents size, influence, and development. We'll cover this in detail later.

**Initial Values:** Start at level 1 for new settlements, or higher for established cities.

> 📸 **Screenshot needed: Settlement Creation Form**
>
> Show the settlement creation dialog/form with fields filled in for a sample settlement (e.g., "Ironforge"). Display the Name field, Kingdom dropdown, Location coordinates, Level selector, and the Typed Variables section (empty or with one example variable). Highlight the required fields with asterisks.

### Step 3: Define Typed Variables

This is where settlements become interesting! You define **variable schemas** that determine what you can track.

**Variable Schema Structure:**

Each variable has:

- **Name** - Variable identifier (e.g., "population")
- **Type** - Data type (number, string, boolean, enum)
- **Description** - What this variable represents
- **Default Value** - Starting value for new settlements

**Example: Basic Settlement Variables**

Let's create a simple town with these variables:

```json
{
  "variables": {
    "population": 1200,
    "defenseRating": 8,
    "hasWalls": true,
    "primaryIndustry": "fishing",
    "marketSize": "medium"
  },
  "variableSchemas": [
    {
      "name": "population",
      "type": "number",
      "description": "Settlement population",
      "defaultValue": 0
    },
    {
      "name": "defenseRating",
      "type": "number",
      "description": "Defense rating (1-20)",
      "defaultValue": 5
    },
    {
      "name": "hasWalls",
      "type": "boolean",
      "description": "Whether settlement has defensive walls",
      "defaultValue": false
    },
    {
      "name": "primaryIndustry",
      "type": "enum",
      "enumValues": ["agriculture", "fishing", "mining", "trade", "crafts", "magic"],
      "description": "Primary economic industry",
      "defaultValue": "agriculture"
    },
    {
      "name": "marketSize",
      "type": "enum",
      "enumValues": ["small", "medium", "large", "metropolis"],
      "description": "Size of the marketplace",
      "defaultValue": "small"
    }
  ]
}
```

**Variable Types Explained:**

- **number**: Any numeric value (population, ratings, counts)
- **string**: Text values (names, descriptions)
- **boolean**: True/false flags (hasWalls, isUnderSiege)
- **enum**: Predefined choices (primaryIndustry, marketSize)

### Step 4: Save and View

1. Click **"Create Settlement"**
2. The settlement appears on the map (if location was provided)
3. The **Entity Inspector** opens showing your new settlement
4. You can immediately start adding structures or editing variables

**What You'll See:**

- Settlement marker on the map
- Current variable values in the inspector
- "Add Structure" button to create buildings
- Links to related entities (kingdom, location)

## Understanding Typed Variables

Typed variables are the foundation of settlement dynamics. They allow you to track anything you want and use them in conditions and effects.

### Why Use Typed Variables?

**Traditional Approach (Rigid):**

The system defines fixed fields:

- Every settlement has "population"
- Every settlement has "morale"
- You can't track anything else

**Typed Variables Approach (Flexible):**

You define what to track:

- Want to track "corruption"? Add a variable!
- Want to track "magicAffinity"? Add a variable!
- Want to track "plagueVictims"? Add a variable!

**Benefits:**

- ✅ **Customization** - Track what matters to your campaign
- ✅ **Flexibility** - Different settlements can have different variables
- ✅ **Integration** - Use variables in conditions and effects
- ✅ **Evolution** - Add new variables as your campaign grows

### Variable Schema Best Practices

**1. Descriptive Names**

Use clear, descriptive variable names:

**Good:**

- `defenseRating` (clear what it measures)
- `primaryIndustry` (obvious purpose)
- `hasWalls` (boolean naming convention)

**Bad:**

- `dr` (unclear abbreviation)
- `industry` (could be unclear in context)
- `walls` (is it count or boolean?)

**2. Appropriate Types**

Choose the right type for your data:

| Use Case                    | Type    | Example                       |
| --------------------------- | ------- | ----------------------------- |
| Counts (population, guards) | number  | `population: 1200`            |
| Ratings (1-20 scales)       | number  | `defenseRating: 8`            |
| Yes/No flags                | boolean | `hasWalls: true`              |
| Predefined choices          | enum    | `primaryIndustry: "fishing"`  |
| Names, descriptions         | string  | `mayorName: "Kendra Deverin"` |

**3. Meaningful Default Values**

Set sensible defaults that apply to most settlements:

```json
{
  "name": "population",
  "type": "number",
  "defaultValue": 0 // Most settlements start unpopulated
}
```

```json
{
  "name": "hasWalls",
  "type": "boolean",
  "defaultValue": false // Most settlements don't have walls initially
}
```

**4. Clear Descriptions**

Write descriptions that explain what the variable represents and how it's used:

**Good:**

```json
{
  "name": "morale",
  "description": "Citizen morale rating (0-100), affects productivity and loyalty"
}
```

**Bad:**

```json
{
  "name": "morale",
  "description": "morale" // Not helpful!
}
```

### Common Variable Patterns

Here are common variable schemas used in settlements:

**Economic Variables:**

```json
[
  {
    "name": "wealth",
    "type": "number",
    "description": "Settlement wealth in gold pieces",
    "defaultValue": 0
  },
  {
    "name": "taxRevenue",
    "type": "number",
    "description": "Monthly tax revenue in gold",
    "defaultValue": 0
  },
  {
    "name": "marketSize",
    "type": "enum",
    "enumValues": ["small", "medium", "large", "metropolis"],
    "description": "Size of the marketplace",
    "defaultValue": "small"
  }
]
```

**Military Variables:**

```json
[
  {
    "name": "defenseRating",
    "type": "number",
    "description": "Military defense rating (1-20)",
    "defaultValue": 5
  },
  {
    "name": "militiaSize",
    "type": "number",
    "description": "Number of guards/militia",
    "defaultValue": 0
  },
  {
    "name": "hasWalls",
    "type": "boolean",
    "description": "Whether settlement has defensive walls",
    "defaultValue": false
  }
]
```

**Social Variables:**

```json
[
  {
    "name": "morale",
    "type": "number",
    "description": "Citizen morale (0-100)",
    "defaultValue": 50
  },
  {
    "name": "loyalty",
    "type": "number",
    "description": "Loyalty to the ruling power (0-100)",
    "defaultValue": 50
  },
  {
    "name": "unrest",
    "type": "number",
    "description": "Civil unrest level (0-100, higher is worse)",
    "defaultValue": 0
  }
]
```

## Settlement Levels and Progression

Settlement levels represent overall development, size, and influence. As settlements grow and improve, they increase in level.

### Level System Overview

**Levels:** 1-5 (or higher, if your campaign needs it)

| Level | Typical Size             | Description                                   | Example                  |
| ----- | ------------------------ | --------------------------------------------- | ------------------------ |
| **1** | Hamlet/Village           | Small community, basic services               | Sandpoint (starting)     |
| **2** | Large Village/Small Town | Growing settlement, expanding services        | Sandpoint (after growth) |
| **3** | Town/Small City          | Established urban center, full services       | Magnimar districts       |
| **4** | City                     | Major urban center, regional importance       | Magnimar (overall)       |
| **5** | Metropolis               | Massive city, national/continental importance | Absalom, Westcrown       |

**Note:** Level progression is not automatic! You must manually increase the level when appropriate.

### What Levels Affect

Settlement levels influence:

1. **Narrative Scope** - Higher level = greater regional importance
2. **Structure Capacity** - Higher level settlements can support more/better structures
3. **Event Eligibility** - Some events only trigger in settlements of certain levels
4. **Condition Evaluation** - Effects may scale based on settlement level

**Example Condition:**

```json
{
  ">": [{ "var": "settlement.level" }, 2]
}
```

Translation: "Settlement level is greater than 2" (only affects towns and cities)

### Leveling Up a Settlement

To increase a settlement's level:

1. **Open the settlement** in the Entity Inspector
2. **Click "Edit Settlement"**
3. **Change the level** field to the new level
4. **Save changes**

**When to level up:**

- **Population growth** - Settlement doubled in size
- **Economic development** - Major new industry established
- **Political importance** - Became regional capital
- **Infrastructure** - Significant structures added (walls, cathedral, etc.)
- **Narrative milestone** - Major story event transformed the settlement

**Example:**

Sandpoint starts at level 1 (small coastal town). After:

- Population grows from 1,000 to 2,500
- New defensive walls built
- Major temple constructed
- Becomes regional trade hub

You might increase Sandpoint to level 2.

### Level Progression Example: Sandpoint

Let's track Sandpoint's progression over a campaign:

**Level 1 (Campaign Start):**

- Population: 1,000
- Structures: 3 (Rusty Dragon Inn, Sandpoint Cathedral, Locksmith)
- Defense Rating: 6
- Description: "Small coastal town, recovering from recent fire"

**Level 2 (After First Arc):**

- Population: 1,500
- Structures: 6 (added Guard Tower, Marketplace, Smithy)
- Defense Rating: 10
- Walls: true
- Description: "Growing town, fortified after goblin raids"

**Level 3 (Mid-Campaign):**

- Population: 3,000
- Structures: 10 (added Library, Advanced Smithy, Naval Dock)
- Defense Rating: 14
- Description: "Thriving coastal city, regional trade center"

## Adding Structures

Structures are buildings and facilities within settlements. They provide services, generate resources, and evolve alongside the settlement.

### Structure Basics

**What are structures?**

Individual buildings or facilities that exist within a settlement:

- **Services**: Inns, temples, libraries, markets
- **Production**: Smithies, mills, workshops
- **Military**: Guard towers, barracks, walls
- **Infrastructure**: Docks, granaries, town halls

**Structure Hierarchy:**

```
Settlement (Sandpoint)
├─ Structure (Rusty Dragon Inn) - Level 2
├─ Structure (Sandpoint Cathedral) - Level 3
└─ Structure (Locksmith's Shop) - Level 1
```

Structures are always children of settlements.

### Creating a Structure

**Step 1: Open Settlement**

1. Select the settlement on the map or in the lists
2. The Entity Inspector shows settlement details
3. Click **"Add Structure"** button

**Step 2: Choose Structure Type**

Common structure types:

- **inn** - Accommodation and social gathering
- **temple** - Religious services
- **smithy** - Weapon and armor crafting
- **library** - Knowledge and research
- **dock** - Shipping and trade
- **tower** - Defense and surveillance
- **market** - Commerce and trade
- **barracks** - Military housing

**Note:** Types are flexible! Use what makes sense for your campaign.

**Step 3: Name the Structure**

Give it a unique, memorable name:

**Examples:**

- "The Rusty Dragon" (inn)
- "Sandpoint Cathedral" (temple)
- "The Gilded Hammer" (smithy)
- "Ironwatch Tower" (tower)

**Step 4: Set Initial Level**

Structures have levels (1-5) just like settlements:

- **Level 1** - Basic, new, or run-down facility
- **Level 2** - Established, functional facility
- **Level 3** - Well-developed, important facility
- **Level 4** - Exceptional, renowned facility
- **Level 5** - Legendary, one-of-a-kind facility

Start at level 1 for new structures, or higher for established buildings.

**Step 5: Define Structure Variables**

Like settlements, structures use typed variables to track their state.

**Example: Rusty Dragon Inn Variables**

```json
{
  "variables": {
    "rooms": 10,
    "guestsPerNight": 8,
    "innkeeper": "Ameiko Kaijitsu",
    "hasKitchen": true,
    "reputation": "welcoming"
  },
  "variableSchemas": [
    {
      "name": "rooms",
      "type": "number",
      "description": "Number of guest rooms",
      "defaultValue": 5
    },
    {
      "name": "guestsPerNight",
      "type": "number",
      "description": "Average guests per night",
      "defaultValue": 0
    },
    {
      "name": "innkeeper",
      "type": "string",
      "description": "Name of the innkeeper"
    },
    {
      "name": "hasKitchen",
      "type": "boolean",
      "description": "Whether inn has a kitchen",
      "defaultValue": false
    },
    {
      "name": "reputation",
      "type": "enum",
      "enumValues": ["poor", "average", "welcoming", "renowned"],
      "description": "Inn's reputation",
      "defaultValue": "average"
    }
  ]
}
```

**Step 6: Save and View**

Click **"Create Structure"** and it appears in the settlement's structure list.

## Structure Types and Variables

Different structure types track different things. Here are common patterns:

### Inns and Taverns

**Type:** `inn`

**Common Variables:**

```json
[
  {
    "name": "rooms",
    "type": "number",
    "description": "Number of guest rooms",
    "defaultValue": 5
  },
  {
    "name": "guestsPerNight",
    "type": "number",
    "description": "Average guests per night",
    "defaultValue": 0
  },
  {
    "name": "innkeeper",
    "type": "string",
    "description": "Name of the innkeeper"
  },
  {
    "name": "hasStables",
    "type": "boolean",
    "description": "Whether inn has stables for horses",
    "defaultValue": false
  }
]
```

**Example:** Rusty Dragon Inn (Sandpoint) - Level 2, 10 rooms, renowned for hospitality

### Smithies and Workshops

**Type:** `smithy`

**Common Variables:**

```json
[
  {
    "name": "smiths",
    "type": "number",
    "description": "Number of working smiths",
    "defaultValue": 1
  },
  {
    "name": "specialization",
    "type": "enum",
    "enumValues": ["general", "weapons", "armor", "tools", "jewelry"],
    "description": "Smithy specialization",
    "defaultValue": "general"
  },
  {
    "name": "ordersPerWeek",
    "type": "number",
    "description": "Average orders completed per week",
    "defaultValue": 5
  },
  {
    "name": "mastersmith",
    "type": "string",
    "description": "Name of the master smith"
  }
]
```

**Example:** The Anvil and Anchor (Corentyn) - Level 2, specializes in shipwright tools

### Temples and Churches

**Type:** `temple`

**Common Variables:**

```json
[
  {
    "name": "deity",
    "type": "string",
    "description": "Deity or pantheon worshipped"
  },
  {
    "name": "priests",
    "type": "number",
    "description": "Number of priests/clerics",
    "defaultValue": 1
  },
  {
    "name": "healingCapacity",
    "type": "number",
    "description": "Healing services available per day",
    "defaultValue": 0
  },
  {
    "name": "isConsecrated",
    "type": "boolean",
    "description": "Whether temple is consecrated ground",
    "defaultValue": false
  }
]
```

**Example:** Sandpoint Cathedral - Level 3, dedicated to Desna, 5 priests

### Military Structures

**Type:** `barracks`, `tower`

**Common Variables:**

```json
[
  {
    "name": "guards",
    "type": "number",
    "description": "Number of guards stationed",
    "defaultValue": 10
  },
  {
    "name": "commander",
    "type": "string",
    "description": "Name of the commander"
  },
  {
    "name": "isOperational",
    "type": "boolean",
    "description": "Whether facility is operational",
    "defaultValue": true
  },
  {
    "name": "armoryLevel",
    "type": "number",
    "description": "Quality of weapons and armor (1-5)",
    "defaultValue": 1
  }
]
```

**Example:** Ironwatch Tower (Korvosa) - Level 4, 150 guards, commander "Captain Drex"

### Libraries and Archives

**Type:** `library`

**Common Variables:**

```json
[
  {
    "name": "volumes",
    "type": "number",
    "description": "Number of books and scrolls",
    "defaultValue": 100
  },
  {
    "name": "specialCollections",
    "type": "number",
    "description": "Number of rare/special collections",
    "defaultValue": 0
  },
  {
    "name": "isPublic",
    "type": "boolean",
    "description": "Whether library is open to public",
    "defaultValue": true
  },
  {
    "name": "librarian",
    "type": "string",
    "description": "Name of the head librarian"
  }
]
```

**Example:** The Occularium (Sothis) - Level 5, 50,000 volumes, 20 special collections, private access

### Docks and Harbors

**Type:** `dock`

**Common Variables:**

```json
[
  {
    "name": "berths",
    "type": "number",
    "description": "Number of ship berths",
    "defaultValue": 5
  },
  {
    "name": "shipsPerDay",
    "type": "number",
    "description": "Average ships processed per day",
    "defaultValue": 5
  },
  {
    "name": "harbormaster",
    "type": "string",
    "description": "Name of the harbormaster"
  },
  {
    "name": "hasCustomsHouse",
    "type": "boolean",
    "description": "Whether dock has customs inspection",
    "defaultValue": false
  }
]
```

**Example:** Naval Shipyard (Corentyn) - Level 3, 20 berths, 10 ships per day

## Structure Levels and Upgrades

Like settlements, structures can be upgraded by increasing their level.

### What Structure Levels Represent

**Level 1: Basic**

- New construction or run-down facility
- Minimal staff, limited capacity
- Basic services only

**Level 2: Established**

- Functional, maintained facility
- Adequate staff, reasonable capacity
- Standard services available

**Level 3: Advanced**

- Well-developed, prosperous facility
- Experienced staff, good capacity
- Enhanced services, local reputation

**Level 4: Exceptional**

- Renowned facility, regional importance
- Expert staff, large capacity
- Premium services, wide reputation

**Level 5: Legendary**

- One-of-a-kind facility, continental renown
- Master-level staff, massive capacity
- Unique services, legendary reputation

### Upgrading Structures

To upgrade a structure:

1. Open the structure in the Entity Inspector
2. Click "Edit Structure"
3. Increase the level field
4. Update variables to reflect improvements
5. Save changes

**Typical Upgrade Path: Smithy Example**

**Level 1 → Level 2:**

- Smiths: 1 → 3
- OrdersPerWeek: 5 → 15
- Add specialization: "general" → "weapons"

**Level 2 → Level 3:**

- Smiths: 3 → 6
- OrdersPerWeek: 15 → 30
- Add mastersmith: "Gorim Ironhand"
- Specialization: "weapons" → "masterwork weapons"

**Level 3 → Level 4:**

- Smiths: 6 → 10
- OrdersPerWeek: 30 → 50
- Reputation: regional renown
- Can craft magical weapons

### When to Upgrade Structures

**Narrative Triggers:**

- **Time passing** - Years of operation and growth
- **Investment** - Players or NPCs fund improvements
- **Quest rewards** - Completing quests unlocks upgrades
- **Event outcomes** - Successful events improve structures

**Mechanical Triggers:**

- **Settlement level increase** - Settlement grows, structures follow
- **Variable thresholds** - Wealth or resources reach certain levels
- **Dependencies met** - Prerequisites satisfied (e.g., "requires level 3 settlement")

## Managing Settlement State

Settlements are dynamic - their variables change based on events, player actions, and time passing.

### Viewing Settlement State

**Entity Inspector:**

When you select a settlement:

- **Variables** section shows current values
- **Structures** section lists all buildings
- **Related Entities** shows kingdom, events, encounters

**Timeline Integration:**

Settlement changes appear on the timeline:

- Variable changes (population increases)
- Structure additions (new buildings)
- Level changes (settlement upgrades)

### Editing Settlement Variables

**Manual Editing:**

1. Select settlement
2. Click "Edit Settlement"
3. Modify variable values
4. Save changes

**Effect-Driven Changes:**

The preferred method is to use **Effects** (JSON Patch operations) to modify variables:

**Example Effect: Increase Population**

```json
[
  {
    "op": "replace",
    "path": "/variables/population",
    "value": 1200
  }
]
```

**Example Effect: Add to Defense Rating**

```json
[
  {
    "op": "add",
    "path": "/variables/defenseRating",
    "value": 2
  }
]
```

See the **[Conditions and Effects Tutorial](conditions-and-effects-tutorial.md)** for complete details.

### Tracking Settlement History

**Version System:**

The system tracks settlement state across time and branches:

- Every change creates a new version
- Versions are timestamped with world time
- You can view historical states
- Branches preserve alternate timelines

**Viewing History:**

1. Select settlement
2. Click "View History" (if available)
3. See timeline of changes
4. Compare versions across time

## Common Patterns

Here are common settlement management patterns used in campaigns:

### Pattern 1: Population Growth

**Scenario:** Settlement grows naturally over time.

**Setup:**

1. Create recurring event: "Population Growth"
2. Set condition: Triggers every year (world time)
3. Set effect: Increase population by 10%

**Effect:**

```json
[
  {
    "op": "replace",
    "path": "/variables/population",
    "value": "<calculated: current population * 1.10>"
  }
]
```

**Alternative:** Manual updates at milestone sessions.

### Pattern 2: Event Impact on Morale

**Scenario:** Events affect settlement morale.

**Success Effect (Festival succeeds):**

```json
[
  {
    "op": "add",
    "path": "/variables/morale",
    "value": 10
  }
]
```

**Failure Effect (Raid succeeds):**

```json
[
  {
    "op": "add",
    "path": "/variables/morale",
    "value": -20
  }
]
```

### Pattern 3: Structure Prerequisites

**Scenario:** Advanced structures require settlement conditions.

**Condition for Advanced Library:**

```json
{
  "and": [
    { ">=": [{ "var": "settlement.level" }, 3] },
    { ">=": [{ "var": "settlement.variables.population" }, 5000] },
    { "==": [{ "var": "settlement.variables.primaryIndustry" }, "magic"] }
  ]
}
```

Translation: "Settlement must be level 3+, population 5000+, and magic-focused"

### Pattern 4: Settlement Under Siege

**Scenario:** Track siege state and resource depletion.

**Variables:**

```json
{
  "isUnderSiege": true,
  "siegeDuration": 30,
  "foodReserves": 500,
  "morale": 40
}
```

**Daily Effect:**

```json
[
  {
    "op": "add",
    "path": "/variables/siegeDuration",
    "value": 1
  },
  {
    "op": "add",
    "path": "/variables/foodReserves",
    "value": -50
  },
  {
    "op": "add",
    "path": "/variables/morale",
    "value": -2
  }
]
```

### Pattern 5: Economic Simulation

**Scenario:** Track settlement economy with multiple variables.

**Variables:**

```json
{
  "goldReserves": 10000,
  "monthlyIncome": 500,
  "monthlyExpenses": 300,
  "taxRate": 0.15,
  "tradeVolume": 5000
}
```

**Monthly Update Effect:**

```json
[
  {
    "op": "add",
    "path": "/variables/goldReserves",
    "value": 200
  }
]
```

(Where 200 = monthlyIncome - monthlyExpenses)

## Best Practices

### Settlement Design

**Do:**

- ✅ Start simple - Basic variables, add complexity as needed
- ✅ Use meaningful variable names
- ✅ Set sensible default values
- ✅ Track what matters to your story
- ✅ Keep settlement count manageable (5-15 major settlements)

**Don't:**

- ❌ Track everything - Only variables you'll actually use
- ❌ Over-complicate - Simple systems are easier to maintain
- ❌ Ignore structure relationships - Smithy needs ore, temple needs priests
- ❌ Create too many settlements - Quality over quantity

### Variable Management

**Guidelines:**

1. **Consistency** - Use same variable schemas for similar settlements
2. **Scaling** - Variables should scale appropriately (population in thousands, not exact counts)
3. **Boundaries** - Set min/max values for ratings (0-100, 1-20, etc.)
4. **Documentation** - Clear descriptions help future you!

**Variable Naming:**

- Use camelCase: `defenseRating`, `hasWalls`
- Be descriptive: `monthlyTaxRevenue` not `tax`
- Boolean prefix: `hasWalls`, `isUnderSiege`, `canRecruit`

### Structure Organization

**Hierarchy:**

Group similar structures:

- **Services**: Inns, taverns, shops
- **Production**: Smithies, mills, workshops
- **Religion**: Temples, shrines, monasteries
- **Military**: Barracks, towers, walls
- **Civic**: Town hall, courthouse, prison

**Progression:**

Plan structure development:

1. Start: Basic services (inn, temple, smithy)
2. Growth: Expanded services (library, market, dock)
3. Advanced: Specialized facilities (academy, cathedral, fortress)

### Maintenance

**Regular Updates:**

- Review settlement states each session
- Update variables based on downtime activities
- Track structure additions/improvements
- Note population changes

**Documentation:**

- Keep notes on settlement history
- Document major variable changes
- Record structure upgrade rationale
- Note event impacts on settlements

## Advanced Topics

### Cross-Settlement Dynamics

**Trade Networks:**

Connect settlements via trade routes:

- Variables: `tradePartners`, `tradeVolume`
- Effects: Changes in one settlement affect partners
- Conditions: Blockades prevent trade

**Political Relationships:**

Track inter-settlement politics:

- Variables: `alliancesWith`, `atWarWith`, `tradeTreaties`
- Effects: Alliance changes based on events
- Conditions: War affects defense/morale

### Dynamic Settlement Types

**Evolving Industries:**

Settlement economies can shift:

```json
{
  "primaryIndustry": "fishing",
  "secondaryIndustries": ["trade", "shipbuilding"],
  "economicDiversity": 3
}
```

Effect when mine discovered:

```json
[
  {
    "op": "replace",
    "path": "/variables/primaryIndustry",
    "value": "mining"
  },
  {
    "op": "add",
    "path": "/variables/secondaryIndustries/-",
    "value": "fishing"
  }
]
```

### Settlement Disasters

**Modeling Catastrophes:**

Track disaster impact:

**Fire Variables:**

```json
{
  "fireDamage": 40,
  "structuresDestroyed": 5,
  "rebuilding": true,
  "rebuildProgress": 20
}
```

**Recovery Effect (monthly):**

```json
[
  {
    "op": "add",
    "path": "/variables/rebuildProgress",
    "value": 10
  }
]
```

### Integration with Conditions and Effects

Settlements are powerful when combined with the condition/effect system:

**Example: Prosperity Threshold**

**Condition:**

```json
{
  "and": [
    { ">": [{ "var": "settlement.variables.morale" }, 70] },
    { ">": [{ "var": "settlement.variables.goldReserves" }, 5000] },
    { "<": [{ "var": "settlement.variables.unrest" }, 20] }
  ]
}
```

**Effect (trigger prosperity event):**

```json
[
  {
    "op": "add",
    "path": "/variables/morale",
    "value": 5
  },
  {
    "op": "add",
    "path": "/variables/population",
    "value": 100
  }
]
```

Translation: "When morale > 70, gold > 5000, and unrest < 20, settlement flourishes (morale +5, population +100)"

## Summary

### Key Takeaways

✅ **Settlements are dynamic communities** - Track population, variables, structures, and levels

✅ **Typed variables enable customization** - Define what to track for your campaign

✅ **Structures add depth** - Buildings provide services and evolve over time

✅ **Levels represent progression** - Settlements grow from hamlets to metropolises

✅ **Integration with conditions/effects** - Settlement state drives dynamic events

✅ **Keep it manageable** - Track what matters, don't over-complicate

### Quick Reference

| Task                  | Steps                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| **Create Settlement** | Map View → Add Settlement → Fill details → Define variables → Save        |
| **Add Structure**     | Select Settlement → Add Structure → Choose type → Define variables → Save |
| **Edit Variables**    | Select Entity → Edit → Modify variables → Save                            |
| **Level Up**          | Select Entity → Edit → Increase level → Save                              |
| **View Structures**   | Select Settlement → Structures section in inspector                       |

### Next Steps

Now that you understand settlement management, try:

1. **Create a test settlement** in the demo campaign
2. **Add 2-3 structures** with custom variables
3. **Create an event** that affects settlement morale
4. **Level up** the settlement after it grows
5. **Explore existing settlements** (Sandpoint, Magnimar, Korvosa)

For more advanced topics, see:

- **[Conditions and Effects Tutorial](conditions-and-effects-tutorial.md)** - Create dynamic settlement events
- **[Event Resolution Tutorial](event-resolution-tutorial.md)** - Apply effects to settlements
- **[Map Editing Tutorial](map-editing-tutorial.md)** - Place settlements geographically

**Technical Details:**

For developers or curious users who want to understand how settlements work under the hood, see:

- **Prisma Schema** - `packages/api/prisma/schema.prisma` (Settlement and Structure models)
- **Settlement Service** - `packages/api/src/settlement/settlement.service.ts`
- **Structure Service** - `packages/api/src/structure/structure.service.ts`

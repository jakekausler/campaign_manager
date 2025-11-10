# Map Editing Tutorial

This tutorial will teach you how to use the map editing tools to create and manage your campaign's geography. You'll learn how to draw regions, add locations, create settlements, and organize the spatial aspects of your world.

## Table of Contents

1. [Overview of Map Entities](#overview-of-map-entities)
2. [Getting to the Map View](#getting-to-the-map-view)
3. [Drawing Regions](#drawing-regions)
4. [Adding Locations](#adding-locations)
5. [Creating Settlements](#creating-settlements)
6. [Adding Structures](#adding-structures)
7. [Editing Existing Entities](#editing-existing-entities)
8. [Advanced Techniques](#advanced-techniques)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview of Map Entities

The Campaign Management Tool supports several types of geographic entities:

### Regions

- **What**: Large geographic areas (countries, territories, provinces, biomes)
- **Representation**: Colored polygons on the map
- **Examples**: Varisia (frontier region), Cheliax (empire), Worldwound (wasteland)
- **Use Cases**: Defining political boundaries, climate zones, cultural areas

### Locations

- **What**: Specific points of interest without a defined boundary
- **Representation**: Pin markers on the map
- **Examples**: Ancient ruins, battlefields, dungeons, landmarks, portals
- **Use Cases**: Quest locations, encounter sites, points of reference

### Settlements

- **What**: Populated places with defined boundaries
- **Representation**: City/town markers (can have polygon boundaries)
- **Examples**: Cities (Magnimar), towns (Sandpoint), villages, hamlets
- **Use Cases**: Player hubs, quest givers, resource centers, faction headquarters

### Structures

- **What**: Buildings or facilities within settlements
- **Representation**: Building markers within settlement boundaries
- **Examples**: Inns, temples, blacksmiths, guard towers, libraries
- **Use Cases**: Specific locations within settlements, upgradeable facilities

**Hierarchy**: World → Regions → Settlements → Structures
**Note**: Locations can exist independently or within regions

## Getting to the Map View

1. **Open a campaign** from the campaigns list
2. The **Map View** opens by default (or click the **Map** tab)
3. You'll see the world map with any existing geography

**Map Controls:**

- **Pan**: Click and drag to move around
- **Zoom**: Mouse wheel or pinch gesture
- **Select**: Click any entity to select it
- **Tools**: Drawing tools appear in the toolbar

> 📸 **Screenshot needed: Map View Toolbar**
>
> Show the map editing toolbar with all drawing tools visible: "Draw Region", "Add Location", "Add Settlement", "Add Structure", and selection/pan tools. Annotate each tool button with labels explaining its function. Include zoom controls and layer toggles.

## Drawing Regions

Regions are the foundation of your world's geography. They define large areas with distinct characteristics.

### Creating a New Region

**Step 1: Activate the Draw Tool**

1. Click the **"Draw Region"** button in the map toolbar
2. Your cursor changes to a crosshair
3. The map is now in drawing mode

**Step 2: Draw the Polygon**

1. **Click points** on the map to define the region boundary
2. Each click adds a vertex (corner point)
3. **Move your mouse** to see the shape preview
4. **Double-click** or **click the first point again** to close the polygon

> 📸 **Screenshot needed: Drawing a Region (In Progress)**
>
> Show the map in drawing mode with a region polygon partially drawn (4-5 vertices placed, preview line showing next potential segment). Highlight the crosshair cursor, existing vertices (small circles), and the preview shape. Show feedback like vertex count or area estimation if available.

**Tips for Drawing:**

- Start with rough shapes, you can refine later
- Use 4-8 points for simple regions
- Use more points for complex coastlines or irregular borders
- Don't worry about perfect accuracy initially

**Step 3: Fill in Details**

Once you close the polygon, the **Entity Inspector** opens:

1. **Name**: Give your region a name (e.g., "Northern Highlands")
2. **Description**: Describe the region's characteristics:
   - Terrain type (mountains, forests, plains, desert, etc.)
   - Climate (temperate, tropical, arctic, etc.)
   - Notable features (rivers, landmarks, dangers)
   - Cultural information (who lives here, what factions control it)

3. **Variables** (optional): Add custom data fields
   - Control level (who governs this region)
   - Danger rating
   - Resources available
   - Any game-specific attributes

4. Click **"Save"**

**Example Region Entry:**

```
Name: The Frostpeak Range
Description: A treacherous mountain range covered in eternal snow.
Home to frost giants, white dragons, and hardy dwarven clans.
The highest peak, Mount Karag, reaches above the clouds and is
said to house an ancient observatory.

Variables:
- danger_level: "high"
- primary_inhabitants: "giants, dragons, dwarves"
- climate: "arctic"
```

### Drawing Tips for Regions

**Coastal Regions:**

- Start from the coastline and work inland
- Use more points for detailed coastlines
- Consider using the water as a natural boundary

**Adjacent Regions:**

- Draw borders carefully so they align with neighboring regions
- Slight overlaps are acceptable but avoid large gaps
- Consider zooming in for precise border placement

**Large Regions:**

- Zoom out to see the full area
- Use fewer points for smoother, simpler shapes
- You can always subdivide later into smaller regions

## Adding Locations

Locations are point markers for specific places of interest that don't need defined boundaries.

### Creating a New Location

**Step 1: Activate the Add Location Tool**

1. Click the **"Add Location"** button in the toolbar
2. Your cursor changes to a placement crosshair

**Step 2: Place the Location**

1. **Click** on the map where you want the location
2. A pin marker appears
3. The **Entity Inspector** opens

**Step 3: Fill in Details**

1. **Name**: The location's name (e.g., "Thistletop", "Old Light Ruins")
2. **Type**: Select a location type:
   - Dungeon
   - Ruins
   - Landmark
   - Battlefield
   - Portal
   - Camp
   - Other/Custom

3. **Description**: Describe what's here:
   - Physical description
   - History or lore
   - Current state (abandoned, active, dangerous, etc.)
   - What players might find here

4. **Parent Region** (optional): Assign to a region if applicable
5. **Coordinates**: Auto-filled from where you clicked (can adjust)
6. Click **"Save"**

**Example Location Entry:**

```
Name: The Sundered Tower
Type: Ruins
Parent Region: Northern Highlands
Description: A crumbling wizard's tower split in half by lightning
centuries ago. The upper floors are exposed to the elements, but
the basement levels remain intact. Local legends speak of a magical
library still preserved in the depths.
```

### Location Placement Tips

**Visibility:**

- Locations appear as pins/markers on the map
- Zoom level affects marker size and visibility
- Select appropriate icons for different location types

**Organization:**

- Group related locations (e.g., dungeon entrances, quest sites)
- Use naming conventions (e.g., "Varisia - Thistletop")
- Tag locations with custom variables for filtering

**Quest Integration:**

- Link locations to events and encounters
- Track which locations have been discovered
- Mark cleared/completed locations

## Creating Settlements

Settlements are populated places where NPCs live and players can interact with civilization.

### Creating a New Settlement

**Step 1: Activate the Add Settlement Tool**

1. Click the **"Add Settlement"** button in the toolbar
2. Your cursor changes to a placement crosshair

**Step 2: Place the Settlement**

1. **Click** on the map where you want the settlement
2. A settlement marker appears
3. The **Entity Inspector** opens

**Step 3: Fill in Basic Details**

1. **Name**: Settlement name (e.g., "Ravengro", "Port Shaw")
2. **Type**: Select settlement size/type:
   - **Metropolis**: 25,000+ inhabitants
   - **City**: 5,000-25,000 inhabitants
   - **Town**: 1,000-5,000 inhabitants
   - **Village**: 100-1,000 inhabitants
   - **Hamlet**: Less than 100 inhabitants

3. **Population**: Current population count
4. **Description**: Describe the settlement:
   - General appearance and atmosphere
   - Economic base (farming, trading, mining, etc.)
   - Notable features or landmarks
   - Reputation or character

5. **Parent Region**: Assign to a region if applicable
6. **Coordinates**: Auto-filled (can adjust)

**Step 4: Configure Settlement Variables**

Settlements can track various attributes using **typed variables**:

**Common Variables:**

- **Economy**: Gold reserves, trade volume, primary exports
- **Defense**: Walls, guards, military strength
- **Morale**: Population happiness, loyalty to leadership
- **Resources**: Food, water, building materials
- **Reputation**: Fame, infamy, standing with factions

**Example Settlement Entry:**

```
Name: Ironforge
Type: Town
Population: 2,500
Parent Region: Northern Highlands
Description: A fortified mining town built into the mountainside.
Known for exceptional metalwork and strong defensive walls. The
town is governed by a council of master smiths.

Variables:
- gold_reserves: 50000
- defense_rating: 8
- morale: 75
- primary_export: "iron and steel weapons"
- reputation_dwarves: "excellent"
```

**Step 5: Save**

Click **"Save"** to create the settlement.

### Settlement Boundaries (Optional)

Some settlements may have defined boundaries (city walls, territory):

1. **After creating the settlement**, select it
2. Click **"Edit Boundary"** in the Entity Inspector
3. **Draw a polygon** around the settlement (same as drawing regions)
4. **Save** the boundary

This is useful for:

- Walled cities with clear borders
- Tracking settlement expansion over time
- Defining areas of influence

## Adding Structures

Structures are buildings or facilities within settlements. They add detail and provide locations for specific activities.

### Creating a New Structure

**Step 1: Select the Parent Settlement**

1. Click on a settlement to select it
2. The Entity Inspector shows settlement details

**Step 2: Add Structure**

1. In the Entity Inspector, click **"Add Structure"** button
2. Or use the **"Add Structure"** tool in the toolbar and click within the settlement

**Step 3: Fill in Details**

1. **Name**: Structure name (e.g., "The Rusty Dragon Inn", "Cathedral of Desna")
2. **Type**: Select structure type:
   - Inn/Tavern
   - Temple/Shrine
   - Shop/Market
   - Smithy/Craftsman
   - Guard Tower/Barracks
   - Library/Academy
   - Government Building
   - Residence
   - Other/Custom

3. **Description**: Describe the structure:
   - Physical appearance
   - Who runs it (NPC names)
   - Services offered
   - Atmosphere and reputation

4. **Structure Variables** (optional):
   - Level/tier (quality or upgrade level)
   - Capacity
   - Services available
   - Special features

5. **Parent Settlement**: Auto-filled if you selected settlement first
6. Click **"Save"**

**Example Structure Entry:**

```
Name: The Gilded Hammer
Type: Smithy
Parent Settlement: Ironforge
Description: Master smith Durgan Ironheart's renowned smithy.
Specializes in masterwork weapons and armor. The forge uses a
magical flame that never goes out, gift from an ancient fire elemental.

Variables:
- quality_level: "masterwork"
- specialty: "weapons and armor"
- owner: "Durgan Ironheart"
- services: ["repair", "custom_orders", "enchanting"]
```

### Structure Organization Tips

**Grouping:**

- Create districts within large settlements
- Use naming conventions (e.g., "Market District - ", "Noble Quarter - ")
- Tag structures by function for easy filtering

**Leveling/Progression:**

- Use level variables to track structure upgrades
- Link structure improvements to events
- Track construction progress with variables

## Editing Existing Entities

You can modify any geographic entity after creation.

### Editing Properties

1. **Select** the entity by clicking it
2. **Entity Inspector** opens showing current details
3. Click the **"Edit"** button
4. **Modify** any fields (name, description, variables, etc.)
5. Click **"Save"**

### Moving Entities

**Locations and Settlements:**

1. Select the entity
2. Click **"Move"** in the Entity Inspector
3. Click the new position on the map
4. Confirm the move

**Note**: Regions cannot be moved, but you can edit their geometry.

### Editing Region Geometry

1. Select the region
2. Click **"Edit Geometry"** in the Entity Inspector
3. **Drag vertices** to reshape the polygon
4. **Add vertices**: Click on an edge to add a new point
5. **Remove vertices**: Click on a vertex and press Delete
6. Click **"Save"** when finished

### Deleting Entities

1. Select the entity
2. Click **"Delete"** in the Entity Inspector
3. **Confirm** the deletion

**Warning**: Deleting entities with dependencies (e.g., a settlement with structures) will require confirmation and may cascade delete related entities.

## Advanced Techniques

### Multi-Region Editing

**Creating Complex Borders:**

1. Draw one region completely
2. Draw adjacent region, aligning borders carefully
3. Zoom in for precise vertex placement
4. Use grid/snap if available

**Regional Evolution:**

- Create multiple versions of a region showing border changes over time
- Use branches to show alternate territorial outcomes
- Link region changes to events (e.g., "Treaty of Ironforge" event)

### Layer Management

**Organizing Complex Maps:**

- Use visibility toggles to show/hide entity types
- Filter by region, type, or custom tags
- Create custom views for different zoom levels

### Geographic Variables

**Dynamic Geography:**

- Track seasonal changes (e.g., "winter_accessible": false)
- Model resource depletion (mining region exhausted)
- Track corruption or magical effects on terrain

**Example Dynamic Region:**

```
Name: The Blighted Marsh
Variables:
- corruption_level: 45  (increases over time)
- traversable: true     (becomes false at corruption 75+)
- danger_rating: "medium"  (increases with corruption)
```

### Integration with Events

**Event-Driven Geography:**

- Create events that modify region variables
- Link settlement growth to event outcomes
- Track structure construction via events

**Example:**

- Event: "Great Fire of Ironforge"
- Effect: Reduces settlement morale, damages structures
- Creates reconstruction events and structure repairs

## Best Practices

### Planning Your Map

**Before You Start:**

- Sketch your world on paper or digital tool first
- Identify major regions and their relationships
- Determine settlement locations and hierarchy
- Plan trade routes and connections

**Start Big, Then Refine:**

1. Draw major regions first
2. Add capital cities and major settlements
3. Fill in smaller towns and villages
4. Add locations and structures as needed
5. Refine borders and details over time

### Naming Conventions

**Consistency Matters:**

- Use consistent naming patterns (e.g., "The [Adjective] [Noun]")
- Consider language/culture in region names
- Use descriptive names for locations ("Ancient Tower" vs "Tower #3")

**Organization:**

- Prefix entities by region for easy sorting
- Use tags or custom variables for categorization
- Create a naming guide for your world

### Scale and Detail

**Appropriate Detail Levels:**

- **World Map**: Major regions, capital cities only
- **Regional Map**: All settlements, major locations
- **Local Map**: All structures, minor locations, detailed boundaries

**Avoid Over-Detailing:**

- Only create entities that matter to your campaign
- Add details as they become relevant
- Don't map every building unless it serves the story

### Geographic Realism

**Consider:**

- **Terrain**: Mountains, rivers, coastlines affect settlement placement
- **Resources**: Settlements near resources (water, ore, farmland)
- **Trade**: Roads and routes connect settlements logically
- **Defense**: Important settlements have natural or built defenses
- **Climate**: Regions have appropriate vegetation and conditions

### Version Control

**Track Changes:**

- Use events to document geographic changes
- Create branches for alternate map states
- Note major changes in region descriptions
- Link map updates to campaign timeline

## Troubleshooting

### Common Issues

**Problem: Can't close a region polygon**

- **Solution**: Double-click the last point or click the first point again
- Ensure you have at least 3 points

**Problem: Region overlaps incorrectly**

- **Solution**: Edit geometry to adjust borders
- Use zoom for precise vertex placement
- Consider if overlap is intended (disputed territory)

**Problem: Settlement not appearing on map**

- **Solution**: Check zoom level (may be hidden at current zoom)
- Verify coordinates are within visible area
- Check if entity type visibility is toggled on

**Problem: Can't add structure to settlement**

- **Solution**: Select settlement first, then add structure
- Verify structure placement is within settlement boundary
- Check permissions (admin access may be required)

**Problem: Lost/misplaced entity**

- **Solution**: Use search or filter to find entity
- Check entity list view for coordinates
- Use "Zoom to Entity" feature if available

### Performance Tips

**Large Maps:**

- Use region visibility toggles to reduce rendered entities
- Simplify region polygons (fewer vertices)
- Limit structures to major/relevant buildings only
- Consider separating very large maps into multiple campaigns

**Slow Editing:**

- Close Entity Inspector when not needed
- Reduce map layers/overlays
- Clear browser cache if map tiles are slow to load

---

**Next Steps:**

Now that you understand map editing, explore these related tutorials:

- **[Settlement Management Tutorial](settlement-management-tutorial.md)**: Deep dive into settlement variables, structures, and progression
- **[Event Resolution Tutorial](event-resolution-tutorial.md)**: Learn how events can modify geography and settlements
- **[Conditions & Effects Tutorial](conditions-and-effects-tutorial.md)**: Create dynamic rules that respond to geographic changes

**Practice Exercise:**

Try creating a simple campaign map:

1. Create a region representing a kingdom
2. Add 3 settlements (1 city capital, 2 towns)
3. Add 5 locations (dungeons, ruins, landmarks)
4. Add 3 structures to the capital (inn, temple, marketplace)
5. Link them with events and encounters

Happy mapping! 🗺️

/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing.
 * Run with: pnpm --filter @campaign/api prisma:seed
 */

import { PrismaClient } from '@prisma/client';

import { createLocationWithGeometry } from '../src/database/spatial.helpers';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin role with permissions
  console.log('Creating roles and permissions...');
  const adminRole = await prisma.role.create({
    data: {
      name: 'admin',
      description: 'Administrator with full access',
    },
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'user',
      description: 'Regular user with limited access',
    },
  });

  // Create permissions
  const permissions = await Promise.all([
    prisma.permission.create({
      data: {
        name: 'campaign:create',
        resource: 'campaign',
        action: 'create',
        description: 'Create new campaigns',
      },
    }),
    prisma.permission.create({
      data: {
        name: 'campaign:read',
        resource: 'campaign',
        action: 'read',
        description: 'View campaigns',
      },
    }),
    prisma.permission.create({
      data: {
        name: 'campaign:update',
        resource: 'campaign',
        action: 'update',
        description: 'Update campaigns',
      },
    }),
    prisma.permission.create({
      data: {
        name: 'campaign:delete',
        resource: 'campaign',
        action: 'delete',
        description: 'Delete campaigns',
      },
    }),
  ]);

  // Assign all permissions to admin role
  await prisma.role.update({
    where: { id: adminRole.id },
    data: {
      permissions: {
        connect: permissions.map((p) => ({ id: p.id })),
      },
    },
  });

  // Assign read permission to user role
  await prisma.role.update({
    where: { id: userRole.id },
    data: {
      permissions: {
        connect: [{ id: permissions[1].id }], // read only
      },
    },
  });

  // Create sample admin user
  console.log('Creating users...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@campaign.local',
      name: 'Admin User',
      password: '$2b$10$example.hash.here', // In production, use bcrypt.hash()
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });

  // Create sample regular user
  await prisma.user.create({
    data: {
      email: 'user@campaign.local',
      name: 'Regular User',
      password: '$2b$10$example.hash.here',
      roles: {
        create: {
          roleId: userRole.id,
        },
      },
    },
  });

  // Create sample world with custom calendar
  console.log('Creating sample world...');
  const world = await prisma.world.create({
    data: {
      name: 'Golarion',
      calendars: {
        calendars: [
          {
            id: 'absalom-reckoning',
            name: 'Absalom Reckoning',
            monthsPerYear: 12,
            daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
            monthNames: [
              'Abadius',
              'Calistril',
              'Pharast',
              'Gozran',
              'Desnus',
              'Sarenith',
              'Erastus',
              'Arodus',
              'Rova',
              'Lamashan',
              'Neth',
              'Kuthona',
            ],
            epoch: '4700-01-01T00:00:00Z',
            notes: 'The standard calendar of Golarion',
          },
        ],
      },
      settings: {},
    },
  });

  // Create regions with geographic boundaries
  console.log('Creating regions...');

  // Varisia - Coastal frontier region with temperate forests and coastline
  const regionVarisia = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'region',
    name: 'Varisia',
    description:
      'A wild frontier land of ancient ruins, dense forests, and rugged coastline. Home to the city-states of Magnimar, Korvosa, and the small town of Sandpoint.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0], // Northwest corner (coast)
          [500000, 0], // Northeast corner
          [500000, -400000], // Southeast corner
          [0, -400000], // Southwest corner (coast)
          [0, 0], // Close the ring
        ],
      ],
    },
  });

  // Cheliax - Devil-ruled empire with plains and hills
  const regionCheliax = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'region',
    name: 'Cheliax',
    description:
      'A diabolic empire ruled by House Thrune with infernal pacts. Known for its strict laws, urban centers like Westcrown and Egorian, and plains dotted with fortified cities.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [500000, -400000], // Northwest corner
          [1000000, -400000], // Northeast corner
          [1000000, -900000], // Southeast corner
          [500000, -900000], // Southwest corner
          [500000, -400000], // Close the ring
        ],
      ],
    },
  });

  // Worldwound - Demon-infested wasteland with corrupted terrain
  const worldwound = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'region',
    name: 'Worldwound',
    description:
      'A demon-blighted wasteland where reality itself is torn. Corrupted terrain, abyssal portals, and hordes of demons make this the most dangerous region on Golarion.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [500000, 400000], // Northwest corner
          [800000, 500000], // Northeast corner (irregular border)
          [850000, 300000], // Southeast corner
          [600000, 350000], // Southwest corner (irregular border)
          [500000, 400000], // Close the ring
        ],
      ],
    },
  });

  // Osirion - Desert region with ancient pyramids
  const regionOsirion = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'region',
    name: 'Osirion',
    description:
      'An ancient desert kingdom filled with tombs, pyramids, and forgotten pharaonic magic. Sandy dunes, the River Sphinx, and scorching sun define this land.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [1200000, -200000], // Northwest corner
          [1800000, -200000], // Northeast corner
          [1800000, -700000], // Southeast corner
          [1200000, -700000], // Southwest corner
          [1200000, -200000], // Close the ring
        ],
      ],
    },
  });

  // Mwangi Expanse - Tropical jungle region
  const mwangi = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'region',
    name: 'Mwangi Expanse',
    description:
      'A vast tropical jungle filled with ancient civilizations, lost cities, and exotic creatures. Dense rainforests, steamy swamps, and hidden temples abound.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [1000000, -900000], // Northwest corner
          [1600000, -900000], // Northeast corner
          [1600000, -1400000], // Southeast corner
          [1000000, -1400000], // Southwest corner
          [1000000, -900000], // Close the ring
        ],
      ],
    },
  });

  console.log(`✓ Created ${5} regions: Varisia, Cheliax, Worldwound, Osirion, Mwangi Expanse`);

  // Create locations distributed across regions
  console.log('Creating locations across regions...');

  // Varisia locations (7 locations: cities, dungeons, landmarks)
  const sandpoint = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Sandpoint',
    description: 'A small coastal town, gateway to adventure in Varisia',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [100000, -50000],
    },
  });

  const magnimar = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Magnimar',
    description: 'The City of Monuments, a major trade hub in southern Varisia',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [150000, -250000],
    },
  });

  const korvosa = await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Korvosa',
    description: 'A militaristic city-state ruled by a corrupt monarchy',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [400000, -100000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Thistletop',
    description: 'A goblin fortress on a coastal island, site of ancient Thassilonian ruins',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [80000, -30000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Runeforge',
    description: 'An extradimensional complex created by Runelord Karzoug',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [300000, -150000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'The Storval Stairs',
    description: 'Ancient carved stairs ascending the Storval Plateau',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [350000, -50000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Whistledown',
    description: 'A small gnome settlement known for its eccentric inventors',
    parentLocationId: regionVarisia.id as string,
    geometry: {
      type: 'Point',
      coordinates: [200000, -180000],
    },
  });

  // Cheliax locations (5 locations: major cities and fortifications)
  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Westcrown',
    description: 'The former capital of Cheliax, now a shadow of its former glory',
    parentLocationId: regionCheliax.id as string,
    geometry: {
      type: 'Point',
      coordinates: [650000, -550000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Egorian',
    description: 'The diabolic capital of Cheliax, seat of House Thrune',
    parentLocationId: regionCheliax.id as string,
    geometry: {
      type: 'Point',
      coordinates: [800000, -650000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Citadel Rivad',
    description: 'A massive fortress guarding the northern border',
    parentLocationId: regionCheliax.id as string,
    geometry: {
      type: 'Point',
      coordinates: [700000, -450000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Corentyn',
    description: 'A port city and naval base on the Inner Sea',
    parentLocationId: regionCheliax.id as string,
    geometry: {
      type: 'Point',
      coordinates: [900000, -700000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Taggun Hold',
    description: 'A fortified mining town in the Aspodell Mountains',
    parentLocationId: regionCheliax.id as string,
    geometry: {
      type: 'Point',
      coordinates: [550000, -800000],
    },
  });

  // Worldwound locations (4 locations: corrupted sites and battlefields)
  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Drezen',
    description: 'A reclaimed crusader fortress, headquarters of demon hunters',
    parentLocationId: worldwound.id as string,
    geometry: {
      type: 'Point',
      coordinates: [650000, 420000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'The Wounded Lands',
    description: 'Ground zero of the demonic incursion, reality itself is torn here',
    parentLocationId: worldwound.id as string,
    geometry: {
      type: 'Point',
      coordinates: [700000, 470000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Iz',
    description: 'A city consumed by the Abyss, now a demon stronghold',
    parentLocationId: worldwound.id as string,
    geometry: {
      type: 'Point',
      coordinates: [750000, 450000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Raliscrad',
    description: 'The Sarkorian God-Caller city, site of a major crusader victory',
    parentLocationId: worldwound.id as string,
    geometry: {
      type: 'Point',
      coordinates: [600000, 380000],
    },
  });

  // Osirion locations (5 locations: desert cities and ancient tombs)
  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Sothis',
    description: 'The capital of Osirion, city of the Ruby Prince',
    parentLocationId: regionOsirion.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1500000, -450000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Wati',
    description: 'The Half-City, half ruins and half living metropolis',
    parentLocationId: regionOsirion.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1350000, -350000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'An-Alak',
    description: 'An ancient pyramid city lost beneath the sands',
    parentLocationId: regionOsirion.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1600000, -550000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Tephu',
    description: 'A university city dedicated to studying ancient Osirion',
    parentLocationId: regionOsirion.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1400000, -500000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'The Slave Trenches of Hakotep',
    description: 'Cursed excavation site haunted by undead laborers',
    parentLocationId: regionOsirion.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1700000, -600000],
    },
  });

  // Mwangi Expanse locations (4 locations: jungle cities and lost ruins)
  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Kibwe',
    description: 'A major port and trading hub on the edge of the jungle',
    parentLocationId: mwangi.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1200000, -1100000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Mzali',
    description: 'An ancient city ruled by a sun-worshipping theocracy',
    parentLocationId: mwangi.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1350000, -1150000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Saventh-Yhi',
    description: 'The legendary City of Seven Spears, lost in the jungle',
    parentLocationId: mwangi.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1450000, -1250000],
    },
  });

  await createLocationWithGeometry(prisma, {
    worldId: world.id,
    type: 'point',
    name: 'Usaro',
    description: 'A city of intelligent apes, forbidden to outsiders',
    parentLocationId: mwangi.id as string,
    geometry: {
      type: 'Point',
      coordinates: [1300000, -1300000],
    },
  });

  console.log(
    `✓ Created ${25} locations across all regions (Varisia: 7, Cheliax: 5, Worldwound: 4, Osirion: 5, Mwangi: 4)`
  );

  // Create sample campaign
  console.log('Creating sample campaign...');
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Rise of the Runelords',
      worldId: world.id,
      ownerId: adminUser.id,
      currentWorldTime: new Date('4707-03-15T12:00:00Z'), // Start mid-day in Pharast (March) 4707 AR
      settings: {
        difficulty: 'normal',
        startDate: '4707-01-01',
      },
      isActive: true,
    },
  });

  // Create main branch for campaign
  console.log('Creating main branch...');
  await prisma.branch.create({
    data: {
      campaignId: campaign.id,
      name: 'main',
      description: 'Main campaign timeline',
    },
  });

  // Create kingdoms
  console.log('Creating kingdoms...');

  const kingdomVarisia = await prisma.kingdom.create({
    data: {
      campaignId: campaign.id,
      name: 'Varisia',
      level: 2,
      variableSchemas: [
        {
          name: 'treasury',
          type: 'number',
          description: 'Kingdom treasury in gold pieces',
          defaultValue: 0,
        },
        {
          name: 'stability',
          type: 'enum',
          enumValues: ['stable', 'unstable', 'chaotic', 'tyrannical'],
          description: 'Political stability of the kingdom',
          defaultValue: 'stable',
        },
        {
          name: 'population',
          type: 'number',
          description: 'Total population across all settlements',
          defaultValue: 0,
        },
        {
          name: 'governmentType',
          type: 'string',
          description: 'Type of government structure',
        },
      ],
    },
  });

  const kingdomCheliax = await prisma.kingdom.create({
    data: {
      campaignId: campaign.id,
      name: 'Cheliax',
      level: 5,
      variables: {
        treasury: 500000,
        stability: 'tyrannical',
        population: 2000000,
        governmentType: 'empire',
      },
      variableSchemas: [
        {
          name: 'treasury',
          type: 'number',
          description: 'Kingdom treasury in gold pieces',
          defaultValue: 0,
        },
        {
          name: 'stability',
          type: 'enum',
          enumValues: ['stable', 'unstable', 'chaotic', 'tyrannical'],
          description: 'Political stability of the kingdom',
          defaultValue: 'stable',
        },
        {
          name: 'population',
          type: 'number',
          description: 'Total population across all settlements',
          defaultValue: 0,
        },
        {
          name: 'governmentType',
          type: 'string',
          description: 'Type of government structure',
        },
      ],
    },
  });

  const kingdomOsirion = await prisma.kingdom.create({
    data: {
      campaignId: campaign.id,
      name: 'Osirion',
      level: 4,
      variables: {
        treasury: 200000,
        stability: 'stable',
        population: 850000,
        governmentType: 'monarchy',
      },
      variableSchemas: [
        {
          name: 'treasury',
          type: 'number',
          description: 'Kingdom treasury in gold pieces',
          defaultValue: 0,
        },
        {
          name: 'stability',
          type: 'enum',
          enumValues: ['stable', 'unstable', 'chaotic', 'tyrannical'],
          description: 'Political stability of the kingdom',
          defaultValue: 'stable',
        },
        {
          name: 'population',
          type: 'number',
          description: 'Total population across all settlements',
          defaultValue: 0,
        },
        {
          name: 'governmentType',
          type: 'string',
          description: 'Type of government structure',
        },
      ],
    },
  });

  console.log(`✓ Created ${3} kingdoms: Varisia, Cheliax, Osirion`);

  // Create settlements with typed variable schemas
  console.log('Creating settlements...');

  // Settlements demonstrate level progression (1-5):
  // - Level 1: Small village/town (population < 2000)
  // - Level 2: Large town (population 2000-5000)
  // - Level 3: Small city (population 5000-15000)
  // - Level 4: City (population 15000-40000)
  // - Level 5: Metropolis (population 40000+)
  //
  // Variables scale with level: population, defense, walls, market size, militia
  // Structures within settlements should have levels <= parent settlement level

  // Varisia settlements (4 settlements - demonstrating levels 1, 2, 4, 5)
  await prisma.settlement.create({
    data: {
      kingdomId: kingdomVarisia.id,
      locationId: sandpoint.id as string,
      name: 'Sandpoint',
      level: 1,
      variables: {
        population: 1500,
        defenseRating: 8,
        hasWalls: false,
        primaryIndustry: 'fishing',
        marketSize: 'small',
        militiaSize: 50,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.settlement.create({
    data: {
      kingdomId: kingdomVarisia.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Whistledown', worldId: world.id },
        })
      ).id,
      name: 'Whistledown',
      level: 2,
      variables: {
        population: 3200,
        defenseRating: 10,
        hasWalls: false,
        primaryIndustry: 'crafts',
        marketSize: 'medium',
        militiaSize: 120,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.settlement.create({
    data: {
      kingdomId: kingdomVarisia.id,
      locationId: magnimar.id as string,
      name: 'Magnimar',
      level: 4,
      variables: {
        population: 16000,
        defenseRating: 15,
        hasWalls: true,
        primaryIndustry: 'trade',
        marketSize: 'large',
        militiaSize: 1200,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.settlement.create({
    data: {
      kingdomId: kingdomVarisia.id,
      locationId: korvosa.id as string,
      name: 'Korvosa',
      level: 5,
      variables: {
        population: 18000,
        defenseRating: 18,
        hasWalls: true,
        primaryIndustry: 'trade',
        marketSize: 'large',
        militiaSize: 1500,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  // Cheliax settlements (3 settlements)
  await prisma.settlement.create({
    data: {
      kingdomId: kingdomCheliax.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Westcrown', worldId: world.id },
        })
      ).id,
      name: 'Westcrown',
      level: 4,
      variables: {
        population: 35000,
        defenseRating: 16,
        hasWalls: true,
        primaryIndustry: 'trade',
        marketSize: 'large',
        militiaSize: 2000,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.settlement.create({
    data: {
      kingdomId: kingdomCheliax.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Egorian', worldId: world.id },
        })
      ).id,
      name: 'Egorian',
      level: 5,
      variables: {
        population: 55000,
        defenseRating: 20,
        hasWalls: true,
        primaryIndustry: 'magic',
        marketSize: 'metropolis',
        militiaSize: 3500,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.settlement.create({
    data: {
      kingdomId: kingdomCheliax.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Corentyn', worldId: world.id },
        })
      ).id,
      name: 'Corentyn',
      level: 3,
      variables: {
        population: 12000,
        defenseRating: 14,
        hasWalls: true,
        primaryIndustry: 'trade',
        marketSize: 'medium',
        militiaSize: 800,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  // Osirion settlements (2 settlements)
  await prisma.settlement.create({
    data: {
      kingdomId: kingdomOsirion.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Sothis', worldId: world.id },
        })
      ).id,
      name: 'Sothis',
      level: 5,
      variables: {
        population: 110000,
        defenseRating: 19,
        hasWalls: true,
        primaryIndustry: 'trade',
        marketSize: 'metropolis',
        militiaSize: 5000,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.settlement.create({
    data: {
      kingdomId: kingdomOsirion.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Wati', worldId: world.id },
        })
      ).id,
      name: 'Wati',
      level: 3,
      variables: {
        population: 8500,
        defenseRating: 12,
        hasWalls: true,
        primaryIndustry: 'trade',
        marketSize: 'medium',
        militiaSize: 450,
      },
      variableSchemas: [
        {
          name: 'population',
          type: 'number',
          description: 'Settlement population',
          defaultValue: 0,
        },
        {
          name: 'defenseRating',
          type: 'number',
          description: 'Defense rating (1-20)',
          defaultValue: 5,
        },
        {
          name: 'hasWalls',
          type: 'boolean',
          description: 'Whether settlement has defensive walls',
          defaultValue: false,
        },
        {
          name: 'primaryIndustry',
          type: 'enum',
          enumValues: ['agriculture', 'fishing', 'mining', 'trade', 'crafts', 'magic'],
          description: 'Primary economic industry',
          defaultValue: 'agriculture',
        },
        {
          name: 'marketSize',
          type: 'enum',
          enumValues: ['small', 'medium', 'large', 'metropolis'],
          description: 'Size of the marketplace',
          defaultValue: 'small',
        },
        {
          name: 'militiaSize',
          type: 'number',
          description: 'Size of the local militia/guard',
          defaultValue: 0,
        },
      ],
    },
  });

  console.log(`✓ Created ${9} settlements across 3 kingdoms (Varisia: 4, Cheliax: 3, Osirion: 2)`);

  // Create structures across settlements
  console.log('Creating structures across settlements...');

  // Fetch all settlements to get their IDs
  const sandpointSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Sandpoint', kingdomId: kingdomVarisia.id },
  });
  const magnimarSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Magnimar', kingdomId: kingdomVarisia.id },
  });
  const korvosaSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Korvosa', kingdomId: kingdomVarisia.id },
  });
  const westcrownSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Westcrown', kingdomId: kingdomCheliax.id },
  });
  const egorianSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Egorian', kingdomId: kingdomCheliax.id },
  });
  const corentynSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Corentyn', kingdomId: kingdomCheliax.id },
  });
  const sothisSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Sothis', kingdomId: kingdomOsirion.id },
  });
  const watiSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Wati', kingdomId: kingdomOsirion.id },
  });

  // Structures demonstrate level progression (1-5):
  // - Levels align with or are lower than parent settlement level
  // - Higher-level structures have larger scale and more advanced features
  // - Variables demonstrate progression: clergy count, garrison size, student capacity, etc.

  // Sandpoint structures (level 1 settlement - 2 structures)
  await prisma.structure.create({
    data: {
      settlementId: sandpointSettlement.id,
      type: 'temple',
      name: 'Cathedral of Desna',
      level: 1,
      variables: {
        deity: 'Desna',
        clergy: 3,
        isActive: true,
      },
      variableSchemas: [
        {
          name: 'deity',
          type: 'string',
          description: 'Primary deity worshipped',
        },
        {
          name: 'clergy',
          type: 'number',
          description: 'Number of clergy members',
          defaultValue: 1,
        },
        {
          name: 'isActive',
          type: 'boolean',
          description: 'Whether temple is actively conducting services',
          defaultValue: true,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: sandpointSettlement.id,
      type: 'inn',
      name: 'The Rusty Dragon',
      level: 1,
      variables: {
        rooms: 12,
        innkeeper: 'Ameiko Kaijitsu',
        pricePerNight: 5,
      },
      variableSchemas: [
        {
          name: 'rooms',
          type: 'number',
          description: 'Number of available rooms',
          defaultValue: 5,
        },
        {
          name: 'innkeeper',
          type: 'string',
          description: 'Name of the innkeeper',
        },
        {
          name: 'pricePerNight',
          type: 'number',
          description: 'Price per room per night in gold',
          defaultValue: 5,
        },
      ],
    },
  });

  // Whistledown structures (level 2 settlement - 2 structures)
  const whistledownSettlement = await prisma.settlement.findFirstOrThrow({
    where: { name: 'Whistledown', kingdomId: kingdomVarisia.id },
  });

  await prisma.structure.create({
    data: {
      settlementId: whistledownSettlement.id,
      type: 'workshop',
      name: 'Cogwhisper Inventors Guild',
      level: 2,
      variables: {
        inventors: 15,
        specialization: 'clockwork',
        patentsRegistered: 47,
      },
      variableSchemas: [
        {
          name: 'inventors',
          type: 'number',
          description: 'Number of active inventors',
          defaultValue: 5,
        },
        {
          name: 'specialization',
          type: 'string',
          description: 'Primary invention specialization',
        },
        {
          name: 'patentsRegistered',
          type: 'number',
          description: 'Number of registered patents/inventions',
          defaultValue: 0,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: whistledownSettlement.id,
      type: 'market',
      name: "Tinker's Bazaar",
      level: 2,
      variables: {
        stalls: 45,
        merchantGuilds: 3,
        marketDays: 'Fireday, Starday',
      },
      variableSchemas: [
        {
          name: 'stalls',
          type: 'number',
          description: 'Number of market stalls',
          defaultValue: 20,
        },
        {
          name: 'merchantGuilds',
          type: 'number',
          description: 'Number of registered merchant guilds',
          defaultValue: 1,
        },
        {
          name: 'marketDays',
          type: 'string',
          description: 'Days when market is open (comma-separated)',
        },
      ],
    },
  });

  // Magnimar structures (level 4 settlement - 3 structures)
  await prisma.structure.create({
    data: {
      settlementId: magnimarSettlement.id,
      type: 'market',
      name: 'The Bazaar of Sails',
      level: 4,
      variables: {
        stalls: 150,
        merchantGuilds: 8,
        marketDays: 'Moonday, Wealday, Fireday',
      },
      variableSchemas: [
        {
          name: 'stalls',
          type: 'number',
          description: 'Number of market stalls',
          defaultValue: 20,
        },
        {
          name: 'merchantGuilds',
          type: 'number',
          description: 'Number of registered merchant guilds',
          defaultValue: 1,
        },
        {
          name: 'marketDays',
          type: 'string',
          description: 'Days when market is open (comma-separated)',
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: magnimarSettlement.id,
      type: 'library',
      name: "The Founder's Archive",
      level: 3,
      variables: {
        volumes: 8000,
        specialCollections: 3,
        isPublic: true,
      },
      variableSchemas: [
        {
          name: 'volumes',
          type: 'number',
          description: 'Number of books and scrolls',
          defaultValue: 100,
        },
        {
          name: 'specialCollections',
          type: 'number',
          description: 'Number of special/rare collections',
          defaultValue: 0,
        },
        {
          name: 'isPublic',
          type: 'boolean',
          description: 'Whether library is open to public',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: magnimarSettlement.id,
      type: 'guild_hall',
      name: 'Seafarers Guild Hall',
      level: 4,
      variables: {
        members: 450,
        guildType: 'maritime',
        charterYear: 4602,
      },
      variableSchemas: [
        {
          name: 'members',
          type: 'number',
          description: 'Number of guild members',
          defaultValue: 10,
        },
        {
          name: 'guildType',
          type: 'string',
          description: 'Type of guild specialization',
        },
        {
          name: 'charterYear',
          type: 'number',
          description: 'Year guild was chartered',
        },
      ],
    },
  });

  // Korvosa structures (level 5 settlement - 4 structures)
  await prisma.structure.create({
    data: {
      settlementId: korvosaSettlement.id,
      type: 'barracks',
      name: 'Citadel Volshyenek',
      level: 5,
      variables: {
        garrison: 800,
        commanderName: 'Marcus Endrin',
        isOperational: true,
      },
      variableSchemas: [
        {
          name: 'garrison',
          type: 'number',
          description: 'Number of soldiers stationed',
          defaultValue: 50,
        },
        {
          name: 'commanderName',
          type: 'string',
          description: 'Name of the garrison commander',
        },
        {
          name: 'isOperational',
          type: 'boolean',
          description: 'Whether barracks is operational',
          defaultValue: true,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: korvosaSettlement.id,
      type: 'courthouse',
      name: 'The Archcourt',
      level: 4,
      variables: {
        judges: 12,
        casesPerMonth: 200,
        hasPrison: true,
      },
      variableSchemas: [
        {
          name: 'judges',
          type: 'number',
          description: 'Number of appointed judges',
          defaultValue: 1,
        },
        {
          name: 'casesPerMonth',
          type: 'number',
          description: 'Average cases processed per month',
          defaultValue: 10,
        },
        {
          name: 'hasPrison',
          type: 'boolean',
          description: 'Whether courthouse has attached prison',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: korvosaSettlement.id,
      type: 'academy',
      name: 'Acadamae',
      level: 5,
      variables: {
        students: 300,
        faculty: 45,
        specialization: 'conjuration',
      },
      variableSchemas: [
        {
          name: 'students',
          type: 'number',
          description: 'Number of enrolled students',
          defaultValue: 20,
        },
        {
          name: 'faculty',
          type: 'number',
          description: 'Number of faculty members',
          defaultValue: 3,
        },
        {
          name: 'specialization',
          type: 'string',
          description: 'Primary magical specialization',
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: korvosaSettlement.id,
      type: 'tower',
      name: 'Castle Korvosa',
      level: 5,
      variables: {
        height: 120,
        guards: 200,
        isRoyalResidence: true,
      },
      variableSchemas: [
        {
          name: 'height',
          type: 'number',
          description: 'Height in feet',
          defaultValue: 50,
        },
        {
          name: 'guards',
          type: 'number',
          description: 'Number of guards stationed',
          defaultValue: 10,
        },
        {
          name: 'isRoyalResidence',
          type: 'boolean',
          description: 'Whether tower is a royal residence',
          defaultValue: false,
        },
      ],
    },
  });

  // Westcrown structures (level 4 settlement - 3 structures)
  await prisma.structure.create({
    data: {
      settlementId: westcrownSettlement.id,
      type: 'temple',
      name: 'Basilica of Aroden',
      level: 4,
      variables: {
        deity: 'Aroden (defunct)',
        clergy: 8,
        isActive: false,
      },
      variableSchemas: [
        {
          name: 'deity',
          type: 'string',
          description: 'Primary deity worshipped',
        },
        {
          name: 'clergy',
          type: 'number',
          description: 'Number of clergy members',
          defaultValue: 1,
        },
        {
          name: 'isActive',
          type: 'boolean',
          description: 'Whether temple is actively conducting services',
          defaultValue: true,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: westcrownSettlement.id,
      type: 'theater',
      name: 'Nightshade Theater',
      level: 3,
      variables: {
        seats: 500,
        performancesPerWeek: 4,
        isCursed: true,
      },
      variableSchemas: [
        {
          name: 'seats',
          type: 'number',
          description: 'Seating capacity',
          defaultValue: 100,
        },
        {
          name: 'performancesPerWeek',
          type: 'number',
          description: 'Number of performances per week',
          defaultValue: 2,
        },
        {
          name: 'isCursed',
          type: 'boolean',
          description: 'Whether location is cursed or haunted',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: westcrownSettlement.id,
      type: 'dock',
      name: 'Delvehaven Docks',
      level: 4,
      variables: {
        berths: 30,
        shipsPerDay: 15,
        harbormaster: 'Vexus Trel',
      },
      variableSchemas: [
        {
          name: 'berths',
          type: 'number',
          description: 'Number of ship berths',
          defaultValue: 5,
        },
        {
          name: 'shipsPerDay',
          type: 'number',
          description: 'Average ships processed per day',
          defaultValue: 5,
        },
        {
          name: 'harbormaster',
          type: 'string',
          description: 'Name of the harbormaster',
        },
      ],
    },
  });

  // Egorian structures (level 5 settlement - 4 structures)
  await prisma.structure.create({
    data: {
      settlementId: egorianSettlement.id,
      type: 'tower',
      name: 'Imperial Palace',
      level: 5,
      variables: {
        height: 200,
        guards: 500,
        isRoyalResidence: true,
      },
      variableSchemas: [
        {
          name: 'height',
          type: 'number',
          description: 'Height in feet',
          defaultValue: 50,
        },
        {
          name: 'guards',
          type: 'number',
          description: 'Number of guards stationed',
          defaultValue: 10,
        },
        {
          name: 'isRoyalResidence',
          type: 'boolean',
          description: 'Whether tower is a royal residence',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: egorianSettlement.id,
      type: 'temple',
      name: 'Cathedral of Asmodeus',
      level: 5,
      variables: {
        deity: 'Asmodeus',
        clergy: 50,
        isActive: true,
      },
      variableSchemas: [
        {
          name: 'deity',
          type: 'string',
          description: 'Primary deity worshipped',
        },
        {
          name: 'clergy',
          type: 'number',
          description: 'Number of clergy members',
          defaultValue: 1,
        },
        {
          name: 'isActive',
          type: 'boolean',
          description: 'Whether temple is actively conducting services',
          defaultValue: true,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: egorianSettlement.id,
      type: 'academy',
      name: 'Imperial Academy of Binding',
      level: 5,
      variables: {
        students: 400,
        faculty: 60,
        specialization: 'diabolism',
      },
      variableSchemas: [
        {
          name: 'students',
          type: 'number',
          description: 'Number of enrolled students',
          defaultValue: 20,
        },
        {
          name: 'faculty',
          type: 'number',
          description: 'Number of faculty members',
          defaultValue: 3,
        },
        {
          name: 'specialization',
          type: 'string',
          description: 'Primary magical specialization',
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: egorianSettlement.id,
      type: 'barracks',
      name: 'Hellknight Citadel',
      level: 5,
      variables: {
        garrison: 1000,
        commanderName: 'Lictor Severs DiViri',
        isOperational: true,
      },
      variableSchemas: [
        {
          name: 'garrison',
          type: 'number',
          description: 'Number of soldiers stationed',
          defaultValue: 50,
        },
        {
          name: 'commanderName',
          type: 'string',
          description: 'Name of the garrison commander',
        },
        {
          name: 'isOperational',
          type: 'boolean',
          description: 'Whether barracks is operational',
          defaultValue: true,
        },
      ],
    },
  });

  // Corentyn structures (level 3 settlement - 2 structures)
  await prisma.structure.create({
    data: {
      settlementId: corentynSettlement.id,
      type: 'dock',
      name: 'Naval Shipyard',
      level: 3,
      variables: {
        berths: 20,
        shipsPerDay: 10,
        harbormaster: 'Admiral Cordus',
      },
      variableSchemas: [
        {
          name: 'berths',
          type: 'number',
          description: 'Number of ship berths',
          defaultValue: 5,
        },
        {
          name: 'shipsPerDay',
          type: 'number',
          description: 'Average ships processed per day',
          defaultValue: 5,
        },
        {
          name: 'harbormaster',
          type: 'string',
          description: 'Name of the harbormaster',
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: corentynSettlement.id,
      type: 'smithy',
      name: 'The Anvil and Anchor',
      level: 2,
      variables: {
        smiths: 8,
        specialization: 'shipwright tools',
        ordersPerWeek: 25,
      },
      variableSchemas: [
        {
          name: 'smiths',
          type: 'number',
          description: 'Number of working smiths',
          defaultValue: 1,
        },
        {
          name: 'specialization',
          type: 'string',
          description: 'Smithy specialization',
        },
        {
          name: 'ordersPerWeek',
          type: 'number',
          description: 'Average orders completed per week',
          defaultValue: 5,
        },
      ],
    },
  });

  // Sothis structures (level 5 settlement - 4 structures)
  await prisma.structure.create({
    data: {
      settlementId: sothisSettlement.id,
      type: 'tower',
      name: 'Black Dome',
      level: 5,
      variables: {
        height: 180,
        guards: 300,
        isRoyalResidence: true,
      },
      variableSchemas: [
        {
          name: 'height',
          type: 'number',
          description: 'Height in feet',
          defaultValue: 50,
        },
        {
          name: 'guards',
          type: 'number',
          description: 'Number of guards stationed',
          defaultValue: 10,
        },
        {
          name: 'isRoyalResidence',
          type: 'boolean',
          description: 'Whether tower is a royal residence',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: sothisSettlement.id,
      type: 'library',
      name: 'The Occularium',
      level: 5,
      variables: {
        volumes: 50000,
        specialCollections: 20,
        isPublic: false,
      },
      variableSchemas: [
        {
          name: 'volumes',
          type: 'number',
          description: 'Number of books and scrolls',
          defaultValue: 100,
        },
        {
          name: 'specialCollections',
          type: 'number',
          description: 'Number of special/rare collections',
          defaultValue: 0,
        },
        {
          name: 'isPublic',
          type: 'boolean',
          description: 'Whether library is open to public',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: sothisSettlement.id,
      type: 'market',
      name: 'Grand Bazaar of Sothis',
      level: 5,
      variables: {
        stalls: 500,
        merchantGuilds: 25,
        marketDays: 'Daily',
      },
      variableSchemas: [
        {
          name: 'stalls',
          type: 'number',
          description: 'Number of market stalls',
          defaultValue: 20,
        },
        {
          name: 'merchantGuilds',
          type: 'number',
          description: 'Number of registered merchant guilds',
          defaultValue: 1,
        },
        {
          name: 'marketDays',
          type: 'string',
          description: 'Days when market is open (comma-separated)',
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: sothisSettlement.id,
      type: 'temple',
      name: 'Temple of the Eternal Sun',
      level: 4,
      variables: {
        deity: 'Sarenrae',
        clergy: 35,
        isActive: true,
      },
      variableSchemas: [
        {
          name: 'deity',
          type: 'string',
          description: 'Primary deity worshipped',
        },
        {
          name: 'clergy',
          type: 'number',
          description: 'Number of clergy members',
          defaultValue: 1,
        },
        {
          name: 'isActive',
          type: 'boolean',
          description: 'Whether temple is actively conducting services',
          defaultValue: true,
        },
      ],
    },
  });

  // Wati structures (level 3 settlement - 3 structures)
  await prisma.structure.create({
    data: {
      settlementId: watiSettlement.id,
      type: 'library',
      name: 'Necropolis Archive',
      level: 3,
      variables: {
        volumes: 5000,
        specialCollections: 8,
        isPublic: true,
      },
      variableSchemas: [
        {
          name: 'volumes',
          type: 'number',
          description: 'Number of books and scrolls',
          defaultValue: 100,
        },
        {
          name: 'specialCollections',
          type: 'number',
          description: 'Number of special/rare collections',
          defaultValue: 0,
        },
        {
          name: 'isPublic',
          type: 'boolean',
          description: 'Whether library is open to public',
          defaultValue: false,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: watiSettlement.id,
      type: 'monastery',
      name: 'Monastery of the Forgotten Pharaoh',
      level: 2,
      variables: {
        monks: 25,
        tradition: 'Ancient Osirion',
        isOperational: true,
      },
      variableSchemas: [
        {
          name: 'monks',
          type: 'number',
          description: 'Number of monks in residence',
          defaultValue: 5,
        },
        {
          name: 'tradition',
          type: 'string',
          description: 'Martial or spiritual tradition followed',
        },
        {
          name: 'isOperational',
          type: 'boolean',
          description: 'Whether monastery is operational',
          defaultValue: true,
        },
      ],
    },
  });

  await prisma.structure.create({
    data: {
      settlementId: watiSettlement.id,
      type: 'market',
      name: 'The Living Quarter Market',
      level: 3,
      variables: {
        stalls: 80,
        merchantGuilds: 4,
        marketDays: 'Starday, Sunday',
      },
      variableSchemas: [
        {
          name: 'stalls',
          type: 'number',
          description: 'Number of market stalls',
          defaultValue: 20,
        },
        {
          name: 'merchantGuilds',
          type: 'number',
          description: 'Number of registered merchant guilds',
          defaultValue: 1,
        },
        {
          name: 'marketDays',
          type: 'string',
          description: 'Days when market is open (comma-separated)',
        },
      ],
    },
  });

  console.log(`✓ Created ${25} structures across all settlements`);
  console.log('  - Sandpoint (lvl 1): 2 structures (temple, inn)');
  console.log('  - Whistledown (lvl 2): 2 structures (workshop, market)');
  console.log('  - Magnimar (lvl 4): 3 structures (market, library, guild_hall)');
  console.log('  - Korvosa (lvl 5): 4 structures (barracks, courthouse, academy, tower)');
  console.log('  - Westcrown (lvl 4): 3 structures (temple, theater, dock)');
  console.log('  - Egorian (lvl 5): 4 structures (tower, temple, academy, barracks)');
  console.log('  - Corentyn (lvl 3): 2 structures (dock, smithy)');
  console.log('  - Sothis (lvl 5): 4 structures (tower, library, market, temple)');
  console.log('  - Wati (lvl 3): 3 structures (library, monastery, market)');

  // Create events with JSONLogic conditions referencing settlement/structure state
  console.log('Creating events with conditions and effects...');

  // Event 1: Sandpoint Festival - Only triggers if Sandpoint population > 1000 and has active temple
  const event1 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Swallowtail Festival',
      eventType: 'story',
      description:
        'A harvest festival celebrating the completion of the new cathedral to Desna. The town gathers for games, food, and the consecration ceremony.',
      locationId: sandpoint.id as string,
      scheduledAt: new Date('4707-09-21T10:00:00Z'), // Rova 21, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event1.id,
      name: 'Settlement can host festival',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>': [{ var: 'variables.population' }, 1000] },
          { '==': [{ var: 'variables.primaryIndustry' }, 'fishing'] },
        ],
      },
      description: 'Festival requires population > 1000 and fishing industry',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event1.id,
      name: 'Boost settlement morale',
      entityType: 'EVENT',
      description: 'Successful festival increases community morale',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'add',
          path: '/variables/festivalMorale',
          value: 85, // High morale after successful festival
        },
      ],
    },
  });

  // Event 2: Goblin Raid - Only triggers if settlement has no walls and low defense
  const event2 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Goblin Raid on Sandpoint',
      eventType: 'story',
      description:
        'A coordinated goblin attack on the town during the festival. Four tribes work together to breach the defenses and burn buildings.',
      locationId: sandpoint.id as string,
      scheduledAt: new Date('4707-09-21T20:00:00Z'), // Same day, evening
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event2.id,
      name: 'Settlement is vulnerable',
      entityType: 'EVENT',
      expression: {
        and: [
          { '==': [{ var: 'variables.hasWalls' }, false] },
          { '<': [{ var: 'variables.defenseRating' }, 10] },
        ],
      },
      description: 'Settlement is vulnerable: no walls and low defense',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event2.id,
      name: 'Reduce population from casualties',
      entityType: 'EVENT',
      description: 'The goblin raid kills several townspeople',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/population',
          value: 1450, // Reduces from 1500 to 1450
        },
      ],
    },
  });

  // Event 3: Trade Fair in Magnimar - Requires large market and trade industry
  const event3 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Autumn Trade Fair',
      eventType: 'story',
      description:
        'Merchants from across Varisia gather in Magnimar for the annual trade fair. Exotic goods, rare spices, and foreign traders fill the Bazaar of Sails.',
      locationId: magnimar.id as string,
      scheduledAt: new Date('4707-10-15T09:00:00Z'), // Lamashan 15, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event3.id,
      name: 'Large trade hub',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.marketSize' }, 'large'] },
          { '==': [{ var: 'variables.primaryIndustry' }, 'trade'] },
          { '>=': [{ var: 'variables.population' }, 10000] },
        ],
      },
      description: 'Major trade fair requires large market, trade industry, and population >= 10k',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event3.id,
      name: 'Increase settlement wealth',
      entityType: 'EVENT',
      description: 'Successful trade fair boosts local economy',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'add',
          path: '/variables/tradeWealth',
          value: 50000, // Adds 50,000 gp worth of trade goods
        },
      ],
    },
  });

  // Event 4: Library Discovery - Requires library with large collection
  const event4 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Ancient Thassilonian Tome Discovered',
      eventType: 'story',
      description:
        "Scholars at the Founder's Archive uncover a pre-Earthfall manuscript detailing Runelord Karzoug's research into transmutation magic.",
      locationId: magnimar.id as string,
      scheduledAt: new Date('4707-11-03T14:00:00Z'), // Neth 3, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event4.id,
      name: 'Large library with rare collection',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.volumes' }, 5000] },
          { '>': [{ var: 'variables.specialCollections' }, 0] },
          { '==': [{ var: 'variables.isPublic' }, true] },
        ],
      },
      description:
        'Discovery requires library with 5000+ volumes, special collections, and public access',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event4.id,
      name: 'Add discovered tome to collection',
      entityType: 'EVENT',
      description: 'Rare Thassilonian manuscript added to special collections',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/specialCollections',
          value: 4, // Increases from 3 to 4
        },
      ],
    },
  });

  // Event 5: Hellknight Inspection - Only if barracks has large garrison
  const event5 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Hellknight Order Inspection',
      eventType: 'story',
      description:
        'The Order of the Rack conducts a formal inspection of the Hellknight Citadel garrison, testing combat readiness and loyalty to House Thrune.',
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Egorian', worldId: world.id },
        })
      ).id,
      scheduledAt: new Date('4707-08-12T08:00:00Z'), // Arodus 12, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event5.id,
      name: 'Large garrison ready for inspection',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.garrison' }, 500] },
          { '==': [{ var: 'variables.isOperational' }, true] },
        ],
      },
      description: 'Inspection requires garrison >= 500 and operational status',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event5.id,
      name: 'Increase garrison readiness',
      entityType: 'EVENT',
      description: 'Inspection motivates troops to improve combat readiness',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'add',
          path: '/variables/readinessScore',
          value: 95, // High readiness after Hellknight inspection
        },
      ],
    },
  });

  // Event 6: Cathedral Consecration - Requires active temple with sufficient clergy
  const event6 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Cathedral Consecration Ceremony',
      eventType: 'story',
      description:
        'Bishop Abstalar Zantus consecrates the newly rebuilt Cathedral of Desna with a blessing ceremony attended by the entire town.',
      locationId: sandpoint.id as string,
      scheduledAt: new Date('4707-09-21T12:00:00Z'), // During the Swallowtail Festival
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event6.id,
      name: 'Active temple ready for consecration',
      entityType: 'EVENT',
      expression: {
        and: [
          { '==': [{ var: 'variables.isActive' }, true] },
          { '>=': [{ var: 'variables.clergy' }, 2] },
          { '==': [{ var: 'variables.deity' }, 'Desna'] },
        ],
      },
      description: 'Consecration requires active temple with 2+ clergy dedicated to Desna',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event6.id,
      name: 'Increase clergy count',
      entityType: 'EVENT',
      description: 'Successful consecration attracts new clergy members',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/clergy',
          value: 5, // Increases from 3 to 5
        },
      ],
    },
  });

  // Event 7: Market Day Disruption - Requires market with multiple stalls
  const event7 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Pickpocket Gang Disrupts Market',
      eventType: 'story',
      description:
        'A sophisticated thieves guild orchestrates mass pickpocketing during peak market hours, causing chaos and merchant complaints.',
      locationId: magnimar.id as string,
      scheduledAt: new Date('4707-10-16T11:00:00Z'), // Day after trade fair
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event7.id,
      name: 'Bustling market attracts thieves',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.stalls' }, 100] },
          { '>=': [{ var: 'variables.merchantGuilds' }, 5] },
        ],
      },
      description: 'Pickpockets target busy markets with 100+ stalls and 5+ guilds',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event7.id,
      name: 'Reduce merchant guilds',
      entityType: 'EVENT',
      description: 'Some merchants leave after theft incident',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/merchantGuilds',
          value: 7, // Reduces from 8 to 7
        },
      ],
    },
  });

  // Event 8: Academy Graduation - Requires academy with students
  const event8 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Acadamae Graduation Ceremony',
      eventType: 'story',
      description:
        'The Acadamae graduates a new class of conjurers, each binding their first imp familiar in a public demonstration of diabolic pact-making.',
      locationId: korvosa.id as string,
      scheduledAt: new Date('4707-06-30T16:00:00Z'), // Sarenith 30, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event8.id,
      name: 'Academy has graduating class',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.students' }, 100] },
          { '>=': [{ var: 'variables.faculty' }, 20] },
          { '==': [{ var: 'variables.specialization' }, 'conjuration'] },
        ],
      },
      description: 'Graduation requires 100+ students, 20+ faculty, and conjuration specialization',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event8.id,
      name: 'Reduce student count',
      entityType: 'EVENT',
      description: 'Graduating students leave the academy',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/students',
          value: 250, // Reduces from 300 to 250 (50 graduates)
        },
      ],
    },
  });

  // Event 9: Dock Expansion - Requires operational dock with high traffic
  const event9 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Dock Expansion Project Completion',
      eventType: 'story',
      description:
        'After months of construction, Delvehaven Docks completes expansion with 10 new berths and improved warehousing facilities.',
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Westcrown', worldId: world.id },
        })
      ).id,
      scheduledAt: new Date('4707-05-20T10:00:00Z'), // Desnus 20, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event9.id,
      name: 'Busy dock needs expansion',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.berths' }, 20] },
          { '>=': [{ var: 'variables.shipsPerDay' }, 10] },
        ],
      },
      description: 'Expansion justified if dock has 20+ berths and handles 10+ ships/day',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event9.id,
      name: 'Increase berth count',
      entityType: 'EVENT',
      description: 'Add new berths from expansion',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/berths',
          value: 40, // Increases from 30 to 40
        },
      ],
    },
  });

  // Event 10: Courthouse Justice - Requires courthouse with judges
  const event10 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Corruption Trial at the Archcourt',
      eventType: 'story',
      description:
        'A high-profile trial of a corrupt noble shakes Korvosa, with Judge Zenobia Zenderholm presiding over explosive testimony.',
      locationId: korvosa.id as string,
      scheduledAt: new Date('4707-04-12T09:00:00Z'), // Gozran 12, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event10.id,
      name: 'Functional court can hold trial',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.judges' }, 5] },
          { '>=': [{ var: 'variables.casesPerMonth' }, 50] },
          { '==': [{ var: 'variables.hasPrison' }, true] },
        ],
      },
      description: 'Major trial requires 5+ judges, 50+ cases/month capacity, and prison',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event10.id,
      name: 'Improve public trust in justice',
      entityType: 'EVENT',
      description: 'Successful corruption trial restores faith in legal system',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'add',
          path: '/variables/publicTrustRating',
          value: 72, // Moderate-high trust after successful trial
        },
      ],
    },
  });

  // Event 11: Inn Renovation - Small inn upgraded
  const event11 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Rusty Dragon Renovation',
      eventType: 'story',
      description:
        'Ameiko Kaijitsu invests in renovating the Rusty Dragon, adding new rooms and improving the common area.',
      locationId: sandpoint.id as string,
      scheduledAt: new Date('4707-07-01T08:00:00Z'), // Erastus 1, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event11.id,
      name: 'Profitable inn can expand',
      entityType: 'EVENT',
      expression: {
        and: [
          { '<=': [{ var: 'variables.rooms' }, 15] },
          { '>=': [{ var: 'variables.pricePerNight' }, 3] },
        ],
      },
      description: 'Inn expansion viable if rooms <= 15 and price >= 3 gp/night',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event11.id,
      name: 'Add more rooms',
      entityType: 'EVENT',
      description: 'Renovation adds 8 new rooms',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/rooms',
          value: 20, // Increases from 12 to 20
        },
      ],
    },
  });

  // Event 12: Workshop Innovation - Gnome inventors create breakthrough
  const event12 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Clockwork Innovation Breakthrough',
      eventType: 'story',
      description:
        'The Cogwhisper Inventors Guild successfully creates a self-winding perpetual motion clockwork, earning a prestigious patent.',
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Whistledown', worldId: world.id },
        })
      ).id,
      scheduledAt: new Date('4707-12-10T14:00:00Z'), // Kuthona 10, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event12.id,
      name: 'Active workshop can innovate',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.inventors' }, 10] },
          { '==': [{ var: 'variables.specialization' }, 'clockwork'] },
          { '>=': [{ var: 'variables.patentsRegistered' }, 20] },
        ],
      },
      description: 'Innovation requires 10+ inventors, clockwork specialization, and 20+ patents',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event12.id,
      name: 'Register new patent',
      entityType: 'EVENT',
      description: 'Add breakthrough invention to patent registry',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/patentsRegistered',
          value: 48, // Increases from 47 to 48
        },
      ],
    },
  });

  // Event 13: Theater Performance - Cursed theater hosts haunted show
  const event13 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'The Haunting of Nightshade Theater',
      eventType: 'story',
      description:
        'A touring troupe attempts to perform at the cursed Nightshade Theater, only to have the show interrupted by spectral apparitions.',
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Westcrown', worldId: world.id },
        })
      ).id,
      scheduledAt: new Date('4707-10-31T19:00:00Z'), // Lamashan 31, 4707 AR (Halloween equivalent)
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event13.id,
      name: 'Cursed venue is haunted',
      entityType: 'EVENT',
      expression: {
        and: [
          { '==': [{ var: 'variables.isCursed' }, true] },
          { '>=': [{ var: 'variables.seats' }, 300] },
          { '>=': [{ var: 'variables.performancesPerWeek' }, 2] },
        ],
      },
      description: 'Haunting occurs in cursed theaters with 300+ seats and regular performances',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event13.id,
      name: 'Reduce performances',
      entityType: 'EVENT',
      description: 'Haunting scares away performers, reducing show frequency',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/performancesPerWeek',
          value: 2, // Reduces from 4 to 2
        },
      ],
    },
  });

  // Event 14: Smithy Order Surge - Naval smithy gets military contracts
  const event14 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Naval Armament Contract',
      eventType: 'story',
      description:
        'The Chelish Navy awards The Anvil and Anchor a major contract to forge anchor chains and ship fittings for 10 new warships.',
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Corentyn', worldId: world.id },
        })
      ).id,
      scheduledAt: new Date('4707-03-05T09:00:00Z'), // Pharast 5, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event14.id,
      name: 'Capable smithy can handle large orders',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.smiths' }, 5] },
          { in: [{ var: 'variables.specialization' }, ['shipwright', 'shipwright tools']] },
          { '>=': [{ var: 'variables.ordersPerWeek' }, 15] },
        ],
      },
      description:
        'Large contract requires 5+ smiths, shipwright specialization, and 15+ orders/week capacity',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event14.id,
      name: 'Increase weekly orders',
      entityType: 'EVENT',
      description: 'Contract increases order volume',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/ordersPerWeek',
          value: 40, // Increases from 25 to 40
        },
      ],
    },
  });

  // Event 15: Guild Hall Expansion - Maritime guild grows
  const event15 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Seafarers Guild Membership Drive',
      eventType: 'story',
      description:
        'The Seafarers Guild launches a recruitment campaign, offering reduced membership fees to attract new sailors and dockhands.',
      locationId: magnimar.id as string,
      scheduledAt: new Date('4707-02-15T10:00:00Z'), // Calistril 15, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event15.id,
      name: 'Established guild can expand',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.members' }, 300] },
          { '==': [{ var: 'variables.guildType' }, 'maritime'] },
          { '<=': [{ var: 'variables.charterYear' }, 4650] },
        ],
      },
      description:
        'Expansion viable for established guilds with 300+ members chartered before 4650 AR',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event15.id,
      name: 'Increase membership',
      entityType: 'EVENT',
      description: 'Recruitment drive adds new members',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/members',
          value: 550, // Increases from 450 to 550
        },
      ],
    },
  });

  // Event 16: Monastery Training - Ancient martial arts taught
  const event16 = await prisma.event.create({
    data: {
      campaignId: campaign.id,
      name: 'Ancient Combat Techniques Rediscovered',
      eventType: 'story',
      description:
        'Monks at the Monastery of the Forgotten Pharaoh uncover scrolls detailing lost Osirian martial arts, attracting students from across the kingdom.',
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Wati', worldId: world.id },
        })
      ).id,
      scheduledAt: new Date('4707-08-28T06:00:00Z'), // Arodus 28, 4707 AR
    },
  });
  await prisma.condition.create({
    data: {
      entityId: event16.id,
      name: 'Operational monastery can teach',
      entityType: 'EVENT',
      expression: {
        and: [
          { '>=': [{ var: 'variables.monks' }, 15] },
          { '==': [{ var: 'variables.tradition' }, 'Ancient Osirion'] },
          { '==': [{ var: 'variables.isOperational' }, true] },
        ],
      },
      description:
        'Training program requires 15+ monks, Ancient Osirion tradition, and operational status',
    },
  });
  await prisma.effect.create({
    data: {
      entityId: event16.id,
      name: 'Increase monk population',
      entityType: 'EVENT',
      description: 'New students join monastery to learn ancient techniques',
      effectType: 'patch',
      timing: 'POST',
      priority: 10,
      payload: [
        {
          op: 'replace',
          path: '/variables/monks',
          value: 35, // Increases from 25 to 35
        },
      ],
    },
  });

  console.log(`✓ Created 16 events with JSONLogic conditions`);
  console.log(`✓ All 16 events include JSON Patch effects for world state mutation`);

  // ============================================================================
  // ENCOUNTERS WITH DEPENDENCY RELATIONSHIPS
  // ============================================================================
  console.log('Creating encounters with dependency relationships...');

  // Encounters are organized by location/region and difficulty progression
  // They demonstrate the dependency graph system with prerequisite, triggers, blocks, and related link types

  // Group 1: Sandpoint Encounters (4 encounters) - Tutorial difficulty progression
  const encounterCelebration = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: sandpoint.id as string,
      name: 'Festival Preparation & Celebration',
      description:
        'Help the townspeople prepare for the Swallowtail Festival. Set up stalls, decorate the cathedral square, and participate in the opening ceremonies.',
      difficulty: 1,
      scheduledAt: new Date('4707-09-21T08:00:00Z'), // Morning of festival
      isResolved: false,
      variables: {
        attendees: 200,
        atmosphere: 'festive',
        preparationTasks: ['stalls', 'decorations', 'food_prep'],
        reputationGain: 5,
      },
    },
  });

  const encounterGoblinRaid = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: sandpoint.id as string,
      name: 'Goblin Raid - Initial Assault',
      description:
        'Four goblin tribes launch a coordinated attack on Sandpoint during the festival. Defend the town center from waves of goblin attackers and protect civilians.',
      difficulty: 2,
      scheduledAt: new Date('4707-09-21T20:30:00Z'), // Evening during festival
      isResolved: false,
      variables: {
        goblinCount: 20,
        location: 'town_center',
        civiliansCasualties: 0,
        defenseRating: 15,
        tribes: ['Mosswood', 'Birdcruncher', 'Licktoad', 'Thistletop'],
      },
    },
  });

  const encounterGoblinAmbush = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: sandpoint.id as string,
      name: 'Street Ambush by Remnant Forces',
      description:
        'Goblin stragglers have regrouped in the back alleys. Hunt down the remaining threats before they can strike again at dawn.',
      difficulty: 2,
      scheduledAt: new Date('4707-09-22T02:00:00Z'), // Early morning cleanup
      isResolved: false,
      variables: {
        ambushType: 'street_ambush',
        goblinCount: 8,
        threats: 'multiple_hiding_spots',
        stealthRequired: true,
      },
    },
  });

  const encounterAftermath = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: sandpoint.id as string,
      name: 'Festival Aftermath & Town Reconstruction',
      description:
        'Work with Mayor Deverin to assess damage, comfort grieving families, and organize reconstruction efforts. Your actions will determine town morale.',
      difficulty: 1,
      scheduledAt: new Date('4707-09-22T10:00:00Z'), // Next morning
      isResolved: false,
      variables: {
        damageLevel: 'moderate',
        moraleFactor: 'low',
        reconstructionCost: 5000,
        volunteersNeeded: 50,
        healingRequired: true,
      },
    },
  });

  // Group 2: Magnimar Encounters (3 encounters) - Trade & intrigue
  const encounterMerchantDispute = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: magnimar.id as string,
      name: 'Trade Fair Merchant Dispute',
      description:
        'Two prominent merchant houses are in a heated dispute over counterfeit exotic spices. Investigate the claims and mediate before tensions escalate.',
      difficulty: 1,
      scheduledAt: new Date('4707-10-15T14:00:00Z'), // Afternoon of trade fair
      isResolved: false,
      variables: {
        disputedGood: 'saffron_from_qadira',
        merchantHouses: ['House Versade', 'House Corniolo'],
        evidenceCount: 3,
        diplomaticDC: 15,
      },
    },
  });

  const encounterCaravanEscort = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: magnimar.id as string,
      name: 'Merchant Caravan Escort',
      description:
        'Escort a valuable caravan of settled trade goods from Magnimar to Sandpoint. Bandits and wild beasts threaten the Varisian roads.',
      difficulty: 2,
      scheduledAt: new Date('4707-10-17T06:00:00Z'), // Two days after dispute
      isResolved: false,
      variables: {
        cargoValue: 5000,
        hazardLevel: 'moderate',
        distanceMiles: 50,
        encounterChance: 0.6,
        merchants: 4,
        guards: 2,
      },
    },
  });

  const encounterThievesGuild = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: magnimar.id as string,
      name: 'Thieves Guild Heist at the Bazaar',
      description:
        'The Sczarni crime family plans a major heist during market hours. Infiltrate their operation or stop them in the act at the Bazaar of Sails.',
      difficulty: 3,
      scheduledAt: new Date('4707-10-16T22:00:00Z'), // Night after trade fair
      isResolved: false,
      variables: {
        targetValue: 10000,
        suspicion: 'high',
        guardPatrols: 8,
        heistComplexity: 'multi_stage',
        escapeRoutes: 3,
      },
    },
  });

  // Group 3: Korvosa Encounters (3 encounters) - Political intrigue
  const encounterRecruitment = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: korvosa.id as string,
      name: 'Korvosan Guard Recruitment',
      description:
        'The Guard is recruiting adventurers for a special task force. Pass rigorous trials to earn the trust of Field Marshal Cressida Kroft.',
      difficulty: 1,
      scheduledAt: new Date('4707-11-01T09:00:00Z'), // Early Neth
      isResolved: false,
      variables: {
        openPositions: 5,
        standards: 'strict',
        trials: ['combat', 'investigation', 'loyalty'],
        rewardGold: 500,
      },
    },
  });

  const encounterSpyInfiltration = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: korvosa.id as string,
      name: 'Spy Infiltration at Castle Korvosa',
      description:
        'A Chelish spy network has infiltrated the royal court. Use your position in the Guard to identify the spies before they steal military secrets.',
      difficulty: 3,
      scheduledAt: new Date('4707-11-15T18:00:00Z'), // Two weeks later
      isResolved: false,
      variables: {
        spyIdentity: 'hidden',
        riskLevel: 'critical',
        suspectCount: 6,
        evidenceRequired: 4,
        timeLimit: '72_hours',
      },
    },
  });

  const encounterAssassination = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: korvosa.id as string,
      name: 'Assassination Plot Against Queen Ileosa',
      description:
        'The spies were planning an assassination! Stop the conspirators during a royal banquet before they can strike down the Queen.',
      difficulty: 4,
      scheduledAt: new Date('4707-11-18T19:00:00Z'), // Three days later
      isResolved: false,
      variables: {
        conspirators: 4,
        weaponType: 'poison_blades',
        innocentNobles: 30,
        escapeBlockades: 5,
        assassinLevel: 7,
      },
    },
  });

  // Group 4: Wilderness & Dungeon Encounters (2 encounters) - High difficulty
  const encounterMonsterHunt = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'The Storval Stairs', worldId: world.id },
        })
      ).id,
      name: 'Chimera Hunting Contract',
      description:
        'A deadly chimera has been terrorizing travelers near the Storval Stairs. Track the beast through mountainous terrain and claim the bounty.',
      difficulty: 3,
      scheduledAt: new Date('4707-12-01T10:00:00Z'), // Kuthona
      isResolved: false,
      variables: {
        target: 'chimera',
        reward: 2000,
        trackingDC: 18,
        terrainDifficulty: 'mountainous',
        weatherCondition: 'snow',
      },
    },
  });

  const encounterLairRaid = await prisma.encounter.create({
    data: {
      campaignId: campaign.id,
      locationId: (
        await prisma.location.findFirstOrThrow({
          where: { name: 'Thistletop', worldId: world.id },
        })
      ).id,
      name: 'Thistletop Goblin Fortress Raid',
      description:
        'Raid the Thistletop goblin fortress and confront their warchief Ripnugget. The fortress is heavily defended with traps and a bugbear mercenary.',
      difficulty: 4,
      scheduledAt: new Date('4707-09-25T14:00:00Z'), // Four days after festival
      isResolved: false,
      variables: {
        lairTreasure: 15000,
        bossName: 'Ripnugget',
        bossHP: 80,
        minions: 30,
        trapCount: 8,
        bossWeapon: 'horsechopper',
      },
    },
  });

  console.log(`✓ Created 12 encounters across 4 location groups`);

  // ============================================================================
  // ENCOUNTER DEPENDENCY LINKS
  // ============================================================================
  console.log('Creating encounter dependency links...');

  // Sandpoint dependency chain: Celebration → Raid → Ambush → Aftermath
  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterCelebration.id,
      targetType: 'encounter',
      targetId: encounterGoblinRaid.id,
      linkType: 'triggers',
      description: 'Festival celebration makes the town vulnerable to the raid',
    },
  });

  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterGoblinRaid.id,
      targetType: 'encounter',
      targetId: encounterGoblinAmbush.id,
      linkType: 'prerequisite',
      description: 'Ambush can only occur after initial raid is repelled',
    },
  });

  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterGoblinRaid.id,
      targetType: 'encounter',
      targetId: encounterAftermath.id,
      linkType: 'triggers',
      description: 'Raid triggers reconstruction efforts',
    },
  });

  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterGoblinAmbush.id,
      targetType: 'encounter',
      targetId: encounterAftermath.id,
      linkType: 'related',
      description: 'Cleanup relates to reconstruction',
    },
  });

  // Magnimar trade dependencies
  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterMerchantDispute.id,
      targetType: 'encounter',
      targetId: encounterCaravanEscort.id,
      linkType: 'prerequisite',
      description: 'Must resolve dispute before merchants trust you with escort',
    },
  });

  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterMerchantDispute.id,
      targetType: 'encounter',
      targetId: encounterThievesGuild.id,
      linkType: 'related',
      description: 'Thieves guild suspects emerge during dispute investigation',
    },
  });

  // Korvosa political intrigue chain
  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterRecruitment.id,
      targetType: 'encounter',
      targetId: encounterSpyInfiltration.id,
      linkType: 'prerequisite',
      description: 'Must join Guard before gaining access to investigate spies',
    },
  });

  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterSpyInfiltration.id,
      targetType: 'encounter',
      targetId: encounterAssassination.id,
      linkType: 'triggers',
      description: 'Discovering spies triggers the assassination attempt',
    },
  });

  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterRecruitment.id,
      targetType: 'encounter',
      targetId: encounterAssassination.id,
      linkType: 'related',
      description: 'Guard position affects how you respond to assassination',
    },
  });

  // Wilderness progression
  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterMonsterHunt.id,
      targetType: 'encounter',
      targetId: encounterLairRaid.id,
      linkType: 'prerequisite',
      description: 'Chimera hunt experience prepares party for fortress raid',
    },
  });

  // Cross-group dependency: Goblin raid enables fortress assault
  await prisma.link.create({
    data: {
      sourceType: 'encounter',
      sourceId: encounterGoblinAmbush.id,
      targetType: 'encounter',
      targetId: encounterLairRaid.id,
      linkType: 'triggers',
      description: 'Captured goblins reveal location of Thistletop fortress',
    },
  });

  console.log(
    `✓ Created 11 dependency links demonstrating prerequisite, triggers, and related types`
  );

  // Create alternate timeline branches demonstrating "what-if" scenarios
  console.log('Creating alternate timeline branches...');

  // Branch 1: "What if the Goblin Raid was Prevented?"
  const branchGoblinPrevented = await prisma.branch.create({
    data: {
      campaignId: campaign.id,
      name: 'Peaceful Festival',
      description:
        'An alternate timeline where the town guards discovered the goblin tribes gathering and dispersed them before the raid. The Swallowtail Festival concluded peacefully, and Sandpoint never experienced the attack. Without captured goblins to interrogate, the location of Thistletop fortress remains unknown. Town guards on patrol discovered goblin scouts in the hinterlands and raised the alarm. Sheriff Hemlock mobilized militia and drove off the tribes before they could organize their assault on the festival.',
      divergedAt: new Date('4707-09-21T20:00:00Z'), // Just before the raid at 20:30
    },
  });

  // Branch 2: "What if the Spies Weren't Discovered?"
  const branchSpiesSucceed = await prisma.branch.create({
    data: {
      campaignId: campaign.id,
      name: 'Shadow Conspiracy',
      description:
        'An alternate timeline where the Korvosan Guard recruitment failed to uncover the spy network operating within Castle Korvosa. The infiltrators remained undetected, allowing the assassination plot against Queen Ileosa to proceed unchecked. Political instability grips the city-state as conspiracy theories spread. The guard recruitment trials selected candidates who were either incompetent or compromised. The investigation into suspicious activity at the castle was dismissed as paranoia. The spy network operated with impunity.',
      divergedAt: new Date('4707-11-15T17:00:00Z'), // Just before spy investigation at 18:00
    },
  });

  // Branch 3: "What if the Thistletop Raid Failed?"
  const branchRaidFailed = await prisma.branch.create({
    data: {
      campaignId: campaign.id,
      name: 'Goblin Resurgence',
      description:
        "An alternate timeline where the assault on Thistletop fortress ended in disaster. Chief Ripnugget and his goblin horde repelled the adventurers, inflicting heavy casualties. Emboldened by victory, the goblin tribes unite under Ripnugget's banner and launch a sustained campaign of raids against Sandpoint and surrounding settlements. The adventuring party underestimated the fortress defenses. Ripnugget had prepared ambushes and traps throughout Thistletop. The raid turned into a rout, with survivors barely escaping with their lives.",
      divergedAt: new Date('4707-09-25T14:00:00Z'), // Raid scheduled time
    },
  });

  console.log(`✓ Created 3 alternate timeline branches:`);
  console.log(
    `  - "${branchGoblinPrevented.name}" (diverged ${branchGoblinPrevented.divergedAt!.toISOString()})`
  );
  console.log(
    `  - "${branchSpiesSucceed.name}" (diverged ${branchSpiesSucceed.divergedAt!.toISOString()})`
  );
  console.log(
    `  - "${branchRaidFailed.name}" (diverged ${branchRaidFailed.divergedAt!.toISOString()})`
  );

  // Create sample party
  console.log('Creating sample party...');
  const party = await prisma.party.create({
    data: {
      campaignId: campaign.id,
      name: 'The Heroes of Sandpoint',
      averageLevel: 1,
      variables: {
        gold: 100,
        reputation: 'neutral',
      },
      variableSchemas: [
        {
          name: 'gold',
          type: 'number',
          description: 'Party gold in pieces',
        },
        {
          name: 'reputation',
          type: 'string',
          description: 'Party reputation in the region',
        },
      ],
    },
  });

  // Create sample characters
  console.log('Creating sample characters...');
  await prisma.character.createMany({
    data: [
      {
        campaignId: campaign.id,
        partyId: party.id,
        name: 'Valeros',
        level: 1,
        race: 'Human',
        class: 'Fighter',
        isNPC: false,
        variables: {
          hp: 12,
          ac: 17,
          str: 16,
          dex: 14,
          con: 14,
          int: 10,
          wis: 12,
          cha: 10,
        },
      },
      {
        campaignId: campaign.id,
        partyId: party.id,
        name: 'Seoni',
        level: 1,
        race: 'Human',
        class: 'Sorcerer',
        isNPC: false,
        variables: {
          hp: 6,
          ac: 12,
          str: 8,
          dex: 14,
          con: 10,
          int: 12,
          wis: 10,
          cha: 18,
        },
      },
      {
        campaignId: campaign.id,
        name: 'Ameiko Kaijitsu',
        level: 3,
        race: 'Human',
        class: 'Bard',
        isNPC: true,
        variables: {
          hp: 20,
          ac: 15,
          occupation: 'Innkeeper',
        },
      },
    ],
  });

  console.log('✅ Seed completed successfully!');
  console.log('\n📊 Sample data created:');
  console.log('\n🔐 Authorization:');
  console.log('  - 2 roles (admin, user)');
  console.log('  - 4 permissions (campaign CRUD)');
  console.log('  - 2 users (admin@campaign.local, user@campaign.local)');
  console.log('\n🌍 Geographic Entities:');
  console.log('  - 1 world (Golarion)');
  console.log('  - 5 regions (Varisia, Cheliax, Worldwound, Osirion, Mwangi Expanse)');
  console.log('  - 25 locations distributed across all regions');
  console.log('\n🏰 Settlements & Structures:');
  console.log('  - 3 kingdoms with typed variables (Varisia, Cheliax, Osirion)');
  console.log('  - 9 settlements with typed variables (levels 1-5)');
  console.log('  - 25 structures across settlements with typed variables (levels 1-5)');
  console.log('\n📅 Events & Encounters:');
  console.log('  - 16 events with JSONLogic conditions and JSON Patch effects');
  console.log('  - 12 encounters with custom variables (difficulty 1-4)');
  console.log('  - 11 encounter dependencies (prerequisite, triggers, related)');
  console.log('\n🌿 Branching Timelines:');
  console.log('  - 4 branches total (1 main + 3 alternate timelines)');
  console.log('    • Peaceful Festival (raid prevented)');
  console.log('    • Shadow Conspiracy (spies undetected)');
  console.log('    • Goblin Resurgence (raid failed)');
  console.log('\n👥 Campaign & Party:');
  console.log('  - 1 campaign (Rise of the Runelords)');
  console.log('  - 1 party (The Heroes of Sandpoint)');
  console.log('  - 3 characters (Valeros, Seoni, Ameiko Kaijitsu)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

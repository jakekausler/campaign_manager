/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing.
 * Run with: pnpm --filter @campaign/api prisma:seed
 */

import { PrismaClient } from '@prisma/client';

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

  // Create sample campaign
  console.log('Creating sample campaign...');
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Rise of the Runelords',
      worldId: world.id,
      ownerId: adminUser.id,
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

  // Note: Location creation with PostGIS geometry requires raw SQL
  // This is demonstrated in the spatial.helpers.ts file
  // For now, we'll create a location without geometry
  console.log('Creating sample location...');
  await prisma.location.create({
    data: {
      worldId: world.id,
      type: 'point',
      name: 'Sandpoint',
      description: 'A small coastal town in Varisia',
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('\nSample data created:');
  console.log('- 2 roles (admin, user)');
  console.log('- 4 permissions');
  console.log('- 2 users (admin@campaign.local, user@campaign.local)');
  console.log('- 1 world (Golarion)');
  console.log('- 1 campaign (Rise of the Runelords)');
  console.log('- 1 branch (main)');
  console.log('- 1 party (The Heroes of Sandpoint)');
  console.log('- 3 characters (Valeros, Seoni, Ameiko Kaijitsu)');
  console.log('- 1 location (Sandpoint)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

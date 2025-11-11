/**
 * @fileoverview Script to create the service account API key for the scheduler
 *
 * This script creates an API key in the database that matches the one configured
 * in the scheduler's environment variables. Run this once to bootstrap the scheduler
 * authentication.
 *
 * Usage: pnpm --filter @campaign/api ts-node scripts/create-service-api-key.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔑 Creating service account API key...');

  // The plaintext API key from scheduler/.env.local
  const plaintextKey = 'camp_sk_oEW4TQ09TTpTirmak_XLHITHocAUEfmT';

  // Hash the key using bcrypt (same as password hashing)
  const hashedKey = await bcrypt.hash(plaintextKey, 10);

  // First, get or create a service account user
  let serviceUser = await prisma.user.findUnique({
    where: { email: 'scheduler@service.local' },
  });

  if (!serviceUser) {
    console.log('📝 Creating service account user...');

    // Get the user role (should exist from seed)
    const userRole = await prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      throw new Error(
        'User role not found. Please run seed first: pnpm --filter @campaign/api prisma:seed'
      );
    }

    serviceUser = await prisma.user.create({
      data: {
        email: 'scheduler@service.local',
        name: 'Scheduler Service Account',
        password: await bcrypt.hash('unused-password-for-service-account', 10),
        roles: {
          create: {
            roleId: userRole.id,
          },
        },
      },
    });
    console.log(`✅ Created service user: ${serviceUser.email} (ID: ${serviceUser.id})`);
  } else {
    console.log(`✅ Found existing service user: ${serviceUser.email} (ID: ${serviceUser.id})`);
  }

  // Check if API key already exists
  const existingKey = await prisma.apiKey.findFirst({
    where: {
      userId: serviceUser.id,
      name: 'Scheduler Service Account',
      revokedAt: null,
    },
  });

  if (existingKey) {
    console.log('⚠️  API key already exists. Revoking old key and creating new one...');
    await prisma.apiKey.update({
      where: { id: existingKey.id },
      data: { revokedAt: new Date() },
    });
  }

  // Create the API key
  const apiKey = await prisma.apiKey.create({
    data: {
      userId: serviceUser.id,
      name: 'Scheduler Service Account',
      key: hashedKey,
      scopes: ['read:campaigns', 'read:events', 'write:events'], // Scopes needed by scheduler
      expiresAt: null, // Never expires
    },
  });

  console.log(`✅ Created API key: ${apiKey.id}`);
  console.log(`📋 API Key Details:`);
  console.log(`   - Name: ${apiKey.name}`);
  console.log(`   - User: ${serviceUser.email}`);
  console.log(`   - Scopes: ${JSON.stringify(apiKey.scopes)}`);
  console.log(`   - Expires: Never`);
  console.log('');
  console.log('✨ The scheduler can now authenticate with the API!');
  console.log(`   Environment variable: API_SERVICE_ACCOUNT_TOKEN=${plaintextKey}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Error creating API key:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

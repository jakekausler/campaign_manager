import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== RELATIONSHIP VERIFICATION ===\n');

  // 1. Verify settlement → location relationships
  console.log('1. Settlement → Location Relationships:');
  const settlements = await prisma.settlement.findMany({
    include: { location: true },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  });

  let settlementLocationOk = true;
  for (const settlement of settlements) {
    if (!settlement.location) {
      console.log(`  ❌ Settlement "${settlement.name}" has no location!`);
      settlementLocationOk = false;
    }
  }
  if (settlementLocationOk) {
    console.log(`  ✅ All ${settlements.length} settlements have valid location references`);
  }

  // 2. Verify structure → settlement relationships
  console.log('\n2. Structure → Settlement Relationships:');
  const structures = await prisma.structure.findMany({
    include: { settlement: true },
    orderBy: { name: 'asc' },
  });

  let structureSettlementOk = true;
  for (const structure of structures) {
    if (!structure.settlement) {
      console.log(`  ❌ Structure "${structure.name}" has no settlement!`);
      structureSettlementOk = false;
    } else if (structure.level > structure.settlement.level) {
      console.log(
        `  ❌ Structure "${structure.name}" (level ${structure.level}) exceeds settlement "${structure.settlement.name}" (level ${structure.settlement.level})!`
      );
      structureSettlementOk = false;
    }
  }
  if (structureSettlementOk) {
    console.log(`  ✅ All ${structures.length} structures have valid settlement references`);
    console.log(`  ✅ All structure levels ≤ parent settlement levels`);
  }

  // 3. Verify settlement → kingdom relationships
  console.log('\n3. Settlement → Kingdom Relationships:');
  const settlementsWithKingdoms = await prisma.settlement.findMany({
    include: { kingdom: true },
  });

  let settlementKingdomOk = true;
  for (const settlement of settlementsWithKingdoms) {
    if (!settlement.kingdom) {
      console.log(`  ❌ Settlement "${settlement.name}" has no kingdom!`);
      settlementKingdomOk = false;
    }
  }
  if (settlementKingdomOk) {
    console.log(
      `  ✅ All ${settlementsWithKingdoms.length} settlements have valid kingdom references`
    );
  }

  // 4. Verify location hierarchy (region → locations)
  console.log('\n4. Location Hierarchy (Region → Location):');
  const childLocations = await prisma.location.findMany({
    where: { parentLocationId: { not: null } },
    include: { parent: true },
  });

  let locationHierarchyOk = true;
  for (const child of childLocations) {
    if (!child.parent) {
      console.log(`  ❌ Location "${child.name}" has parentLocationId but no parent!`);
      locationHierarchyOk = false;
    }
  }
  if (locationHierarchyOk) {
    console.log(
      `  ✅ All ${childLocations.length} locations have valid parent location (region) references`
    );
  }

  // 5. Verify event → condition relationships (polymorphic)
  console.log('\n5. Event → Condition Relationships (Polymorphic):');
  const events = await prisma.event.findMany();
  const conditions = await prisma.condition.findMany({
    where: { entityType: 'EVENT' },
  });

  let eventConditionOk = true;
  for (const condition of conditions) {
    const event = events.find((e) => e.id === condition.entityId);
    if (!event) {
      console.log(
        `  ❌ Condition ${condition.id} references non-existent event ${condition.entityId}!`
      );
      eventConditionOk = false;
    }
  }
  if (eventConditionOk) {
    console.log(`  ✅ All ${conditions.length} event conditions reference valid events`);
  }

  // 6. Verify event → effect relationships (polymorphic)
  console.log('\n6. Event → Effect Relationships (Polymorphic):');
  const effects = await prisma.effect.findMany({
    where: { entityType: 'EVENT' },
  });

  let eventEffectOk = true;
  for (const effect of effects) {
    const event = events.find((e) => e.id === effect.entityId);
    if (!event) {
      console.log(`  ❌ Effect ${effect.id} references non-existent event ${effect.entityId}!`);
      eventEffectOk = false;
    }
  }
  if (eventEffectOk) {
    console.log(`  ✅ All ${effects.length} event effects reference valid events`);
  }

  // 7. Verify encounter → dependency link relationships (polymorphic)
  console.log('\n7. Encounter → Link Relationships (Polymorphic):');
  const encounters = await prisma.encounter.findMany();
  const links = await prisma.link.findMany({
    where: {
      sourceType: 'encounter',
      targetType: 'encounter',
    },
  });

  let encounterLinkOk = true;
  for (const link of links) {
    const sourceEncounter = encounters.find((e) => e.id === link.sourceId);
    const targetEncounter = encounters.find((e) => e.id === link.targetId);

    if (!sourceEncounter) {
      console.log(
        `  ❌ Link ${link.id} references non-existent source encounter ${link.sourceId}!`
      );
      encounterLinkOk = false;
    }
    if (!targetEncounter) {
      console.log(
        `  ❌ Link ${link.id} references non-existent target encounter ${link.targetId}!`
      );
      encounterLinkOk = false;
    }
  }
  if (encounterLinkOk) {
    console.log(
      `  ✅ All ${links.length} encounter links reference valid source and target encounters`
    );
  }

  // 8. Verify branch → campaign relationships
  console.log('\n8. Branch → Campaign Relationships:');
  const branches = await prisma.branch.findMany({
    include: { campaign: true },
  });

  let branchCampaignOk = true;
  for (const branch of branches) {
    if (!branch.campaign) {
      console.log(`  ❌ Branch "${branch.name}" has no campaign!`);
      branchCampaignOk = false;
    }
  }
  if (branchCampaignOk) {
    console.log(`  ✅ All ${branches.length} branches have valid campaign references`);
  }

  // Summary
  console.log('\n=== VERIFICATION SUMMARY ===\n');
  const allOk =
    settlementLocationOk &&
    structureSettlementOk &&
    settlementKingdomOk &&
    locationHierarchyOk &&
    eventConditionOk &&
    eventEffectOk &&
    encounterLinkOk &&
    branchCampaignOk;

  if (allOk) {
    console.log('✅ ALL RELATIONSHIPS VERIFIED SUCCESSFULLY!');
  } else {
    console.log('❌ SOME RELATIONSHIPS FAILED VERIFICATION');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Error during verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

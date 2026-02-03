import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, asc, sql, inArray } from 'drizzle-orm';

async function investigateNode623() {
    console.log('\n🔍 Investigating Node 623...\n');

    // Check node 623
    const node623 = await db.select().from(nodes).where(eq(nodes.id, 623));

    if (node623.length === 0) {
        console.log('❌ Node 623 does NOT exist!');
        return;
    }

    console.log('📦 Node 623 exists:');
    console.log(`   Unit ID: ${node623[0].unitId}`);
    console.log(`   Type: ${node623[0].type}`);
    console.log(`   Order: ${node623[0].order}`);

    // Get the unit
    const unit = await db.select().from(units).where(eq(units.id, node623[0].unitId));
    if (unit.length > 0) {
        console.log(`\n📚 Unit: ${unit[0].name}`);
        console.log(`   Level ID: ${unit[0].levelId}`);

        // Get the level
        const level = await db.select().from(levels).where(eq(levels.id, unit[0].levelId));
        if (level.length > 0) {
            console.log(`\n🎯 Level: ${level[0].name}`);
            console.log(`   Deck ID: ${level[0].deckId}`);
        }
    }

    // Get vocabulary for node 623
    const vocabFor623 = await db
        .select({ word: vocabulary.word, tag: vocabulary.tag, order: nodeVocabulary.order })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, 623))
        .orderBy(asc(nodeVocabulary.order));

    console.log(`\n📝 Vocabulary in Node 623 (${vocabFor623.length} words):`);
    vocabFor623.forEach((w, i) => {
        console.log(`   ${i + 1}. "${w.word}" - ${w.tag}`);
    });

    // Check ALL TOEIC decks
    console.log('\n\n📊 All TOEIC-related levels:');
    const allToeicLevels = await db.select().from(levels).where(sql`deck_id LIKE '%toeic%' OR deck_id LIKE '%Toeic%' OR deck_id LIKE '%TOEIC%'`);

    for (const lvl of allToeicLevels) {
        console.log(`\n📚 Level: ${lvl.name} (ID: ${lvl.id}, Deck: ${lvl.deckId})`);

        const lvlUnits = await db.select().from(units).where(eq(units.levelId, lvl.id)).orderBy(asc(units.order));
        console.log(`   Units: ${lvlUnits.length}`);

        for (const u of lvlUnits.slice(0, 2)) {
            const unitNodes = await db.select().from(nodes).where(eq(nodes.unitId, u.id)).orderBy(asc(nodes.order));
            console.log(`   - Unit "${u.name}": ${unitNodes.length} nodes (IDs: ${unitNodes.slice(0, 3).map(n => n.id).join(', ')}...)`);
        }
    }

    process.exit(0);
}

investigateNode623().catch(err => {
    console.error(err);
    process.exit(1);
});

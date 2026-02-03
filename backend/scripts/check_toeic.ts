import { db } from '../src/db/client';
import { levels, units, nodes, vocabulary } from '../src/db/schema';
import { eq, like, asc, inArray, sql } from 'drizzle-orm';

async function checkToeicData() {
    console.log('\n📊 TOEIC Deck Analysis:');

    // Check levels
    console.log('\n📚 Levels:');
    const toeicLevels = await db.select().from(levels).where(eq(levels.deckId, 'toeic')).orderBy(asc(levels.order));
    toeicLevels.forEach(l => console.log(`  ${l.order}: ${l.name} (id: ${l.id})`));

    // Check units per level
    console.log('\n📦 Units per Level:');
    for (const level of toeicLevels) {
        const levelUnits = await db.select().from(units).where(eq(units.levelId, level.id)).orderBy(asc(units.order));
        console.log(`  ${level.name}: ${levelUnits.length} units`);
    }

    // Check nodes per level
    console.log('\n🔢 Nodes per Level:');
    for (const level of toeicLevels) {
        const levelUnits = await db.select().from(units).where(eq(units.levelId, level.id));
        const unitIds = levelUnits.map(u => u.id);
        if (unitIds.length > 0) {
            const levelNodes = await db.select().from(nodes).where(inArray(nodes.unitId, unitIds));
            console.log(`  ${level.name}: ${levelNodes.length} nodes`);
        }
    }

    // Check vocabulary tags
    console.log('\n📖 Vocabulary Sample (first 10 with Toeic tag):');
    const toeicVocab = await db
        .select({ id: vocabulary.id, word: vocabulary.word, tag: vocabulary.tag })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'))
        .limit(10);
    toeicVocab.forEach(v => console.log(`  ${v.id}: "${v.word}" - tag: "${v.tag}"`));

    // Count total TOEIC words
    const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'));
    console.log(`\n📊 Total TOEIC words: ${totalCount[0]?.count}`);

    process.exit(0);
}

checkToeicData().catch(err => {
    console.error(err);
    process.exit(1);
});

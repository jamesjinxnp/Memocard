import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

async function detailedVerify() {
    console.log('\n📊 Detailed TOEIC Verification:');

    // Get all levels
    const toeicLevels = await db.select().from(levels).where(eq(levels.deckId, 'toeic')).orderBy(asc(levels.order));

    for (const level of toeicLevels) {
        console.log(`\n📚 ${level.name}:`);

        const levelUnits = await db.select().from(units).where(eq(units.levelId, level.id)).orderBy(asc(units.order));
        if (levelUnits.length === 0) continue;

        const firstUnit = levelUnits[0];
        const firstNode = await db.select().from(nodes).where(eq(nodes.unitId, firstUnit.id)).orderBy(asc(nodes.order)).limit(1);
        if (firstNode.length === 0) continue;

        const nodeWords = await db
            .select({ word: vocabulary.word, tag: vocabulary.tag })
            .from(nodeVocabulary)
            .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
            .where(eq(nodeVocabulary.nodeId, firstNode[0].id))
            .orderBy(asc(nodeVocabulary.order));

        // Extract level info from each word's tag
        console.log(`   First Unit: ${firstUnit.name}`);
        console.log(`   First Node ID: ${firstNode[0].id}`);
        console.log(`   Words:`);

        nodeWords.forEach((w, i) => {
            const levelMatch = w.tag?.match(/\b(Basic|Advanced|Expert|Master)\b/);
            const wordLevel = levelMatch ? levelMatch[1] : 'N/A';
            const rangeMatch = w.tag?.match(/\((\d+-\d+)\)/);
            const range = rangeMatch ? rangeMatch[1] : 'N/A';
            console.log(`      ${i + 1}. "${w.word}" [${wordLevel}] (${range})`);
        });
    }

    process.exit(0);
}

detailedVerify().catch(err => {
    console.error(err);
    process.exit(1);
});

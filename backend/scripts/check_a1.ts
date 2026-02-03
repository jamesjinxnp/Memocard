import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

async function checkA1() {
    console.log('\n🔍 Checking A1 Level in oxford3000:');

    // Get Level A1
    const a1Level = await db.select().from(levels).where(eq(levels.deckId, 'oxford3000')).orderBy(asc(levels.order)).limit(1);
    console.log('Level:', a1Level[0]?.name, '(id:', a1Level[0]?.id, ')');

    if (!a1Level[0]) {
        console.log('❌ No A1 level found');
        process.exit(1);
    }

    // Get units for A1
    const a1Units = await db.select().from(units).where(eq(units.levelId, a1Level[0].id)).orderBy(asc(units.order));
    console.log('Units:', a1Units.length);

    if (a1Units.length === 0) {
        console.log('❌ No units found for A1 level');
        process.exit(1);
    }

    // Get nodes for A1 units
    const unitIds = a1Units.map(u => u.id);
    const a1Nodes = await db.select().from(nodes).where(inArray(nodes.unitId, unitIds)).orderBy(asc(nodes.order));
    console.log('Nodes:', a1Nodes.length);

    if (a1Nodes.length === 0) {
        console.log('❌ No nodes found for A1 units');
        process.exit(1);
    }

    // Get first node vocabulary
    const firstNodeId = a1Nodes[0].id;
    const nodeWords = await db
        .select({
            word: vocabulary.word,
            cefr: vocabulary.cefr,
            order: nodeVocabulary.order,
        })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, firstNodeId))
        .orderBy(asc(nodeVocabulary.order));

    console.log('\nFirst A1 node (id:', firstNodeId, ') words:');
    nodeWords.forEach((w, i) => {
        console.log(`  ${i + 1}. "${w.word}" (CEFR: ${w.cefr})`);
    });

    // Count total words in A1 level
    const allNodeIds = a1Nodes.map(n => n.id);
    const totalA1Words = await db.select().from(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, allNodeIds));
    console.log('\nTotal words in A1 level:', totalA1Words.length);

    process.exit(0);
}

checkA1().catch(err => {
    console.error(err);
    process.exit(1);
});

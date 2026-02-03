import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

async function verifyToeicJson() {
    const report: any = { levels: [] };

    const toeicLevels = await db.select().from(levels).where(eq(levels.deckId, 'toeic')).orderBy(asc(levels.order));

    for (const level of toeicLevels) {
        const levelReport: any = {
            name: level.name,
            firstNodeWords: [],
            totalWords: 0,
            totalNodes: 0
        };

        const levelUnits = await db.select().from(units).where(eq(units.levelId, level.id)).orderBy(asc(units.order));

        if (levelUnits.length > 0) {
            const firstUnit = levelUnits[0];
            const firstNode = await db.select().from(nodes).where(eq(nodes.unitId, firstUnit.id)).orderBy(asc(nodes.order)).limit(1);

            if (firstNode.length > 0) {
                const nodeWords = await db
                    .select({ word: vocabulary.word, tag: vocabulary.tag })
                    .from(nodeVocabulary)
                    .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
                    .where(eq(nodeVocabulary.nodeId, firstNode[0].id))
                    .orderBy(asc(nodeVocabulary.order));

                levelReport.firstNodeWords = nodeWords.map(w => {
                    const rangeMatch = w.tag?.match(/\((\d{3}-\d{3,4})\)/);
                    return { word: w.word, range: rangeMatch ? rangeMatch[1] : 'N/A' };
                });
            }

            const unitIds = levelUnits.map(u => u.id);
            const levelNodes = await db.select().from(nodes).where(inArray(nodes.unitId, unitIds));
            const nodeIds = levelNodes.map(n => n.id);
            const totalWords = await db.select().from(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, nodeIds));

            levelReport.totalWords = totalWords.length;
            levelReport.totalNodes = levelNodes.length;
        }

        report.levels.push(levelReport);
    }

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
}

verifyToeicJson().catch(err => {
    console.error(err);
    process.exit(1);
});

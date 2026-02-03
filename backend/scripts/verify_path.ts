/**
 * Verify reorganized path data
 * Run: bun run scripts/verify_path.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';

async function verifyPath(deckId: string) {
    console.log(`\n📊 Verifying deck: ${deckId}`);
    console.log('='.repeat(50));

    // Get levels
    const deckLevels = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, deckId))
        .orderBy(asc(levels.order));

    console.log(`Found ${deckLevels.length} levels\n`);

    for (const level of deckLevels) {
        console.log(`📚 ${level.name}:`);

        // Get units
        const levelUnits = await db
            .select()
            .from(units)
            .where(eq(units.levelId, level.id))
            .orderBy(asc(units.order));

        const unitIds = levelUnits.map(u => u.id);
        if (unitIds.length === 0) continue;

        // Get nodes
        const levelNodes = await db
            .select()
            .from(nodes)
            .where(inArray(nodes.unitId, unitIds))
            .orderBy(asc(nodes.order));

        // Get first node's vocabulary
        if (levelNodes.length > 0) {
            const firstNodeId = levelNodes[0].id;
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

            console.log(`   First node (ID: ${firstNodeId}) has ${nodeWords.length} words:`);
            nodeWords.slice(0, 5).forEach((w, i) => {
                console.log(`     ${i + 1}. "${w.word}" (CEFR: ${w.cefr})`);
            });
            if (nodeWords.length > 5) {
                console.log(`     ... and ${nodeWords.length - 5} more`);
            }

            // Count total words in this level
            const nodeIds = levelNodes.map(n => n.id);
            const totalWords = await db
                .select()
                .from(nodeVocabulary)
                .where(inArray(nodeVocabulary.nodeId, nodeIds));

            console.log(`   Total: ${totalWords.length} words across ${levelNodes.length} nodes\n`);
        }
    }
}

async function main() {
    console.log('🔍 Verifying Learning Path Data');
    console.log('================================\n');

    await verifyPath('oxford3000');
    await verifyPath('oxford5000');

    console.log('\n✅ Verification complete!');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});

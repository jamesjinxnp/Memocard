/**
 * Reorganize Learning Path Script
 * 
 * This script reorganizes vocabulary in the learning path so that:
 * 1. Each Level (A1, A2, B1, B2, C1) contains only words with matching CEFR level
 * 2. Words within each level are sorted alphabetically (A-Z)
 * 3. Words are distributed evenly across nodes (8 words per node)
 * 
 * Run: bun run scripts/reorganize_path.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, and, like, asc, inArray } from 'drizzle-orm';

const WORDS_PER_NODE = 8;

// CEFR level order mapping
const CEFR_ORDER: Record<string, number> = {
    'A1': 0,
    'A2': 1,
    'B1': 2,
    'B2': 3,
    'C1': 4,
    'C2': 5,
};

interface VocabWord {
    id: number;
    word: string;
    cefr: string | null;
}

async function reorganizePath(deckId: string) {
    console.log(`\n🔄 Reorganizing path for deck: ${deckId}`);
    console.log('='.repeat(50));

    // 1. Fetch all levels for this deck, ordered
    const deckLevels = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, deckId))
        .orderBy(asc(levels.order));

    if (deckLevels.length === 0) {
        console.log(`❌ No levels found for deck: ${deckId}`);
        return;
    }

    console.log(`📚 Found ${deckLevels.length} levels`);

    // 2. Fetch all vocabulary matching this deck's tag
    const allVocab = await db
        .select({
            id: vocabulary.id,
            word: vocabulary.word,
            cefr: vocabulary.cefr,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, `%${deckId}%`));

    console.log(`📖 Found ${allVocab.length} vocabulary words for ${deckId}`);

    // 3. Group vocabulary by CEFR level
    const vocabByCefr: Map<string, VocabWord[]> = new Map();

    for (const word of allVocab) {
        const cefr = word.cefr?.toUpperCase() || 'UNKNOWN';
        if (!vocabByCefr.has(cefr)) {
            vocabByCefr.set(cefr, []);
        }
        vocabByCefr.get(cefr)!.push(word);
    }

    // 4. Sort each CEFR group alphabetically by word
    for (const [cefr, words] of vocabByCefr) {
        words.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
        console.log(`  📝 ${cefr}: ${words.length} words`);
    }

    // 5. Get all nodes for each level
    const nodeVocabInserts: { nodeId: number; vocabularyId: number; order: number }[] = [];
    const nodeIdsToDelete: number[] = [];

    for (const level of deckLevels) {
        // Extract CEFR from level name (e.g., "Level A1" -> "A1", "A1 - Beginner" -> "A1")
        const levelCefr = extractCefr(level.name);

        console.log(`\n🎯 Processing ${level.name} (CEFR: ${levelCefr})`);

        // Get units for this level
        const levelUnits = await db
            .select()
            .from(units)
            .where(eq(units.levelId, level.id))
            .orderBy(asc(units.order));

        // Get all nodes for these units
        const unitIds = levelUnits.map(u => u.id);
        if (unitIds.length === 0) {
            console.log(`  ⚠️  No units found for this level`);
            continue;
        }

        const levelNodes = await db
            .select()
            .from(nodes)
            .where(inArray(nodes.unitId, unitIds))
            .orderBy(asc(nodes.order));

        console.log(`  📦 Found ${levelUnits.length} units, ${levelNodes.length} nodes`);

        // Track node IDs for deletion
        nodeIdsToDelete.push(...levelNodes.map(n => n.id));

        // Get vocabulary for this CEFR level
        const cefrVocab = vocabByCefr.get(levelCefr) || [];

        if (cefrVocab.length === 0) {
            console.log(`  ⚠️  No vocabulary found for CEFR ${levelCefr}`);
            continue;
        }

        console.log(`  📝 Distributing ${cefrVocab.length} words across ${levelNodes.length} nodes`);

        // Distribute words across nodes
        let wordIndex = 0;
        for (const node of levelNodes) {
            for (let i = 0; i < WORDS_PER_NODE && wordIndex < cefrVocab.length; i++) {
                nodeVocabInserts.push({
                    nodeId: node.id,
                    vocabularyId: cefrVocab[wordIndex].id,
                    order: i,
                });
                wordIndex++;
            }
        }

        console.log(`  ✅ Assigned ${wordIndex} words to nodes`);

        if (wordIndex < cefrVocab.length) {
            console.log(`  ⚠️  ${cefrVocab.length - wordIndex} words couldn't fit (not enough nodes)`);
        }
    }

    // 6. Delete old node_vocabulary entries and insert new ones
    console.log(`\n💾 Committing changes...`);

    if (nodeIdsToDelete.length > 0) {
        // Delete in batches to avoid query size limits
        const batchSize = 100;
        for (let i = 0; i < nodeIdsToDelete.length; i += batchSize) {
            const batch = nodeIdsToDelete.slice(i, i + batchSize);
            await db.delete(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, batch));
        }
        console.log(`  🗑️  Deleted old entries for ${nodeIdsToDelete.length} nodes`);
    }

    if (nodeVocabInserts.length > 0) {
        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < nodeVocabInserts.length; i += batchSize) {
            const batch = nodeVocabInserts.slice(i, i + batchSize);
            await db.insert(nodeVocabulary).values(batch);
        }
        console.log(`  ✅ Inserted ${nodeVocabInserts.length} new entries`);
    }

    console.log(`\n🎉 Done! Deck "${deckId}" has been reorganized.`);
}

/**
 * Extract CEFR level from level name
 * Examples: "Level A1" -> "A1", "A1 - Beginner" -> "A1", "B2 Words" -> "B2"
 */
function extractCefr(levelName: string): string {
    const match = levelName.match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
}

// Main execution
async function main() {
    console.log('🚀 Starting Learning Path Reorganization');
    console.log('=========================================\n');

    // Process both Oxford decks
    await reorganizePath('oxford3000');
    await reorganizePath('oxford5000');

    console.log('\n=========================================');
    console.log('✨ All decks have been reorganized!');
    console.log('');
    console.log('📋 Summary:');
    console.log('  - Each Level now contains only words with matching CEFR');
    console.log('  - Words are sorted alphabetically (A-Z) within each level');
    console.log('  - Each node contains up to 8 words');

    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});

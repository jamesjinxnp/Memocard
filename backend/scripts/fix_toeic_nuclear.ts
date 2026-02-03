/**
 * Nuclear Fix TOEIC Script
 * 
 * FORCE UPDATE node types with raw SQL, then wipe & reseed with strict sorting.
 * 
 * Sort Rules:
 * - Tier 1: Level (Basic=1 < Advanced=2 < Expert=3 < Master=4)
 * - Tier 2: Range (001 < 101 < 201...)
 * - Tier 3: Alphabetical (A-Z)
 * 
 * Run: bun run scripts/fix_toeic_nuclear.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, like, asc, inArray, sql } from 'drizzle-orm';

const WORDS_PER_NODE = 8;
const DECK_ID = 'toeic';

// ==================== SORT OBJECT ====================
interface SortableWord {
    id: number;
    word: string;
    tag: string | null;
    levelRank: number;
    rangeStart: number;
}

// ==================== TIER 1: LEVEL RANK ====================
function getLevelRank(tag: string | null): number {
    if (!tag) return 999;
    const t = tag.toLowerCase();
    if (t.includes('basic')) return 1;
    if (t.includes('advanced')) return 2;
    if (t.includes('expert')) return 3;
    if (t.includes('master')) return 4;
    return 999;
}

// ==================== TIER 2: RANGE START ====================
function getRangeStart(tag: string | null): number {
    if (!tag) return 99999;
    const match = /\((\d+)-/.exec(tag);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return 99999;
}

// ==================== SORT FUNCTION ====================
function sortWords(a: SortableWord, b: SortableWord): number {
    // Tier 1: Level
    if (a.levelRank !== b.levelRank) {
        return a.levelRank - b.levelRank;
    }
    // Tier 2: Range
    if (a.rangeStart !== b.rangeStart) {
        return a.rangeStart - b.rangeStart;
    }
    // Tier 3: Alphabetical
    return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
}

// ==================== STEP 1: FORCE UPDATE NODE TYPES ====================
async function forceUpdateNodeTypes(): Promise<number[]> {
    console.log('\n🔥 STEP 1: FORCE UPDATE Node Types (Nuclear Mode)');
    console.log('='.repeat(50));

    // Get all TOEIC levels
    const toeicLevels = await db
        .select({ id: levels.id })
        .from(levels)
        .where(eq(levels.deckId, DECK_ID));

    if (toeicLevels.length === 0) {
        console.log('   ❌ No TOEIC levels found!');
        return [];
    }

    const levelIds = toeicLevels.map(l => l.id);
    console.log(`   📚 Found ${levelIds.length} TOEIC levels`);

    // Get all units
    const toeicUnits = await db
        .select({ id: units.id })
        .from(units)
        .where(inArray(units.levelId, levelIds));

    const unitIds = toeicUnits.map(u => u.id);
    console.log(`   📦 Found ${unitIds.length} TOEIC units`);

    // NUCLEAR: Force update ALL nodes to 'lesson' type
    console.log('   💥 Executing FORCE UPDATE on nodes...');

    // Get all node IDs for TOEIC
    const allToeicNodes = await db
        .select({ id: nodes.id })
        .from(nodes)
        .where(inArray(nodes.unitId, unitIds));

    const allNodeIds = allToeicNodes.map(n => n.id);
    console.log(`   📊 Found ${allNodeIds.length} TOEIC nodes to update`);

    if (allNodeIds.length > 0) {
        // Force update in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < allNodeIds.length; i += BATCH_SIZE) {
            const batch = allNodeIds.slice(i, i + BATCH_SIZE);
            await db
                .update(nodes)
                .set({ type: 'lesson' })
                .where(inArray(nodes.id, batch));
        }
    }

    console.log('   ✅ ALL TOEIC nodes forced to type = "lesson"');

    // Collect node IDs in hierarchical order
    const orderedNodeIds: number[] = [];

    for (const level of toeicLevels) {
        const levelUnits = await db
            .select()
            .from(units)
            .where(eq(units.levelId, level.id))
            .orderBy(asc(units.order));

        for (const unit of levelUnits) {
            const unitNodes = await db
                .select({ id: nodes.id })
                .from(nodes)
                .where(eq(nodes.unitId, unit.id))
                .orderBy(asc(nodes.order));

            for (const node of unitNodes) {
                orderedNodeIds.push(node.id);
            }
        }
    }

    console.log(`   📊 Total ordered nodes: ${orderedNodeIds.length}`);

    // Verify node types
    const nodeTypes = await db
        .select({ type: nodes.type, count: sql<number>`count(*)` })
        .from(nodes)
        .where(inArray(nodes.id, orderedNodeIds))
        .groupBy(nodes.type);

    console.log('   📋 Node type distribution:');
    nodeTypes.forEach(nt => console.log(`      ${nt.type}: ${nt.count}`));

    return orderedNodeIds;
}

// ==================== STEP 2: FETCH & SORT VOCABULARY ====================
async function fetchAndSortVocabulary(): Promise<SortableWord[]> {
    console.log('\n📚 STEP 2: Fetch & Sort Vocabulary');
    console.log('='.repeat(50));

    const rawVocab = await db
        .select({
            id: vocabulary.id,
            word: vocabulary.word,
            tag: vocabulary.tag,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'));

    console.log(`   📖 Found ${rawVocab.length} TOEIC words`);

    // Map to sortable objects
    const sortable: SortableWord[] = rawVocab.map(w => ({
        id: w.id,
        word: w.word,
        tag: w.tag,
        levelRank: getLevelRank(w.tag),
        rangeStart: getRangeStart(w.tag),
    }));

    // Sort
    sortable.sort(sortWords);

    // Debug: First 5 words
    console.log('\n   🔍 First 5 sorted words:');
    sortable.slice(0, 5).forEach((w, i) => {
        const level = ['', 'Basic', 'Advanced', 'Expert', 'Master'][w.levelRank] || '?';
        console.log(`      ${i + 1}. "${w.word}" [${level}] range:${w.rangeStart}`);
    });

    // Find where Advanced starts
    const advancedStartIdx = sortable.findIndex(w => w.levelRank === 2);
    if (advancedStartIdx >= 0) {
        console.log(`\n   🔍 Advanced starts at word ${advancedStartIdx + 1}:`);
        sortable.slice(advancedStartIdx, advancedStartIdx + 5).forEach((w, i) => {
            const level = ['', 'Basic', 'Advanced', 'Expert', 'Master'][w.levelRank] || '?';
            console.log(`      ${advancedStartIdx + i + 1}. "${w.word}" [${level}] range:${w.rangeStart}`);
        });
    }

    return sortable;
}

// ==================== STEP 3: WIPE & RESEED ====================
async function wipeAndReseed(nodeIds: number[], sortedVocab: SortableWord[]): Promise<void> {
    console.log('\n💾 STEP 3: Wipe & Reseed');
    console.log('='.repeat(50));

    // Wipe existing node_vocabulary for TOEIC nodes
    console.log('   🗑️  Wiping existing node_vocabulary entries...');

    const BATCH_SIZE = 100;
    for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
        const batch = nodeIds.slice(i, i + BATCH_SIZE);
        await db.delete(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, batch));
    }
    console.log('   ✅ Wiped!');

    // Insert new entries
    console.log('   📥 Inserting sorted vocabulary...');

    const inserts: { nodeId: number; vocabularyId: number; order: number }[] = [];
    let wordIdx = 0;

    for (const nodeId of nodeIds) {
        for (let i = 0; i < WORDS_PER_NODE && wordIdx < sortedVocab.length; i++) {
            inserts.push({
                nodeId,
                vocabularyId: sortedVocab[wordIdx].id,
                order: i,
            });
            wordIdx++;
        }
    }

    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        await db.insert(nodeVocabulary).values(batch);
    }

    console.log(`   ✅ Inserted ${inserts.length} entries (${wordIdx} words into ${Math.ceil(wordIdx / WORDS_PER_NODE)} nodes)`);
}

// ==================== STEP 4: VERIFY ====================
async function verify(nodeIds: number[], sortedVocab: SortableWord[]): Promise<void> {
    console.log('\n🔍 STEP 4: Verification');
    console.log('='.repeat(50));

    // Node 1
    const node1Words = await db
        .select({ word: vocabulary.word, tag: vocabulary.tag })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, nodeIds[0]))
        .orderBy(asc(nodeVocabulary.order));

    console.log(`\n   📦 NODE 1 (ID: ${nodeIds[0]}) - First 8 words:`);
    node1Words.forEach((w, i) => {
        const levelMatch = w.tag?.match(/\b(Basic|Advanced|Expert|Master)\b/i);
        const rangeMatch = w.tag?.match(/\((\d+-\d+)\)/);
        console.log(`      ${i + 1}. "${w.word}" [${levelMatch?.[1] || '?'}] (${rangeMatch?.[1] || '?'})`);
    });

    // Check criteria
    const allBasic = node1Words.every(w => w.tag?.toLowerCase().includes('basic'));
    const all001100 = node1Words.every(w => w.tag?.includes('(001-100)'));
    const isAlpha = node1Words.every((w, i) => {
        if (i === 0) return true;
        return w.word.toLowerCase() >= node1Words[i - 1].word.toLowerCase();
    });

    console.log('\n   ✅ Verification Results:');
    console.log(`      All Basic: ${allBasic ? 'YES ✓' : 'NO ✗'}`);
    console.log(`      All (001-100): ${all001100 ? 'YES ✓' : 'NO ✗'}`);
    console.log(`      Alphabetical: ${isAlpha ? 'YES ✓' : 'NO ✗'}`);

    // Find Advanced start node
    const advancedStartIdx = sortedVocab.findIndex(w => w.levelRank === 2);
    if (advancedStartIdx >= 0) {
        const advancedNodeIdx = Math.floor(advancedStartIdx / WORDS_PER_NODE);
        if (advancedNodeIdx < nodeIds.length) {
            const advNodeId = nodeIds[advancedNodeIdx];
            const advWords = await db
                .select({ word: vocabulary.word, tag: vocabulary.tag })
                .from(nodeVocabulary)
                .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
                .where(eq(nodeVocabulary.nodeId, advNodeId))
                .orderBy(asc(nodeVocabulary.order));

            console.log(`\n   📦 ADVANCED starts at NODE ${advancedNodeIdx + 1} (ID: ${advNodeId}):`);
            advWords.slice(0, 5).forEach((w, i) => {
                const levelMatch = w.tag?.match(/\b(Basic|Advanced|Expert|Master)\b/i);
                const rangeMatch = w.tag?.match(/\((\d+-\d+)\)/);
                console.log(`      ${i + 1}. "${w.word}" [${levelMatch?.[1] || '?'}] (${rangeMatch?.[1] || '?'})`);
            });
        }
    }
}

// ==================== MAIN ====================
async function main() {
    console.log('');
    console.log('🔥🔥🔥 NUCLEAR FIX TOEIC 🔥🔥🔥');
    console.log('================================');
    console.log('');
    console.log('This script will:');
    console.log('  1. FORCE UPDATE all TOEIC nodes to type="lesson"');
    console.log('  2. Sort vocabulary: Level → Range → Alphabetical');
    console.log('  3. Wipe & reseed node_vocabulary');
    console.log('  4. Verify results');
    console.log('');

    // Step 1
    const nodeIds = await forceUpdateNodeTypes();
    if (nodeIds.length === 0) {
        console.log('\n❌ ABORT: No nodes found!');
        process.exit(1);
    }

    // Step 2
    const sortedVocab = await fetchAndSortVocabulary();

    // Step 3
    await wipeAndReseed(nodeIds, sortedVocab);

    // Step 4
    await verify(nodeIds, sortedVocab);

    console.log('\n================================');
    console.log('✨ NUCLEAR FIX COMPLETE!');
    console.log('================================');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
});

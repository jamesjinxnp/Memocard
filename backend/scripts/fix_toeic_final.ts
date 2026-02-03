/**
 * Fix TOEIC Final Script
 * 
 * ROBUST sorting with explicit sortObject mapping:
 * 1. Rank: Basic(1) < Advanced(2) < Expert(3) < Master(4)
 * 2. Range: 001 < 101 < 201 ... (parsed via regex)
 * 3. Word: Alphabetical A-Z
 * 
 * Run: bun run scripts/fix_toeic_final.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, like, asc, inArray } from 'drizzle-orm';

const WORDS_PER_NODE = 8;
const DECK_ID = 'toeic';

// ==================== SORT OBJECT TYPE ====================
interface SortableWord {
    id: number;
    word: string;
    tag: string | null;
    rank: number;      // 1=Basic, 2=Advanced, 3=Expert, 4=Master
    rangeStart: number; // 1, 101, 201, etc.
}

// ==================== STEP A: DETECT LEVEL RANK ====================
function getLevelRank(tag: string | null): number {
    if (!tag) return 999;

    // Explicit string matching (case-insensitive)
    const tagLower = tag.toLowerCase();

    if (tagLower.includes('basic')) return 1;
    if (tagLower.includes('advanced')) return 2;
    if (tagLower.includes('expert')) return 3;
    if (tagLower.includes('master')) return 4;

    return 999; // Unknown goes to end
}

// ==================== STEP B: DETECT RANGE START (REGEX) ====================
function getRangeStart(tag: string | null): number {
    if (!tag) return 99999;

    // Regex to extract first number from pattern like (001-100) or (101-200)
    const match = tag.match(/\((\d+)-(\d+)\)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }

    return 99999; // No range goes to end
}

// ==================== STEP C: THE SORT FUNCTION ====================
function compareWords(a: SortableWord, b: SortableWord): number {
    // Priority 1: Compare Rank (Basic < Advanced < Expert < Master)
    if (a.rank !== b.rank) {
        return a.rank - b.rank;
    }

    // Priority 2: Compare Range Start (001 < 101 < 201 ...)
    if (a.rangeStart !== b.rangeStart) {
        return a.rangeStart - b.rangeStart;
    }

    // Priority 3: Alphabetical (A-Z)
    return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
}

// ==================== FETCH & NORMALIZE NODES ====================
async function fetchAndNormalizeNodes(): Promise<number[]> {
    console.log('\n📦 Step 1: Fetching & normalizing TOEIC nodes...');

    // Get all TOEIC levels in order
    const toeicLevels = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, DECK_ID))
        .orderBy(asc(levels.order));

    if (toeicLevels.length === 0) {
        console.log('   ⚠️  No TOEIC levels found!');
        return [];
    }

    console.log(`   📚 Found ${toeicLevels.length} levels`);

    // Collect nodes in hierarchical order: Level → Unit → Node
    const orderedNodeIds: number[] = [];

    for (const level of toeicLevels) {
        const levelUnits = await db
            .select()
            .from(units)
            .where(eq(units.levelId, level.id))
            .orderBy(asc(units.order));

        for (const unit of levelUnits) {
            const unitNodes = await db
                .select()
                .from(nodes)
                .where(eq(nodes.unitId, unit.id))
                .orderBy(asc(nodes.order));

            for (const node of unitNodes) {
                orderedNodeIds.push(node.id);
            }
        }
    }

    console.log(`   📦 Found ${orderedNodeIds.length} nodes`);

    // Normalize: Convert ALL nodes to 'lesson' type (NO BOSSES)
    if (orderedNodeIds.length > 0) {
        await db
            .update(nodes)
            .set({ type: 'lesson' })
            .where(inArray(nodes.id, orderedNodeIds));
        console.log(`   ✅ All nodes set to 'lesson' type`);
    }

    return orderedNodeIds;
}

// ==================== FETCH, MAP, & SORT VOCABULARY ====================
async function fetchAndSortVocabulary(): Promise<SortableWord[]> {
    console.log('\n📚 Step 2: Fetching & sorting TOEIC vocabulary...');

    // Fetch all TOEIC vocabulary
    const rawVocab = await db
        .select({
            id: vocabulary.id,
            word: vocabulary.word,
            tag: vocabulary.tag,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'));

    console.log(`   📖 Found ${rawVocab.length} TOEIC words`);

    // MAP each word to a SortableWord object
    const sortableWords: SortableWord[] = rawVocab.map(w => ({
        id: w.id,
        word: w.word,
        tag: w.tag,
        rank: getLevelRank(w.tag),
        rangeStart: getRangeStart(w.tag),
    }));

    // SORT using the comparison function
    sortableWords.sort(compareWords);

    // ==================== DEBUG LOG ====================
    console.log('\n   🔍 DEBUG: First 10 words after sorting:');
    sortableWords.slice(0, 10).forEach((w, i) => {
        const levelName = ['', 'Basic', 'Advanced', 'Expert', 'Master'][w.rank] || 'Unknown';
        console.log(`      ${i + 1}. "${w.word}" [${levelName}] range:${w.rangeStart} (rank:${w.rank})`);
    });

    // Log transition points
    console.log('\n   🔄 Level/Range transitions:');
    let prevRank = 0;
    let prevRange = 0;
    for (let i = 0; i < sortableWords.length; i++) {
        const w = sortableWords[i];
        if (w.rank !== prevRank || w.rangeStart !== prevRange) {
            const levelName = ['', 'Basic', 'Advanced', 'Expert', 'Master'][w.rank] || 'Unknown';
            console.log(`      Word ${i + 1}: "${w.word}" => ${levelName} (${w.rangeStart}-${w.rangeStart + 99})`);
            prevRank = w.rank;
            prevRange = w.rangeStart;
        }
    }

    return sortableWords;
}

// ==================== DISTRIBUTE TO NODES ====================
interface NodeVocabInsert {
    nodeId: number;
    vocabularyId: number;
    order: number;
}

function distributeToNodes(nodeIds: number[], sortedVocab: SortableWord[]): NodeVocabInsert[] {
    console.log('\n🎯 Step 3: Distributing vocabulary to nodes...');

    const inserts: NodeVocabInsert[] = [];

    let wordIndex = 0;
    for (const nodeId of nodeIds) {
        for (let i = 0; i < WORDS_PER_NODE && wordIndex < sortedVocab.length; i++) {
            inserts.push({
                nodeId,
                vocabularyId: sortedVocab[wordIndex].id,
                order: i,
            });
            wordIndex++;
        }
    }

    console.log(`   ✅ Distributed ${wordIndex} words across ${Math.ceil(wordIndex / WORDS_PER_NODE)} nodes`);

    if (wordIndex < sortedVocab.length) {
        console.log(`   ⚠️  ${sortedVocab.length - wordIndex} words couldn't fit`);
    }

    return inserts;
}

// ==================== COMMIT CHANGES ====================
async function commitChanges(nodeIds: number[], inserts: NodeVocabInsert[]): Promise<void> {
    console.log('\n💾 Step 4: Committing changes...');

    const BATCH_SIZE = 100;

    // Delete existing
    console.log(`   🗑️  Deleting old entries...`);
    for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
        const batch = nodeIds.slice(i, i + BATCH_SIZE);
        await db.delete(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, batch));
    }

    // Insert new
    console.log(`   📥 Inserting ${inserts.length} entries...`);
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        await db.insert(nodeVocabulary).values(batch);
    }

    console.log(`   ✅ Done!`);
}

// ==================== VERIFICATION ====================
async function verifyResults(nodeIds: number[]): Promise<void> {
    console.log('\n🔍 VERIFICATION:');

    if (nodeIds.length === 0) return;

    // Node 1
    const node1Words = await db
        .select({ word: vocabulary.word, tag: vocabulary.tag })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, nodeIds[0]))
        .orderBy(asc(nodeVocabulary.order));

    console.log(`\n   📦 Node 1 (ID: ${nodeIds[0]}):`);
    node1Words.forEach((w, i) => {
        const match = w.tag?.match(/\((\d+-\d+)\)/);
        const range = match ? match[1] : 'N/A';
        const levelMatch = w.tag?.match(/\b(Basic|Advanced|Expert|Master)\b/i);
        const level = levelMatch ? levelMatch[1] : 'N/A';
        console.log(`      ${i + 1}. "${w.word}" [${level}] (${range})`);
    });

    // Check all from (001-100)
    const allFrom001100 = node1Words.every(w => w.tag?.includes('(001-100)'));
    console.log(`\n   ✅ All from (001-100): ${allFrom001100 ? 'YES ✓' : 'NO ✗'}`);

    // Check alphabetical
    const isAlpha = node1Words.every((w, i) => {
        if (i === 0) return true;
        return w.word.toLowerCase() >= node1Words[i - 1].word.toLowerCase();
    });
    console.log(`   🔤 Alphabetical order: ${isAlpha ? 'YES ✓' : 'NO ✗'}`);

    // Check Node 2 (should continue 001-100 or start 101-200)
    if (nodeIds.length > 1) {
        const node2Words = await db
            .select({ word: vocabulary.word, tag: vocabulary.tag })
            .from(nodeVocabulary)
            .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
            .where(eq(nodeVocabulary.nodeId, nodeIds[1]))
            .orderBy(asc(nodeVocabulary.order));

        console.log(`\n   📦 Node 2 (ID: ${nodeIds[1]}):`);
        node2Words.slice(0, 3).forEach((w, i) => {
            const match = w.tag?.match(/\((\d+-\d+)\)/);
            const range = match ? match[1] : 'N/A';
            console.log(`      ${i + 1}. "${w.word}" (${range})`);
        });
    }
}

// ==================== MAIN ====================
async function main() {
    console.log('🚀 FIX TOEIC FINAL - Robust Sorting');
    console.log('====================================');
    console.log('');
    console.log('Sort Rules:');
    console.log('  1. Rank: Basic(1) < Advanced(2) < Expert(3) < Master(4)');
    console.log('  2. Range: 001 < 101 < 201 < ... < 901');
    console.log('  3. Word: Alphabetical A-Z');
    console.log('');

    // Step 1
    const nodeIds = await fetchAndNormalizeNodes();
    if (nodeIds.length === 0) {
        console.log('\n❌ No nodes found!');
        process.exit(1);
    }

    // Step 2
    const sortedVocab = await fetchAndSortVocabulary();

    // Step 3
    const inserts = distributeToNodes(nodeIds, sortedVocab);

    // Step 4
    await commitChanges(nodeIds, inserts);

    // Verify
    await verifyResults(nodeIds);

    console.log('\n====================================');
    console.log('✨ TOEIC FIXED!');
    console.log('====================================');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ ERROR:', err);
    process.exit(1);
});

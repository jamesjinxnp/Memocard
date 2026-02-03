/**
 * Reseed TOEIC Direct Script
 * 
 * Clean 3-step hierarchical sorting (no complex scoring):
 * 1. Level order: Basic → Advanced → Expert → Master
 * 2. Range start number: (001-100) → (101-200) → ...
 * 3. Alphabetical: A-Z
 * 
 * Run: bun run scripts/reseed_toeic_direct.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, like, asc, inArray } from 'drizzle-orm';

const WORDS_PER_NODE = 8;
const DECK_ID = 'toeic';

// Explicit level ordering
const LEVEL_ORDER = ['Basic', 'Advanced', 'Expert', 'Master'];

interface VocabWord {
    id: number;
    word: string;
    tag: string | null;
}

// ==================== HELPER: Extract Level Index ====================
function getLevelIndex(tag: string | null): number {
    if (!tag) return 999; // Push to end
    for (let i = 0; i < LEVEL_ORDER.length; i++) {
        if (tag.includes(LEVEL_ORDER[i])) {
            return i;
        }
    }
    return 999; // Unknown level goes to end
}

// ==================== HELPER: Extract Range Start Number ====================
function getRangeStart(tag: string | null): number {
    if (!tag) return 9999;
    const match = tag.match(/\((\d+)-\d+\)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 9999; // No range goes to end
}

// ==================== THE SORT FUNCTION ====================
function sortVocabulary(a: VocabWord, b: VocabWord): number {
    // Priority 1: Level order (Basic < Advanced < Expert < Master)
    const levelA = getLevelIndex(a.tag);
    const levelB = getLevelIndex(b.tag);
    if (levelA !== levelB) {
        return levelA - levelB;
    }

    // Priority 2: Range start number (001 < 101 < 201 ...)
    const rangeA = getRangeStart(a.tag);
    const rangeB = getRangeStart(b.tag);
    if (rangeA !== rangeB) {
        return rangeA - rangeB;
    }

    // Priority 3: Alphabetical (A-Z)
    return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
}

// ==================== STEP 1: FETCH & NORMALIZE NODES ====================
async function fetchAndNormalizeNodes(): Promise<number[]> {
    console.log('\n📦 Step 1: Fetching & normalizing TOEIC nodes...');

    // Get all TOEIC levels in order
    const toeicLevels = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, DECK_ID))
        .orderBy(asc(levels.order));

    if (toeicLevels.length === 0) {
        console.log('   ⚠️  No TOEIC levels found! Run reseed_toeic.ts first to create structure.');
        return [];
    }

    console.log(`   📚 Found ${toeicLevels.length} levels`);

    // Collect nodes in proper hierarchical order: Level → Unit → Node
    const orderedNodeIds: number[] = [];

    for (const level of toeicLevels) {
        // Get units for this level in order
        const levelUnits = await db
            .select()
            .from(units)
            .where(eq(units.levelId, level.id))
            .orderBy(asc(units.order));

        for (const unit of levelUnits) {
            // Get nodes for this unit in order
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

    console.log(`   📦 Found ${orderedNodeIds.length} nodes (in hierarchical order)`);

    // Normalize: Convert ALL nodes to 'lesson' type
    if (orderedNodeIds.length > 0) {
        const toeicNodes = await db
            .select()
            .from(nodes)
            .where(inArray(nodes.id, orderedNodeIds));

        const nonLessonNodes = toeicNodes.filter(n => n.type !== 'lesson');
        if (nonLessonNodes.length > 0) {
            await db
                .update(nodes)
                .set({ type: 'lesson' })
                .where(inArray(nodes.id, nonLessonNodes.map(n => n.id)));
            console.log(`   ✅ Converted ${nonLessonNodes.length} boss/checkpoint nodes to 'lesson'`);
        } else {
            console.log(`   ✅ All nodes are already 'lesson' type`);
        }
    }

    return orderedNodeIds;
}

// ==================== STEP 2: FETCH & SORT VOCABULARY ====================
async function fetchAndSortVocabulary(): Promise<VocabWord[]> {
    console.log('\n📚 Step 2: Fetching & sorting TOEIC vocabulary...');

    // Fetch all TOEIC vocabulary
    const allVocab = await db
        .select({
            id: vocabulary.id,
            word: vocabulary.word,
            tag: vocabulary.tag,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'));

    console.log(`   📖 Found ${allVocab.length} TOEIC words`);

    // Apply the 3-step sort
    allVocab.sort(sortVocabulary);

    // Log first few words to verify sorting
    console.log('\n   📝 First 10 words after sorting:');
    allVocab.slice(0, 10).forEach((w, i) => {
        const level = LEVEL_ORDER.find(l => w.tag?.includes(l)) || 'N/A';
        const rangeMatch = w.tag?.match(/\((\d+-\d+)\)/);
        const range = rangeMatch ? rangeMatch[1] : 'N/A';
        console.log(`      ${i + 1}. "${w.word}" [${level}] (${range})`);
    });

    // Log transition points
    console.log('\n   🔄 Level transitions:');
    let currentLevel = '';
    for (let i = 0; i < allVocab.length; i++) {
        const level = LEVEL_ORDER.find(l => allVocab[i].tag?.includes(l)) || 'Unknown';
        if (level !== currentLevel) {
            console.log(`      Word ${i + 1}: "${allVocab[i].word}" starts ${level}`);
            currentLevel = level;
        }
    }

    return allVocab;
}

// ==================== STEP 3: DISTRIBUTE TO NODES ====================
interface NodeVocabInsert {
    nodeId: number;
    vocabularyId: number;
    order: number;
}

function distributeToNodes(nodeIds: number[], sortedVocab: VocabWord[]): NodeVocabInsert[] {
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

    const nodesUsed = Math.ceil(wordIndex / WORDS_PER_NODE);
    console.log(`   ✅ Distributed ${wordIndex} words across ${nodesUsed} nodes`);

    if (wordIndex < sortedVocab.length) {
        console.log(`   ⚠️  ${sortedVocab.length - wordIndex} words couldn't fit (not enough nodes)`);
    }

    return inserts;
}

// ==================== STEP 4: COMMIT CHANGES ====================
async function commitChanges(nodeIds: number[], inserts: NodeVocabInsert[]): Promise<void> {
    console.log('\n💾 Step 4: Committing changes...');

    const BATCH_SIZE = 100;

    // Delete existing node_vocabulary entries
    console.log(`   🗑️  Deleting old entries for ${nodeIds.length} nodes...`);
    for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
        const batch = nodeIds.slice(i, i + BATCH_SIZE);
        await db.delete(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, batch));
    }

    // Insert new entries
    console.log(`   📥 Inserting ${inserts.length} new entries...`);
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        await db.insert(nodeVocabulary).values(batch);
    }

    console.log(`   ✅ Committed ${inserts.length} vocabulary assignments`);
}

// ==================== VERIFICATION ====================
async function verifyResults(nodeIds: number[]): Promise<void> {
    console.log('\n🔍 Verification...');

    if (nodeIds.length === 0) return;

    // Get first node's vocabulary
    const firstNodeId = nodeIds[0];
    const firstNodeWords = await db
        .select({
            word: vocabulary.word,
            tag: vocabulary.tag,
            order: nodeVocabulary.order,
        })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, firstNodeId))
        .orderBy(asc(nodeVocabulary.order));

    console.log(`\n   📦 Node 1 (ID: ${firstNodeId}):`);
    firstNodeWords.forEach((w, i) => {
        const level = LEVEL_ORDER.find(l => w.tag?.includes(l)) || 'N/A';
        const rangeMatch = w.tag?.match(/\((\d+-\d+)\)/);
        const range = rangeMatch ? rangeMatch[1] : 'N/A';
        console.log(`      ${i + 1}. "${w.word}" [${level}] (${range})`);
    });

    // Verify all words are from (001-100) range
    const allFrom001100 = firstNodeWords.every(w => w.tag?.includes('(001-100)'));
    console.log(`   ✅ All from (001-100): ${allFrom001100 ? 'Yes' : 'No'}`);

    // Verify alphabetical order
    const isAlphabetical = firstNodeWords.every((w, i) => {
        if (i === 0) return true;
        return w.word.toLowerCase() >= firstNodeWords[i - 1].word.toLowerCase();
    });
    console.log(`   🔤 Alphabetical order: ${isAlphabetical ? 'Yes' : 'No'}`);
}

// ==================== MAIN ====================
async function main() {
    console.log('🚀 Reseed TOEIC Direct - Hierarchical Sorting');
    console.log('==============================================');
    console.log('');
    console.log('Sort Logic (3-step comparison):');
    console.log('  1. Level: Basic → Advanced → Expert → Master');
    console.log('  2. Range: (001-100) → (101-200) → ... → (901-1000)');
    console.log('  3. Alphabetical: A → Z');
    console.log('');

    // Step 1: Fetch & normalize nodes
    const nodeIds = await fetchAndNormalizeNodes();

    if (nodeIds.length === 0) {
        console.log('\n❌ No nodes found. Please run reseed_toeic.ts first to create the structure.');
        process.exit(1);
    }

    // Step 2: Fetch & sort vocabulary
    const sortedVocab = await fetchAndSortVocabulary();

    // Step 3: Distribute to nodes
    const inserts = distributeToNodes(nodeIds, sortedVocab);

    // Step 4: Commit changes
    await commitChanges(nodeIds, inserts);

    // Verification
    await verifyResults(nodeIds);

    console.log('\n==============================================');
    console.log('✨ COMPLETE! TOEIC deck has been reseeded.');
    console.log('==============================================');
    console.log('');
    console.log('📋 Summary:');
    console.log('  ✅ All nodes converted to "lesson" type');
    console.log('  ✅ Words sorted: Level → Range → Alphabetical');
    console.log('  ✅ Sequential distribution across nodes');
    console.log('  ✅ 8 words per node');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
});

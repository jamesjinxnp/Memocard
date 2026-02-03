/**
 * Reseed Level Sorted Script
 * 
 * Complete restructuring of Oxford 3000/5000 decks with strict ordering rules:
 * 1. Normalize ALL nodes to 'learning' type (remove boss/checkpoint nodes)
 * 2. Group vocabulary by CEFR level (A1, A2, B1, B2, C1, C2)
 * 3. Sort alphabetically (A-Z) within each CEFR group
 * 4. Distribute 8 words per node
 * 
 * Run: bun run scripts/reseed_level_sorted.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, and, like, or, asc, inArray, sql } from 'drizzle-orm';

const WORDS_PER_NODE = 8;
const TARGET_DECKS = ['oxford3000', 'oxford5000'];

// CEFR level order for deterministic processing
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface VocabWord {
    id: number;
    word: string;
    cefr: string | null;
    tag: string | null;
}

interface NodeWithContext {
    nodeId: number;
    nodeOrder: number;
    unitId: number;
    unitOrder: number;
    levelId: number;
    levelOrder: number;
    levelName: string;
    deckId: string;
}

// ==================== STEP 1: NORMALIZE NODES ====================
async function normalizeNodes(deckId: string): Promise<NodeWithContext[]> {
    console.log(`\n📦 Step 1: Normalizing nodes for ${deckId}...`);

    // Get all levels for this deck
    const deckLevels = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, deckId))
        .orderBy(asc(levels.order));

    if (deckLevels.length === 0) {
        console.log(`   ⚠️  No levels found for deck: ${deckId}`);
        return [];
    }

    const allNodesWithContext: NodeWithContext[] = [];
    let totalNodesUpdated = 0;

    for (const level of deckLevels) {
        // Get units for this level
        const levelUnits = await db
            .select()
            .from(units)
            .where(eq(units.levelId, level.id))
            .orderBy(asc(units.order));

        for (const unit of levelUnits) {
            // Get nodes for this unit
            const unitNodes = await db
                .select()
                .from(nodes)
                .where(eq(nodes.unitId, unit.id))
                .orderBy(asc(nodes.order));

            // Convert ALL nodes to 'lesson' type
            const nonLessonNodes = unitNodes.filter(n => n.type !== 'lesson');
            if (nonLessonNodes.length > 0) {
                await db
                    .update(nodes)
                    .set({ type: 'lesson' })
                    .where(inArray(nodes.id, nonLessonNodes.map(n => n.id)));
                totalNodesUpdated += nonLessonNodes.length;
            }

            // Build context for each node
            for (const node of unitNodes) {
                allNodesWithContext.push({
                    nodeId: node.id,
                    nodeOrder: node.order,
                    unitId: unit.id,
                    unitOrder: unit.order,
                    levelId: level.id,
                    levelOrder: level.order,
                    levelName: level.name,
                    deckId: deckId,
                });
            }
        }
    }

    // Sort nodes by level_order ASC, unit_order ASC, node_order ASC
    allNodesWithContext.sort((a, b) => {
        if (a.levelOrder !== b.levelOrder) return a.levelOrder - b.levelOrder;
        if (a.unitOrder !== b.unitOrder) return a.unitOrder - b.unitOrder;
        return a.nodeOrder - b.nodeOrder;
    });

    console.log(`   ✅ Normalized ${totalNodesUpdated} boss/checkpoint nodes to 'lesson'`);
    console.log(`   📊 Total nodes: ${allNodesWithContext.length}`);

    return allNodesWithContext;
}

// ==================== STEP 2: FETCH & SORT VOCABULARY ====================
async function fetchAndSortVocabulary(deckId: string): Promise<Map<string, VocabWord[]>> {
    console.log(`\n📚 Step 2: Fetching & sorting vocabulary for ${deckId}...`);

    // Fetch all vocabulary with matching tag
    const allVocab = await db
        .select({
            id: vocabulary.id,
            word: vocabulary.word,
            cefr: vocabulary.cefr,
            tag: vocabulary.tag,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, `%${deckId}%`));

    console.log(`   📖 Found ${allVocab.length} total words`);

    // Group by CEFR level
    const vocabByCefr = new Map<string, VocabWord[]>();

    for (const cefr of CEFR_LEVELS) {
        vocabByCefr.set(cefr, []);
    }
    vocabByCefr.set('UNKNOWN', []);

    for (const word of allVocab) {
        const cefr = word.cefr?.toUpperCase() || 'UNKNOWN';
        const targetGroup = vocabByCefr.has(cefr) ? cefr : 'UNKNOWN';
        vocabByCefr.get(targetGroup)!.push(word);
    }

    // Sort each group ALPHABETICALLY (A-Z by word)
    for (const [cefr, words] of vocabByCefr) {
        words.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
        if (words.length > 0) {
            console.log(`   📝 ${cefr}: ${words.length} words (first: "${words[0].word}", last: "${words[words.length - 1].word}")`);
        }
    }

    return vocabByCefr;
}

// ==================== STEP 3: DISTRIBUTION ====================
function extractCefr(levelName: string): string {
    const match = levelName.match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
}

interface NodeVocabInsert {
    nodeId: number;
    vocabularyId: number;
    order: number;
}

function distributeVocabulary(
    nodesWithContext: NodeWithContext[],
    vocabByCefr: Map<string, VocabWord[]>
): NodeVocabInsert[] {
    console.log(`\n🎯 Step 3: Distributing vocabulary to nodes...`);

    const inserts: NodeVocabInsert[] = [];

    // Group nodes by level
    const nodesByLevel = new Map<number, NodeWithContext[]>();
    for (const node of nodesWithContext) {
        if (!nodesByLevel.has(node.levelId)) {
            nodesByLevel.set(node.levelId, []);
        }
        nodesByLevel.get(node.levelId)!.push(node);
    }

    // Process each level
    const processedLevels = new Set<number>();

    for (const node of nodesWithContext) {
        if (processedLevels.has(node.levelId)) continue;
        processedLevels.add(node.levelId);

        const levelCefr = extractCefr(node.levelName);
        const levelNodes = nodesByLevel.get(node.levelId) || [];
        const cefrWords = vocabByCefr.get(levelCefr) || [];

        console.log(`   🏷️  ${node.levelName} (CEFR: ${levelCefr}): ${cefrWords.length} words → ${levelNodes.length} nodes`);

        if (cefrWords.length === 0) {
            console.log(`      ⚠️  No words for CEFR ${levelCefr}`);
            continue;
        }

        // Distribute words to nodes (8 per node)
        let wordIndex = 0;
        for (const levelNode of levelNodes) {
            for (let i = 0; i < WORDS_PER_NODE && wordIndex < cefrWords.length; i++) {
                inserts.push({
                    nodeId: levelNode.nodeId,
                    vocabularyId: cefrWords[wordIndex].id,
                    order: i,
                });
                wordIndex++;
            }
        }

        const nodesUsed = Math.ceil(wordIndex / WORDS_PER_NODE);
        console.log(`      ✅ Assigned ${wordIndex} words to ${nodesUsed} nodes`);

        if (wordIndex < cefrWords.length) {
            console.log(`      ⚠️  ${cefrWords.length - wordIndex} words couldn't fit (not enough nodes)`);
        }
    }

    return inserts;
}

// ==================== STEP 4: DATABASE COMMIT ====================
async function commitChanges(
    deckId: string,
    nodesWithContext: NodeWithContext[],
    inserts: NodeVocabInsert[]
): Promise<void> {
    console.log(`\n💾 Step 4: Committing changes for ${deckId}...`);

    const nodeIds = nodesWithContext.map(n => n.nodeId);

    if (nodeIds.length === 0) {
        console.log(`   ⚠️  No nodes to update`);
        return;
    }

    // Delete existing node_vocabulary entries for these nodes
    const BATCH_SIZE = 100;

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
async function verifyResults(deckId: string): Promise<void> {
    console.log(`\n🔍 Verifying ${deckId}...`);

    // Get first level
    const firstLevel = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, deckId))
        .orderBy(asc(levels.order))
        .limit(1);

    if (firstLevel.length === 0) return;

    const levelCefr = extractCefr(firstLevel[0].name);
    console.log(`   📚 First Level: ${firstLevel[0].name} (CEFR: ${levelCefr})`);

    // Get first unit of first level
    const firstUnit = await db
        .select()
        .from(units)
        .where(eq(units.levelId, firstLevel[0].id))
        .orderBy(asc(units.order))
        .limit(1);

    if (firstUnit.length === 0) return;

    // Get first node of first unit
    const firstNode = await db
        .select()
        .from(nodes)
        .where(eq(nodes.unitId, firstUnit[0].id))
        .orderBy(asc(nodes.order))
        .limit(1);

    if (firstNode.length === 0) return;

    console.log(`   📦 First Node (ID: ${firstNode[0].id}, Type: ${firstNode[0].type}):`);

    // Get vocabulary for first node
    const nodeWords = await db
        .select({
            word: vocabulary.word,
            cefr: vocabulary.cefr,
            order: nodeVocabulary.order,
        })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, firstNode[0].id))
        .orderBy(asc(nodeVocabulary.order));

    if (nodeWords.length === 0) {
        console.log(`   ⚠️  No words in first node!`);
        return;
    }

    console.log(`   📝 Words (${nodeWords.length}):`);
    nodeWords.forEach((w, i) => {
        const cefrMatch = w.cefr?.toUpperCase() === levelCefr ? '✅' : '❌';
        console.log(`      ${i + 1}. "${w.word}" (CEFR: ${w.cefr}) ${cefrMatch}`);
    });

    // Verify alphabetical order
    const isAlphabetical = nodeWords.every((w, i) => {
        if (i === 0) return true;
        return w.word.toLowerCase() >= nodeWords[i - 1].word.toLowerCase();
    });
    console.log(`   🔤 Alphabetical order: ${isAlphabetical ? '✅ Yes' : '❌ No'}`);
}

// ==================== MAIN ====================
async function main() {
    console.log('🚀 Reseed Level Sorted - Complete Restructuring');
    console.log('================================================');
    console.log('');
    console.log('Rules:');
    console.log('  1. Convert ALL nodes to "lesson" type (no bosses/checkpoints)');
    console.log('  2. Group vocabulary by CEFR level');
    console.log('  3. Sort ALPHABETICALLY (A-Z) within each level');
    console.log('  4. Distribute 8 words per node');
    console.log('');

    for (const deckId of TARGET_DECKS) {
        console.log('\n' + '='.repeat(60));
        console.log(`📦 Processing Deck: ${deckId.toUpperCase()}`);
        console.log('='.repeat(60));

        // Step 1: Normalize nodes
        const nodesWithContext = await normalizeNodes(deckId);

        if (nodesWithContext.length === 0) {
            console.log(`⚠️  Skipping ${deckId} - no nodes found`);
            continue;
        }

        // Step 2: Fetch & sort vocabulary
        const vocabByCefr = await fetchAndSortVocabulary(deckId);

        // Step 3: Distribute vocabulary to nodes
        const inserts = distributeVocabulary(nodesWithContext, vocabByCefr);

        // Step 4: Commit changes
        await commitChanges(deckId, nodesWithContext, inserts);

        // Verification
        await verifyResults(deckId);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ COMPLETE! All decks have been restructured.');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 Summary:');
    console.log('  ✅ All boss/checkpoint nodes converted to "lesson"');
    console.log('  ✅ Words grouped by CEFR level (A1→A2→B1→B2→C1→C2)');
    console.log('  ✅ Words sorted alphabetically (A-Z) within each level');
    console.log('  ✅ 8 words per node');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
});

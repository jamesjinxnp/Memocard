/**
 * Fix OLD TOEIC Deck (Deck ID: 'Toeic' with capital T)
 * 
 * This fixes the deck that the webapp actually uses!
 * 
 * Run: bun run scripts/fix_old_toeic.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, like, asc, inArray } from 'drizzle-orm';

const WORDS_PER_NODE = 8;
const OLD_DECK_ID = 'Toeic'; // Capital T - the webapp uses this!

interface SortableWord {
    id: number;
    word: string;
    tag: string | null;
    levelRank: number;
    rangeStart: number;
}

// Level rank
function getLevelRank(tag: string | null): number {
    if (!tag) return 999;
    const t = tag.toLowerCase();
    if (t.includes('basic')) return 1;
    if (t.includes('advanced')) return 2;
    if (t.includes('expert')) return 3;
    if (t.includes('master')) return 4;
    return 999;
}

// Range start
function getRangeStart(tag: string | null): number {
    if (!tag) return 99999;
    const match = /\((\d+)-/.exec(tag);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return 99999;
}

// Sort function
function sortWords(a: SortableWord, b: SortableWord): number {
    if (a.levelRank !== b.levelRank) return a.levelRank - b.levelRank;
    if (a.rangeStart !== b.rangeStart) return a.rangeStart - b.rangeStart;
    return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
}

async function main() {
    console.log('');
    console.log('🔧 FIX OLD TOEIC DECK (Deck ID: "Toeic")');
    console.log('=========================================');
    console.log('');

    // Step 1: Get OLD TOEIC levels
    console.log('📦 Step 1: Finding OLD TOEIC deck levels...');
    const oldLevels = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, OLD_DECK_ID))
        .orderBy(asc(levels.order));

    if (oldLevels.length === 0) {
        console.log('❌ No levels found for deck "Toeic"!');
        process.exit(1);
    }

    console.log(`   Found ${oldLevels.length} levels:`);
    oldLevels.forEach(l => console.log(`   - ${l.name} (ID: ${l.id})`));

    // Step 2: Collect node IDs in order
    console.log('\n📦 Step 2: Collecting nodes in hierarchical order...');
    const orderedNodeIds: number[] = [];

    for (const level of oldLevels) {
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

    console.log(`   Found ${orderedNodeIds.length} nodes`);
    console.log(`   First 5 node IDs: ${orderedNodeIds.slice(0, 5).join(', ')}`);

    // Step 3: Force update all nodes to 'lesson'
    console.log('\n💥 Step 3: Forcing all nodes to type "lesson"...');
    if (orderedNodeIds.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < orderedNodeIds.length; i += BATCH_SIZE) {
            const batch = orderedNodeIds.slice(i, i + BATCH_SIZE);
            await db
                .update(nodes)
                .set({ type: 'lesson' })
                .where(inArray(nodes.id, batch));
        }
    }
    console.log('   ✅ Done!');

    // Step 4: Fetch & sort vocabulary
    console.log('\n📚 Step 4: Fetching & sorting TOEIC vocabulary...');
    const rawVocab = await db
        .select({
            id: vocabulary.id,
            word: vocabulary.word,
            tag: vocabulary.tag,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'));

    console.log(`   Found ${rawVocab.length} TOEIC words`);

    const sortable: SortableWord[] = rawVocab.map(w => ({
        id: w.id,
        word: w.word,
        tag: w.tag,
        levelRank: getLevelRank(w.tag),
        rangeStart: getRangeStart(w.tag),
    }));

    sortable.sort(sortWords);

    console.log('\n   First 5 sorted words:');
    sortable.slice(0, 5).forEach((w, i) => {
        const level = ['', 'Basic', 'Advanced', 'Expert', 'Master'][w.levelRank] || '?';
        console.log(`   ${i + 1}. "${w.word}" [${level}] range:${w.rangeStart}`);
    });

    // Step 5: Wipe & reseed node_vocabulary
    console.log('\n💾 Step 5: Wiping & reseeding node_vocabulary...');

    const BATCH_SIZE = 100;

    // Wipe
    console.log('   Deleting old entries...');
    for (let i = 0; i < orderedNodeIds.length; i += BATCH_SIZE) {
        const batch = orderedNodeIds.slice(i, i + BATCH_SIZE);
        await db.delete(nodeVocabulary).where(inArray(nodeVocabulary.nodeId, batch));
    }

    // Reseed
    console.log('   Inserting sorted vocabulary...');
    const inserts: { nodeId: number; vocabularyId: number; order: number }[] = [];
    let wordIdx = 0;

    for (const nodeId of orderedNodeIds) {
        for (let i = 0; i < WORDS_PER_NODE && wordIdx < sortable.length; i++) {
            inserts.push({
                nodeId,
                vocabularyId: sortable[wordIdx].id,
                order: i,
            });
            wordIdx++;
        }
    }

    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        await db.insert(nodeVocabulary).values(batch);
    }

    console.log(`   ✅ Inserted ${inserts.length} entries`);

    // Step 6: Verify
    console.log('\n🔍 Step 6: Verification...');

    const node1Words = await db
        .select({ word: vocabulary.word, tag: vocabulary.tag })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, orderedNodeIds[0]))
        .orderBy(asc(nodeVocabulary.order));

    console.log(`\n   📦 NODE 1 (ID: ${orderedNodeIds[0]}):`);
    node1Words.forEach((w, i) => {
        const levelMatch = w.tag?.match(/\b(Basic|Advanced|Expert|Master)\b/i);
        const rangeMatch = w.tag?.match(/\((\d+-\d+)\)/);
        console.log(`   ${i + 1}. "${w.word}" [${levelMatch?.[1] || '?'}] (${rangeMatch?.[1] || '?'})`);
    });

    const allBasic = node1Words.every(w => w.tag?.toLowerCase().includes('basic'));
    const all001100 = node1Words.every(w => w.tag?.includes('(001-100)'));

    console.log('\n   Verification:');
    console.log(`   All Basic: ${allBasic ? 'YES ✓' : 'NO ✗'}`);
    console.log(`   All (001-100): ${all001100 ? 'YES ✓' : 'NO ✗'}`);

    console.log('\n=========================================');
    console.log('✨ OLD TOEIC DECK FIXED!');
    console.log('=========================================');
    console.log('');
    console.log('🔄 Please refresh the webapp to see changes.');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ ERROR:', err);
    process.exit(1);
});

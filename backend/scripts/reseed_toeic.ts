/**
 * Reseed TOEIC Script
 * 
 * Complete restructuring of TOEIC deck with multi-tier sorting:
 * 1. Primary: Level Tag (Basic→Advanced→Expert→Master)
 * 2. Secondary: Range Tag ((001-100)→(101-200)→...→(901-1000))
 * 3. Tertiary: Alphabetical (word ASC)
 * 
 * Run: bun run scripts/reseed_toeic.ts
 */

import { db } from '../src/db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../src/db/schema';
import { eq, like, asc, inArray, sql } from 'drizzle-orm';

const WORDS_PER_NODE = 8;
const DECK_ID = 'toeic';

// Level configuration with scoring
const LEVEL_CONFIG = [
    { name: 'Basic', displayName: 'Level 600 - Basic', score: 10000 },
    { name: 'Advanced', displayName: 'Level 730 - Advanced', score: 20000 },
    { name: 'Expert', displayName: 'Level 860 - Expert', score: 30000 },
    { name: 'Master', displayName: 'Level 990 - Master', score: 40000 },
];

// Range configuration with scoring
const RANGE_CONFIG = [
    { pattern: '001-100', score: 100 },
    { pattern: '101-200', score: 200 },
    { pattern: '201-300', score: 300 },
    { pattern: '301-400', score: 400 },
    { pattern: '401-500', score: 500 },
    { pattern: '501-600', score: 600 },
    { pattern: '601-700', score: 700 },
    { pattern: '701-800', score: 800 },
    { pattern: '801-900', score: 900 },
    { pattern: '901-1000', score: 1000 },
];

interface VocabWord {
    id: number;
    word: string;
    tag: string | null;
    levelName: string | null;
    rangeName: string | null;
    sortScore: number;
}

// ==================== HELPER: Calculate Sort Score ====================
function calculateSortScore(tag: string | null): { score: number; levelName: string | null; rangeName: string | null } {
    let score = 0;
    let levelName: string | null = null;
    let rangeName: string | null = null;

    if (!tag) return { score: 999999, levelName: null, rangeName: null };

    // Extract level score
    for (const level of LEVEL_CONFIG) {
        if (tag.includes(level.name)) {
            score += level.score;
            levelName = level.name;
            break;
        }
    }

    // If no level found, give high score (push to end)
    if (!levelName) {
        score += 50000;
    }

    // Extract range score
    for (const range of RANGE_CONFIG) {
        if (tag.includes(`(${range.pattern})`)) {
            score += range.score;
            rangeName = range.pattern;
            break;
        }
    }

    return { score, levelName, rangeName };
}

// ==================== STEP 1: Create/Reset TOEIC Structure ====================
async function resetToeicStructure(): Promise<Map<string, number[]>> {
    console.log('\n📦 Step 1: Creating TOEIC deck structure...');

    // Delete existing TOEIC levels (cascades to units, nodes, node_vocabulary)
    const existingLevels = await db.select().from(levels).where(eq(levels.deckId, DECK_ID));
    if (existingLevels.length > 0) {
        console.log(`   🗑️  Deleting existing ${existingLevels.length} levels...`);
        await db.delete(levels).where(eq(levels.deckId, DECK_ID));
    }

    const now = new Date();
    const levelNodeMap = new Map<string, number[]>(); // levelName -> nodeIds

    for (let i = 0; i < LEVEL_CONFIG.length; i++) {
        const levelConfig = LEVEL_CONFIG[i];

        // Create level
        const [newLevel] = await db.insert(levels).values({
            deckId: DECK_ID,
            name: levelConfig.displayName,
            description: `TOEIC ${levelConfig.name} level vocabulary`,
            order: i,
            theme: 'Business English',
            requiredCrowns: i * 50,
            createdAt: now,
        }).returning();

        console.log(`   ✅ Created Level: ${levelConfig.displayName} (id: ${newLevel.id})`);

        // Create units for this level (1 unit per range that belongs to this level)
        const levelNodeIds: number[] = [];

        // Calculate how many ranges belong to this level based on word distribution
        // Basic: (001-100) to (301-400) = 4 ranges = 400 words
        // Advanced: (401-500) to (601-700) = 3 ranges = ~300 words  
        // Expert: (701-800) to (801-900) = 2 ranges = 200 words
        // Master: (901-1000) = 1 range = 100 words

        let rangesForLevel: typeof RANGE_CONFIG;
        switch (levelConfig.name) {
            case 'Basic':
                rangesForLevel = RANGE_CONFIG.slice(0, 4); // 001-400
                break;
            case 'Advanced':
                rangesForLevel = RANGE_CONFIG.slice(4, 7); // 401-700
                break;
            case 'Expert':
                rangesForLevel = RANGE_CONFIG.slice(7, 9); // 701-900
                break;
            case 'Master':
                rangesForLevel = RANGE_CONFIG.slice(9, 10); // 901-1000
                break;
            default:
                rangesForLevel = [];
        }

        for (let j = 0; j < rangesForLevel.length; j++) {
            const range = rangesForLevel[j];

            // Create unit
            const [newUnit] = await db.insert(units).values({
                levelId: newLevel.id,
                name: `Words ${range.pattern}`,
                description: `TOEIC vocabulary range ${range.pattern}`,
                order: j,
                icon: '📚',
                color: '#4F46E5',
                createdAt: now,
            }).returning();

            // Create nodes for this unit (ceil(100 words / 8 words per node) = 13 nodes)
            const nodesPerUnit = Math.ceil(100 / WORDS_PER_NODE);

            for (let k = 0; k < nodesPerUnit; k++) {
                const [newNode] = await db.insert(nodes).values({
                    unitId: newUnit.id,
                    type: 'lesson', // ALL nodes are 'lesson' type
                    order: k,
                    requiredStars: 0,
                    createdAt: now,
                }).returning();

                levelNodeIds.push(newNode.id);
            }
        }

        levelNodeMap.set(levelConfig.name, levelNodeIds);
        console.log(`      Created ${levelNodeIds.length} nodes for ${levelConfig.name}`);
    }

    return levelNodeMap;
}

// ==================== STEP 2: Fetch & Sort Vocabulary ====================
async function fetchAndSortVocabulary(): Promise<Map<string, VocabWord[]>> {
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

    // Calculate sort scores and group by level
    const vocabByLevel = new Map<string, VocabWord[]>();
    for (const level of LEVEL_CONFIG) {
        vocabByLevel.set(level.name, []);
    }
    vocabByLevel.set('UNKNOWN', []);

    for (const word of allVocab) {
        const { score, levelName, rangeName } = calculateSortScore(word.tag);

        const vocabWord: VocabWord = {
            id: word.id,
            word: word.word,
            tag: word.tag,
            levelName,
            rangeName,
            sortScore: score,
        };

        const targetLevel = levelName || 'UNKNOWN';
        vocabByLevel.get(targetLevel)!.push(vocabWord);
    }

    // Sort each level by: sortScore ASC, then word ASC
    for (const [level, words] of vocabByLevel) {
        words.sort((a, b) => {
            if (a.sortScore !== b.sortScore) return a.sortScore - b.sortScore;
            return a.word.toLowerCase().localeCompare(b.word.toLowerCase());
        });

        if (words.length > 0) {
            console.log(`   📝 ${level}: ${words.length} words`);
            console.log(`      First: "${words[0].word}" (range: ${words[0].rangeName}, score: ${words[0].sortScore})`);
            console.log(`      Last:  "${words[words.length - 1].word}" (range: ${words[words.length - 1].rangeName}, score: ${words[words.length - 1].sortScore})`);
        }
    }

    return vocabByLevel;
}

// ==================== STEP 3: Distribute Vocabulary ====================
interface NodeVocabInsert {
    nodeId: number;
    vocabularyId: number;
    order: number;
}

function distributeVocabulary(
    levelNodeMap: Map<string, number[]>,
    vocabByLevel: Map<string, VocabWord[]>
): NodeVocabInsert[] {
    console.log('\n🎯 Step 3: Distributing vocabulary to nodes...');

    const inserts: NodeVocabInsert[] = [];

    for (const level of LEVEL_CONFIG) {
        const levelNodes = levelNodeMap.get(level.name) || [];
        const levelWords = vocabByLevel.get(level.name) || [];

        console.log(`   🏷️  ${level.name}: ${levelWords.length} words → ${levelNodes.length} nodes`);

        if (levelWords.length === 0 || levelNodes.length === 0) {
            console.log(`      ⚠️  Skipping - no words or nodes`);
            continue;
        }

        // Distribute words to nodes (8 per node)
        let wordIndex = 0;
        for (const nodeId of levelNodes) {
            for (let i = 0; i < WORDS_PER_NODE && wordIndex < levelWords.length; i++) {
                inserts.push({
                    nodeId,
                    vocabularyId: levelWords[wordIndex].id,
                    order: i,
                });
                wordIndex++;
            }
        }

        const nodesUsed = Math.ceil(wordIndex / WORDS_PER_NODE);
        console.log(`      ✅ Assigned ${wordIndex} words to ${nodesUsed} nodes`);
    }

    return inserts;
}

// ==================== STEP 4: Commit Changes ====================
async function commitChanges(
    levelNodeMap: Map<string, number[]>,
    inserts: NodeVocabInsert[]
): Promise<void> {
    console.log('\n💾 Step 4: Committing changes...');

    // node_vocabulary was already cleared when we deleted levels (cascade)
    // Just insert new entries

    const BATCH_SIZE = 100;
    console.log(`   📥 Inserting ${inserts.length} vocabulary assignments...`);

    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        await db.insert(nodeVocabulary).values(batch);
    }

    console.log(`   ✅ Committed ${inserts.length} vocabulary assignments`);
}

// ==================== VERIFICATION ====================
async function verifyResults(): Promise<void> {
    console.log('\n🔍 Verifying results...');

    // Get first level (Basic)
    const firstLevel = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, DECK_ID))
        .orderBy(asc(levels.order))
        .limit(1);

    if (firstLevel.length === 0) {
        console.log('   ❌ No levels found!');
        return;
    }

    console.log(`   📚 First Level: ${firstLevel[0].name}`);

    // Get first unit
    const firstUnit = await db
        .select()
        .from(units)
        .where(eq(units.levelId, firstLevel[0].id))
        .orderBy(asc(units.order))
        .limit(1);

    if (firstUnit.length === 0) return;

    // Get first node
    const firstNode = await db
        .select()
        .from(nodes)
        .where(eq(nodes.unitId, firstUnit[0].id))
        .orderBy(asc(nodes.order))
        .limit(1);

    if (firstNode.length === 0) return;

    console.log(`   📦 First Node (ID: ${firstNode[0].id}, Type: ${firstNode[0].type})`);

    // Get vocabulary for first node
    const nodeWords = await db
        .select({
            word: vocabulary.word,
            tag: vocabulary.tag,
            order: nodeVocabulary.order,
        })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, firstNode[0].id))
        .orderBy(asc(nodeVocabulary.order));

    console.log(`   📝 First Node Words (${nodeWords.length}):`);
    nodeWords.forEach((w, i) => {
        // Extract range from tag
        const rangeMatch = w.tag?.match(/\((\d{3}-\d{3,4})\)/);
        const range = rangeMatch ? rangeMatch[1] : 'N/A';
        console.log(`      ${i + 1}. "${w.word}" (range: ${range})`);
    });

    // Check if words are from (001-100) range
    const allFrom001100 = nodeWords.every(w => w.tag?.includes('(001-100)'));
    console.log(`   ✅ All words from (001-100): ${allFrom001100 ? 'Yes' : 'No'}`);

    // Verify alphabetical order within same range
    const isAlphabetical = nodeWords.every((w, i) => {
        if (i === 0) return true;
        return w.word.toLowerCase() >= nodeWords[i - 1].word.toLowerCase();
    });
    console.log(`   🔤 Alphabetical order: ${isAlphabetical ? 'Yes' : 'No'}`);

    // Check Advanced level
    console.log('\n   📚 Checking Advanced Level...');
    const advLevel = await db
        .select()
        .from(levels)
        .where(eq(levels.deckId, DECK_ID))
        .orderBy(asc(levels.order))
        .limit(2);

    if (advLevel.length >= 2) {
        const advUnit = await db
            .select()
            .from(units)
            .where(eq(units.levelId, advLevel[1].id))
            .orderBy(asc(units.order))
            .limit(1);

        if (advUnit.length > 0) {
            const advNode = await db
                .select()
                .from(nodes)
                .where(eq(nodes.unitId, advUnit[0].id))
                .orderBy(asc(nodes.order))
                .limit(1);

            if (advNode.length > 0) {
                const advWords = await db
                    .select({
                        word: vocabulary.word,
                        tag: vocabulary.tag,
                    })
                    .from(nodeVocabulary)
                    .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
                    .where(eq(nodeVocabulary.nodeId, advNode[0].id))
                    .orderBy(asc(nodeVocabulary.order))
                    .limit(3);

                console.log(`   📦 Advanced First Node (ID: ${advNode[0].id}):`);
                advWords.forEach((w, i) => {
                    const rangeMatch = w.tag?.match(/\((\d{3}-\d{3,4})\)/);
                    const range = rangeMatch ? rangeMatch[1] : 'N/A';
                    console.log(`      ${i + 1}. "${w.word}" (range: ${range})`);
                });
            }
        }
    }
}

// ==================== MAIN ====================
async function main() {
    console.log('🚀 Reseed TOEIC - Multi-Tier Sorting');
    console.log('=====================================');
    console.log('');
    console.log('Sorting Rules:');
    console.log('  1. Primary: Level (Basic→Advanced→Expert→Master)');
    console.log('  2. Secondary: Range ((001-100)→(101-200)→...→(901-1000))');
    console.log('  3. Tertiary: Alphabetical (A-Z)');
    console.log('');

    // Step 1: Create TOEIC structure
    const levelNodeMap = await resetToeicStructure();

    // Step 2: Fetch & sort vocabulary
    const vocabByLevel = await fetchAndSortVocabulary();

    // Step 3: Distribute vocabulary
    const inserts = distributeVocabulary(levelNodeMap, vocabByLevel);

    // Step 4: Commit changes
    await commitChanges(levelNodeMap, inserts);

    // Verification
    await verifyResults();

    console.log('\n=====================================');
    console.log('✨ COMPLETE! TOEIC deck has been restructured.');
    console.log('=====================================');
    console.log('');
    console.log('📋 Summary:');
    console.log('  ✅ Created 4 levels (Basic, Advanced, Expert, Master)');
    console.log('  ✅ All nodes are "lesson" type (no bosses)');
    console.log('  ✅ Words sorted by Level → Range → Alphabetical');
    console.log('  ✅ 8 words per node');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
});

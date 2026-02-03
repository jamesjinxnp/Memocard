/**
 * Seed Learning Path Script
 * 
 * Generates the Learning Path structure (Levels → Units → Nodes) 
 * automatically from existing vocabulary data.
 * 
 * Usage: bun run src/scripts/seed-learning-path.ts
 */

import { db } from '../db/client';
import { levels, units, nodes, nodeVocabulary, vocabulary } from '../db/schema';
import { like, eq, sql } from 'drizzle-orm';

// ==================== Constants ====================

const DECKS = ['oxford3000', 'oxford5000', 'Toeic'];
const WORDS_PER_NODE = 8;
const WORDS_PER_UNIT = 48; // 6 nodes × 8 words
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// TOEIC uses different level names
const TOEIC_LEVELS = ['Basic', 'Advanced', 'Expert', 'Master'];

// ==================== Helpers ====================

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, T[]>);
}

/**
 * Determine node type based on position in unit
 */
function getNodeType(index: number, totalNodes: number): 'lesson' | 'practice' | 'boss' | 'checkpoint' {
    if (index === totalNodes - 1) return 'checkpoint'; // Last = Checkpoint (Unit Quiz)
    if (index === totalNodes - 2) return 'boss';       // Second to last = Boss
    if (index > 0 && index % 3 === 2) return 'practice'; // Every 3rd = Practice
    return 'lesson'; // Default
}

// ==================== Progress Logger ====================

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logProgress(current: number, total: number, label: string) {
    const percent = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    process.stdout.write(`\r${colors.cyan}[${bar}] ${percent}%${colors.reset} ${label}`);
    if (current === total) console.log('');
}

// ==================== Main Seeding Function ====================

async function seedDeck(deckId: string) {
    log(`\n${'═'.repeat(50)}`, 'bright');
    log(`📚 Processing Deck: ${deckId.toUpperCase()}`, 'bright');
    log('═'.repeat(50), 'bright');

    // 1. Fetch all vocabulary for this deck
    const allVocab = await db.select()
        .from(vocabulary)
        .where(like(vocabulary.tag, `%${deckId}%`));

    if (allVocab.length === 0) {
        log(`  ⚠️  No vocabulary found for deck: ${deckId}`, 'yellow');
        return { levels: 0, units: 0, nodes: 0, words: 0 };
    }

    log(`  📖 Found ${allVocab.length} words`, 'dim');

    // 2. Group by CEFR or TOEIC level
    const isToeic = deckId === 'Toeic';
    const byLevel = groupBy(allVocab, (v) => {
        if (isToeic) {
            // TOEIC: Extract level from tags (Basic, Advanced, etc.)
            const tags = v.tag?.split(',').map(t => t.trim()) || [];
            return tags.find(t => TOEIC_LEVELS.includes(t)) || 'Basic';
        }
        return v.cefr || 'B1'; // Default to B1 if no CEFR
    });

    // Sort levels
    const levelKeys = isToeic
        ? TOEIC_LEVELS.filter(l => byLevel[l]?.length > 0)
        : CEFR_ORDER.filter(l => byLevel[l]?.length > 0);

    log(`  📊 Levels found: ${levelKeys.join(', ')}`, 'dim');

    // Stats
    let totalLevels = 0;
    let totalUnits = 0;
    let totalNodes = 0;
    let totalWords = 0;

    // 3. Create Levels
    for (let levelIdx = 0; levelIdx < levelKeys.length; levelIdx++) {
        const levelName = levelKeys[levelIdx];
        const levelWords = shuffleArray(byLevel[levelName] || []);

        log(`\n  🎯 Level ${levelName} (${levelWords.length} words)`, 'green');

        // Insert Level
        const [insertedLevel] = await db.insert(levels).values({
            deckId,
            name: `Level ${levelName}`,
            description: `${levelWords.length} vocabulary words`,
            order: levelIdx,
            theme: levelName,
            requiredCrowns: levelIdx * 5, // Each level requires more crowns
            createdAt: new Date(),
        }).returning();

        totalLevels++;

        // 4. Chunk words into Units
        const unitChunks = chunk(levelWords, WORDS_PER_UNIT);

        for (let unitIdx = 0; unitIdx < unitChunks.length; unitIdx++) {
            const unitWords = unitChunks[unitIdx];
            const unitName = `Unit ${unitIdx + 1}`;

            logProgress(unitIdx + 1, unitChunks.length, `Creating ${unitName} (${unitWords.length} words)`);

            // Insert Unit
            const [insertedUnit] = await db.insert(units).values({
                levelId: insertedLevel.id,
                name: unitName,
                description: `${unitWords.length} vocabulary words`,
                order: unitIdx,
                icon: getUnitIcon(unitIdx),
                color: getUnitColor(unitIdx),
                createdAt: new Date(),
            }).returning();

            totalUnits++;

            // 5. Chunk Unit into Nodes
            const nodeChunks = chunk(unitWords, WORDS_PER_NODE);

            for (let nodeIdx = 0; nodeIdx < nodeChunks.length; nodeIdx++) {
                const nodeWords = nodeChunks[nodeIdx];
                const nodeType = getNodeType(nodeIdx, nodeChunks.length);

                // Insert Node
                const [insertedNode] = await db.insert(nodes).values({
                    unitId: insertedUnit.id,
                    type: nodeType,
                    order: nodeIdx,
                    requiredStars: 0, // Sequential unlock
                    createdAt: new Date(),
                }).returning();

                totalNodes++;

                // 6. Link vocabulary to node (batch insert)
                const nodeVocabValues = nodeWords.map((word, idx) => ({
                    nodeId: insertedNode.id,
                    vocabularyId: word.id,
                    order: idx,
                }));

                await db.insert(nodeVocabulary).values(nodeVocabValues);
                totalWords += nodeWords.length;
            }
        }
    }

    log(`\n  ✅ Deck ${deckId} completed!`, 'green');
    log(`     Levels: ${totalLevels} | Units: ${totalUnits} | Nodes: ${totalNodes} | Words: ${totalWords}`, 'dim');

    return { levels: totalLevels, units: totalUnits, nodes: totalNodes, words: totalWords };
}

// ==================== Helpers for Unit Icons/Colors ====================

const UNIT_ICONS = ['📗', '📘', '📙', '📕', '📓', '📔', '📒', '🎯', '⭐', '🏆'];
const UNIT_COLORS = [
    'emerald-500', 'blue-500', 'purple-500', 'orange-500', 'pink-500',
    'teal-500', 'indigo-500', 'amber-500', 'rose-500', 'cyan-500'
];

function getUnitIcon(index: number): string {
    return UNIT_ICONS[index % UNIT_ICONS.length];
}

function getUnitColor(index: number): string {
    return UNIT_COLORS[index % UNIT_COLORS.length];
}

// ==================== Clear Existing Data ====================

async function clearExistingData() {
    log('\n🗑️  Clearing existing Learning Path data...', 'yellow');

    // Delete in order due to foreign keys (child tables first)
    await db.delete(nodeVocabulary);
    await db.delete(nodes);
    await db.delete(units);
    await db.delete(levels);

    log('   ✅ Cleared!', 'green');
}

// ==================== Main ====================

async function main() {
    console.clear();
    log('╔════════════════════════════════════════════════════════════╗', 'magenta');
    log('║       🚀 MemoCard Learning Path Seeder                     ║', 'magenta');
    log('║       Generating Levels → Units → Nodes                    ║', 'magenta');
    log('╚════════════════════════════════════════════════════════════╝', 'magenta');

    const startTime = Date.now();

    // Clear old data first
    await clearExistingData();

    // Seed all decks
    const results: Record<string, { levels: number; units: number; nodes: number; words: number }> = {};

    for (const deckId of DECKS) {
        results[deckId] = await seedDeck(deckId);
    }

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log('\n' + '═'.repeat(60), 'bright');
    log('📊 SUMMARY', 'bright');
    log('═'.repeat(60), 'bright');

    let grandTotal = { levels: 0, units: 0, nodes: 0, words: 0 };
    for (const [deckId, stats] of Object.entries(results)) {
        log(`\n  ${deckId}:`, 'cyan');
        log(`    Levels: ${stats.levels} | Units: ${stats.units} | Nodes: ${stats.nodes} | Words: ${stats.words}`, 'dim');
        grandTotal.levels += stats.levels;
        grandTotal.units += stats.units;
        grandTotal.nodes += stats.nodes;
        grandTotal.words += stats.words;
    }

    log('\n  ─────────────────────────────', 'dim');
    log(`  TOTAL: ${grandTotal.levels} levels, ${grandTotal.units} units, ${grandTotal.nodes} nodes, ${grandTotal.words} words`, 'green');
    log(`  ⏱️  Completed in ${elapsed}s`, 'dim');
    log('\n✅ Learning Path seeding complete!', 'green');
}

// Run
main().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});

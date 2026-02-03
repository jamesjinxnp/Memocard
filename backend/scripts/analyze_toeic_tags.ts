import { db } from '../src/db/client';
import { vocabulary } from '../src/db/schema';
import { like, sql, asc } from 'drizzle-orm';

async function analyzeToeicTags() {
    console.log('\n📊 TOEIC Tag Analysis:');

    // Get sample tags
    console.log('\n📖 Sample TOEIC vocabulary tags (first 20):');
    const samples = await db
        .select({ word: vocabulary.word, tag: vocabulary.tag })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'))
        .orderBy(asc(vocabulary.id))
        .limit(20);

    samples.forEach((v, i) => console.log(`  ${i + 1}. "${v.word}" -> "${v.tag}"`));

    // Extract unique level patterns
    console.log('\n🏷️  Unique Level Patterns:');
    const allTags = await db
        .select({ tag: vocabulary.tag })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%Toeic%'));

    const levelPatterns = new Map<string, number>();
    const rangePatterns = new Map<string, number>();

    for (const row of allTags) {
        const tag = row.tag || '';

        // Extract level (Basic, Advanced, Expert, Master)
        const levelMatch = tag.match(/\b(Basic|Advanced|Expert|Master)\b/i);
        if (levelMatch) {
            const level = levelMatch[1];
            levelPatterns.set(level, (levelPatterns.get(level) || 0) + 1);
        }

        // Extract range pattern like (001-100), (101-200)
        const rangeMatch = tag.match(/\((\d{3}-\d{3,4})\)/);
        if (rangeMatch) {
            const range = rangeMatch[1];
            rangePatterns.set(range, (rangePatterns.get(range) || 0) + 1);
        }
    }

    // Sort and display levels
    const sortedLevels = Array.from(levelPatterns.entries()).sort((a, b) => b[1] - a[1]);
    sortedLevels.forEach(([level, count]) => console.log(`  ${level}: ${count} words`));

    console.log('\n📏 Range Patterns:');
    const sortedRanges = Array.from(rangePatterns.entries()).sort((a, b) => {
        const aNum = parseInt(a[0].split('-')[0]);
        const bNum = parseInt(b[0].split('-')[0]);
        return aNum - bNum;
    });
    sortedRanges.forEach(([range, count]) => console.log(`  (${range}): ${count} words`));

    process.exit(0);
}

analyzeToeicTags().catch(err => {
    console.error(err);
    process.exit(1);
});

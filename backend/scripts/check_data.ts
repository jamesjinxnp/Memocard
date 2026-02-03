import { db } from '../src/db/client';
import { levels, vocabulary } from '../src/db/schema';
import { eq, asc, like, sql } from 'drizzle-orm';

async function checkData() {
    // Check levels
    console.log('\n📊 Levels in oxford3000:');
    const ox3kLevels = await db.select().from(levels).where(eq(levels.deckId, 'oxford3000')).orderBy(asc(levels.order));
    ox3kLevels.forEach(l => console.log(`  ${l.order}: ${l.name} (id: ${l.id})`));

    console.log('\n📊 Levels in oxford5000:');
    const ox5kLevels = await db.select().from(levels).where(eq(levels.deckId, 'oxford5000')).orderBy(asc(levels.order));
    ox5kLevels.forEach(l => console.log(`  ${l.order}: ${l.name} (id: ${l.id})`));

    // Check CEFR distribution in vocabulary
    console.log('\n📖 Vocabulary CEFR distribution (oxford3000 tag):');
    const ox3kVocab = await db
        .select({
            cefr: vocabulary.cefr,
            count: sql<number>`count(*)`,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%oxford3000%'))
        .groupBy(vocabulary.cefr);
    ox3kVocab.forEach(v => console.log(`  ${v.cefr || 'NULL'}: ${v.count} words`));

    console.log('\n📖 Vocabulary CEFR distribution (oxford5000 tag):');
    const ox5kVocab = await db
        .select({
            cefr: vocabulary.cefr,
            count: sql<number>`count(*)`,
        })
        .from(vocabulary)
        .where(like(vocabulary.tag, '%oxford5000%'))
        .groupBy(vocabulary.cefr);
    ox5kVocab.forEach(v => console.log(`  ${v.cefr || 'NULL'}: ${v.count} words`));

    process.exit(0);
}

checkData().catch(err => {
    console.error(err);
    process.exit(1);
});

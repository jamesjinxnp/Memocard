import { db } from './src/db/client';
import { cards, vocabulary } from './src/db/schema';
import { eq, asc } from 'drizzle-orm';

const allCards = await db
    .select({
        cardId: cards.id,
        word: vocabulary.word,
        due: cards.due,
        state: cards.state,
        scheduledDays: cards.scheduledDays,
        stability: cards.stability,
        difficulty: cards.difficulty,
    })
    .from(cards)
    .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
    .orderBy(asc(cards.due))
    .limit(30);

const now = new Date();
console.log('Current time:', now.toISOString());
console.log(`Total cards found: ${allCards.length}\n`);
console.log('=== Cards Due Dates ===\n');

allCards.forEach((c, i) => {
    const dueDate = new Date(c.due);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    console.log(`${(i + 1).toString().padStart(2)}. ${c.word.padEnd(20)} | Due: ${dueDate.toISOString().slice(0, 10)} | In: ${diffDays.toString().padStart(3)}d ${diffHours.toString().padStart(2)}h | State: ${c.state} | ScheduledDays: ${c.scheduledDays}`);
});

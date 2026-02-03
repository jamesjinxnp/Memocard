import { db } from '../src/db/client';
import { levels, units, nodes } from '../src/db/schema';
import { eq, sql, inArray, asc } from 'drizzle-orm';

async function checkOxfordNodeTypes() {
    console.log('\n📊 Checking Oxford deck node types:');

    for (const deckId of ['oxford3000', 'oxford5000']) {
        console.log(`\n📦 ${deckId}:`);

        // Get all levels for this deck
        const deckLevels = await db.select().from(levels).where(eq(levels.deckId, deckId));
        const levelIds = deckLevels.map(l => l.id);

        if (levelIds.length === 0) {
            console.log('  No levels found');
            continue;
        }

        // Get all units for these levels
        const deckUnits = await db.select().from(units).where(inArray(units.levelId, levelIds));
        const unitIds = deckUnits.map(u => u.id);

        if (unitIds.length === 0) {
            console.log('  No units found');
            continue;
        }

        // Get node types for these units
        const result = await db
            .select({
                type: nodes.type,
                count: sql<number>`count(*)`
            })
            .from(nodes)
            .where(inArray(nodes.unitId, unitIds))
            .groupBy(nodes.type);

        result.forEach(r => {
            console.log(`  ${r.type}: ${r.count} nodes`);
        });
    }

    process.exit(0);
}

checkOxfordNodeTypes().catch(err => {
    console.error(err);
    process.exit(1);
});

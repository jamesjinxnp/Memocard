import { db } from '../src/db/client';
import { levels, units, nodes } from '../src/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

async function checkNodeOrder() {
    console.log('\n📊 TOEIC Node Order Analysis:');

    // Get all levels
    const toeicLevels = await db.select().from(levels).where(eq(levels.deckId, 'toeic')).orderBy(asc(levels.order));

    let globalNodeIndex = 0;

    for (const level of toeicLevels) {
        console.log(`\n📚 ${level.name}:`);

        const levelUnits = await db.select().from(units).where(eq(units.levelId, level.id)).orderBy(asc(units.order));
        const unitIds = levelUnits.map(u => u.id);

        if (unitIds.length === 0) continue;

        // Get nodes in proper order (by unit order, then node order)
        for (const unit of levelUnits) {
            const unitNodes = await db.select().from(nodes).where(eq(nodes.unitId, unit.id)).orderBy(asc(nodes.order));

            console.log(`   Unit: ${unit.name}`);
            unitNodes.slice(0, 3).forEach(n => {
                globalNodeIndex++;
                console.log(`      Global #${globalNodeIndex}: Node ID ${n.id} (order: ${n.order})`);
            });
            if (unitNodes.length > 3) {
                globalNodeIndex += unitNodes.length - 3;
                console.log(`      ... and ${unitNodes.length - 3} more nodes`);
            }
        }
    }

    console.log(`\n📊 Total global node count: ${globalNodeIndex}`);

    process.exit(0);
}

checkNodeOrder().catch(err => {
    console.error(err);
    process.exit(1);
});

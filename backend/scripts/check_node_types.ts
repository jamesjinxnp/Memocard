import { db } from '../src/db/client';
import { nodes } from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function checkNodeTypes() {
    console.log('\n📊 Node Types Distribution:');
    const result = await db
        .select({
            type: nodes.type,
            count: sql<number>`count(*)`
        })
        .from(nodes)
        .groupBy(nodes.type);

    result.forEach(r => {
        console.log(`  ${r.type}: ${r.count} nodes`);
    });

    process.exit(0);
}

checkNodeTypes().catch(err => {
    console.error(err);
    process.exit(1);
});

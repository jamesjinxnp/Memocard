import { db } from './client';
import { users, reviewLogs } from './schema';
import { eq, sql, and } from 'drizzle-orm';

async function debugQuery() {
    console.log('🔍 Debug: Checking review logs...');

    // Find test user
    const testUser = await db.query.users.findFirst({
        where: eq(users.email, 'test@gmail.com'),
    });

    if (!testUser) {
        console.log('❌ Test user not found');
        return;
    }

    console.log(`👤 User: ${testUser.id}`);

    // Count all review logs for this user
    const totalLogs = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewLogs)
        .where(eq(reviewLogs.userId, testUser.id));

    console.log(`📚 Total review logs: ${totalLogs[0]?.count}`);

    // Get a sample of review logs
    const sampleLogs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.userId, testUser.id))
        .limit(5);

    console.log('📝 Sample logs:');
    sampleLogs.forEach(log => {
        console.log(`  - ID: ${log.id}, Rating: ${log.rating}, ReviewedAt: ${log.reviewedAt} (type: ${typeof log.reviewedAt})`);
    });

    // Test the date query
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 270 + 1);
    const startTimestamp = startDate.getTime();

    console.log(`\n📅 Start date: ${startDate.toISOString()}`);
    console.log(`⏰ Start timestamp: ${startTimestamp}`);

    // Test grouping by date
    const groupedByDate = await db
        .select({
            date: sql<string>`date(${reviewLogs.reviewedAt} / 1000, 'unixepoch')`,
            count: sql<number>`count(*)`
        })
        .from(reviewLogs)
        .where(and(
            eq(reviewLogs.userId, testUser.id),
            sql`${reviewLogs.reviewedAt} >= ${startTimestamp}`
        ))
        .groupBy(sql`date(${reviewLogs.reviewedAt} / 1000, 'unixepoch')`);

    console.log(`\n📊 Days with activity: ${groupedByDate.length}`);
    if (groupedByDate.length > 0) {
        console.log('Sample dates:');
        groupedByDate.slice(0, 5).forEach(d => {
            console.log(`  - ${d.date}: ${d.count} reviews`);
        });
    }

    // Check raw reviewedAt values
    console.log('\n🔎 Raw reviewedAt check:');
    const rawCheck = await db
        .select({
            reviewedAt: reviewLogs.reviewedAt,
            asDate: sql<string>`datetime(${reviewLogs.reviewedAt} / 1000, 'unixepoch')`
        })
        .from(reviewLogs)
        .where(eq(reviewLogs.userId, testUser.id))
        .limit(3);

    rawCheck.forEach(r => {
        console.log(`  - Raw: ${r.reviewedAt}, Converted: ${r.asDate}`);
    });
}

debugQuery()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Debug failed:', err);
        process.exit(1);
    });

import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { db } from './client';
import { vocabulary } from './schema';

const CLOUDINARY_BASE_URL = process.env.CLOUDINARY_BASE_URL || 'https://res.cloudinary.com/your-cloud/image/upload/memocard/';

async function seedVocabulary() {
    console.log('🌱 Starting vocabulary seed...');

    // Read CSV file - use absolute path (go up from backend/src/db to root/source)
    const csvPath = process.env.CSV_PATH || join(dirname(import.meta.dir), '..', '..', 'source', 'oxford_5000.csv');
    console.log('📁 CSV Path:', csvPath);
    const csvContent = readFileSync(csvPath, 'utf-8');

    // Parse CSV
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    console.log(`📚 Found ${records.length} vocabulary entries`);

    // Process in batches of 100
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        const values = batch.map((record: any) => ({
            word: record.word || '',
            defTh: record.defTh || null,
            defEn: record.defEn || null,
            type: record.type || null,
            ipaUs: record.ipa_us || null,
            ipaUk: record.ipa_uk || null,
            cefr: record.cefr || null,
            example: record.example || null,
            audioTh: record.audioTh || null,
            audioEn: record.audioEn || null,
            audioExample: record.audio_example || null,
            imageUrl: record.image
                ? `${CLOUDINARY_BASE_URL}${record.image}`
                : null,
        }));

        await db.insert(vocabulary).values(values);
        inserted += batch.length;

        console.log(`✅ Inserted ${inserted}/${records.length} records`);
    }

    console.log('🎉 Vocabulary seed completed!');
}

// Run if executed directly
seedVocabulary()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    });

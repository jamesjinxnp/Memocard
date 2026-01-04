import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ==================== USERS ====================
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    preferences: text('preferences'), // JSON: { dailyNewCards, darkMode, etc. }
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// ==================== VOCABULARY ====================
export const vocabulary = sqliteTable('vocabulary', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    word: text('word').notNull(),
    defTh: text('def_th'), // Thai definition
    defEn: text('def_en'), // English definition
    type: text('type'), // part of speech
    ipaUs: text('ipa_us'),
    ipaUk: text('ipa_uk'),
    cefr: text('cefr'), // A1, A2, B1, B2, C1
    example: text('example'),
    audioTh: text('audio_th'),
    audioEn: text('audio_en'),
    audioExample: text('audio_example'),
    imageUrl: text('image_url'), // Cloudinary URL
});

// ==================== CARDS (FSRS State) ====================
export const cards = sqliteTable('cards', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    vocabularyId: integer('vocabulary_id').notNull().references(() => vocabulary.id),

    // FSRS Card fields
    due: integer('due', { mode: 'timestamp' }).notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    learningSteps: integer('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: integer('state').notNull().default(0), // 0=New, 1=Learning, 2=Review, 3=Relearning
    lastReview: integer('last_review', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ==================== REVIEW LOGS ====================
export const reviewLogs = sqliteTable('review_logs', {
    id: text('id').primaryKey(),
    cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    rating: integer('rating').notNull(), // 1=Again, 2=Hard, 3=Good, 4=Easy
    state: integer('state').notNull(), // State before review
    studyMode: text('study_mode').notNull(), // reading, typing, listening, etc.
    responseTime: integer('response_time'), // milliseconds

    // FSRS log data
    stability: real('stability'),
    difficulty: real('difficulty'),
    elapsedDays: integer('elapsed_days'),
    scheduledDays: integer('scheduled_days'),

    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }).notNull(),
});

// ==================== STUDY SESSIONS ====================
export const studySessions = sqliteTable('study_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(), // reading, typing, listening, multiple_choice, cloze, spelling_bee
    cardsStudied: integer('cards_studied').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    duration: integer('duration'), // seconds
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Vocabulary = typeof vocabulary.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;

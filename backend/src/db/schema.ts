import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

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

// Users relations
export const usersRelations = relations(users, ({ many }) => ({
    cards: many(cards),
    reviewLogs: many(reviewLogs),
    studySessions: many(studySessions),
}));

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
    tag: text('tag'), // Comma-separated tags: "oxford3000,Toeic,Level 600"
});

// Vocabulary relations
export const vocabularyRelations = relations(vocabulary, ({ many }) => ({
    cards: many(cards),
}));

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
}, (table) => [
    // Composite index for optimized queue queries: WHERE userId = ? AND state = ? AND due <= ?
    index('idx_cards_user_due_state').on(table.userId, table.due, table.state),
    // Additional index for state-based counts
    index('idx_cards_user_state').on(table.userId, table.state),
]);

// Cards relations
export const cardsRelations = relations(cards, ({ one, many }) => ({
    user: one(users, {
        fields: [cards.userId],
        references: [users.id],
    }),
    vocabulary: one(vocabulary, {
        fields: [cards.vocabularyId],
        references: [vocabulary.id],
    }),
    reviewLogs: many(reviewLogs),
}));

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
}, (table) => [
    // Index for user's review history queries
    index('idx_review_logs_user_reviewed').on(table.userId, table.reviewedAt),
]);

// Review logs relations
export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
    card: one(cards, {
        fields: [reviewLogs.cardId],
        references: [cards.id],
    }),
    user: one(users, {
        fields: [reviewLogs.userId],
        references: [users.id],
    }),
}));

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

// Study sessions relations
export const studySessionsRelations = relations(studySessions, ({ one }) => ({
    user: one(users, {
        fields: [studySessions.userId],
        references: [users.id],
    }),
}));

// ==================== LEARNING PATH: LEVELS ====================
export const levels = sqliteTable('levels', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deckId: text('deck_id').notNull(), // 'oxford3000', 'Toeic', etc.
    name: text('name').notNull(), // 'Level A1', 'Beginner'
    description: text('description'),
    order: integer('order').notNull().default(0),
    theme: text('theme'), // 'Food', 'Travel', 'Business'
    requiredCrowns: integer('required_crowns').notNull().default(0), // Crowns needed to unlock
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
    index('idx_levels_deck_order').on(table.deckId, table.order),
]);

// Levels relations
export const levelsRelations = relations(levels, ({ many }) => ({
    units: many(units),
}));

// ==================== LEARNING PATH: UNITS ====================
export const units = sqliteTable('units', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    levelId: integer('level_id').notNull().references(() => levels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // 'Unit 1: Food'
    description: text('description'),
    order: integer('order').notNull().default(0),
    icon: text('icon'), // Emoji or icon name
    color: text('color'), // Hex or Tailwind color
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
    index('idx_units_level_order').on(table.levelId, table.order),
]);

// Units relations
export const unitsRelations = relations(units, ({ one, many }) => ({
    level: one(levels, {
        fields: [units.levelId],
        references: [levels.id],
    }),
    nodes: many(nodes),
}));

// ==================== LEARNING PATH: NODES ====================
export const nodes = sqliteTable('nodes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    unitId: integer('unit_id').notNull().references(() => units.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('lesson'), // 'lesson', 'practice', 'boss', 'checkpoint'
    order: integer('order').notNull().default(0),
    requiredStars: integer('required_stars').notNull().default(0), // Stars from previous nodes to unlock (0 = sequential)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
    index('idx_nodes_unit_order').on(table.unitId, table.order),
]);

// Nodes relations
export const nodesRelations = relations(nodes, ({ one, many }) => ({
    unit: one(units, {
        fields: [nodes.unitId],
        references: [units.id],
    }),
    nodeVocabulary: many(nodeVocabulary),
    userProgress: many(userProgress),
}));

// ==================== LEARNING PATH: NODE_VOCABULARY (Junction) ====================
export const nodeVocabulary = sqliteTable('node_vocabulary', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
    vocabularyId: integer('vocabulary_id').notNull().references(() => vocabulary.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0), // Order within node
}, (table) => [
    index('idx_node_vocab_node').on(table.nodeId),
    index('idx_node_vocab_vocabulary').on(table.vocabularyId),
]);

// NodeVocabulary relations
export const nodeVocabularyRelations = relations(nodeVocabulary, ({ one }) => ({
    node: one(nodes, {
        fields: [nodeVocabulary.nodeId],
        references: [nodes.id],
    }),
    vocabulary: one(vocabulary, {
        fields: [nodeVocabulary.vocabularyId],
        references: [vocabulary.id],
    }),
}));

// ==================== LEARNING PATH: USER_PROGRESS ====================
export const userProgress = sqliteTable('user_progress', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
    status: integer('status').notNull().default(0), // 0=locked, 1=available, 2=completed
    stars: integer('stars').notNull().default(0), // 0-3 stars based on performance
    crowns: integer('crowns').notNull().default(0), // 0-5 crowns (replay value)
    attempts: integer('attempts').notNull().default(0),
    bestScore: integer('best_score').notNull().default(0), // Percentage 0-100
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
}, (table) => [
    index('idx_user_progress_user_node').on(table.userId, table.nodeId),
    index('idx_user_progress_user_status').on(table.userId, table.status),
]);

// UserProgress relations
export const userProgressRelations = relations(userProgress, ({ one }) => ({
    user: one(users, {
        fields: [userProgress.userId],
        references: [users.id],
    }),
    node: one(nodes, {
        fields: [userProgress.nodeId],
        references: [nodes.id],
    }),
}));

// ==================== USER STATS (Gamification) ====================
export const userStats = sqliteTable('user_stats', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
    totalXp: integer('total_xp').notNull().default(0),
    totalCrowns: integer('total_crowns').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    lastStudyDate: integer('last_study_date', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// UserStats relations
export const userStatsRelations = relations(userStats, ({ one }) => ({
    user: one(users, {
        fields: [userStats.userId],
        references: [users.id],
    }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Vocabulary = typeof vocabulary.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;

// Learning Path types
export type Level = typeof levels.$inferSelect;
export type NewLevel = typeof levels.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
export type NodeVocabulary = typeof nodeVocabulary.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;
export type UserStats = typeof userStats.$inferSelect;

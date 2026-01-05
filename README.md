# 📚 Memocard

<div align="center">

**A modern English vocabulary flashcard app powered by FSRS algorithm**

[![Bun](https://img.shields.io/badge/Bun-1.0+-black?logo=bun)](https://bun.sh)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## ✨ Features

- 🧠 **Smart Scheduling** - FSRS algorithm for optimal review timing
- 📖 **6 Study Modes** - Reading, Typing, Listening, Multiple Choice, Context Cloze, Spelling Bee
- 🔊 **Text-to-Speech** - Native pronunciation using Web Speech API
- 📊 **Progress Tracking** - Streak, accuracy charts, and study statistics
- 🌙 **Dark Theme** - Eye-friendly dark mode interface
- 📱 **Responsive** - Works on desktop and mobile

---

## � Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Bun.js |
| **Backend** | Elysia.js |
| **Database** | Turso (LibSQL) + Drizzle ORM |
| **Frontend** | React 19 + Vite |
| **State** | Zustand + TanStack Query |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Algorithm** | ts-fsrs |

---

## � Study Modes

| Mode | Description |
|------|-------------|
| 📗 **Reading** | Classic flashcard flip with pronunciation |
| ⌨️ **Typing** | Type the word from its definition |
| 🎧 **Listening** | Audio-only vocabulary practice |
| 🔘 **Multiple Choice** | Pick the correct definition |
| 📝 **Context Cloze** | Fill in the blank in example sentences |
| 🐝 **Spelling Bee** | Progressive hint-based spelling challenge |

---

## � Getting Started

### Prerequisites
- [Bun](https://bun.sh) v1.0+
- [Turso](https://turso.tech) account

### Installation

```bash
# Clone the repository
git clone https://github.com/jamesjinxnp/Memocard
cd Memocard

# Backend setup
cd backend
cp .env.example .env    # Edit with your credentials
bun install
bun run db:push
bun run db:seed         # Import Oxford 5000 vocabulary
bun run dev

# Frontend setup (new terminal)
cd frontend
bun install
bun run dev
```

### Environment Variables

```env
# backend/.env
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-token
JWT_SECRET=your-secret-key
```

---

## 📂 Project Structure

```
Memocard/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Elysia server entry
│   │   ├── db/               # Database schema
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # FSRS service
│   │   └── middleware/       # Auth middleware
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Dashboard, Study, Settings
│   │   ├── components/       # UI components
│   │   ├── services/         # API & audio services
│   │   └── stores/           # Zustand stores
│   └── package.json
└── source/
    └── oxford_5000.csv       # Vocabulary dataset
```

---

## 🌐 Deployment

| Service | Platform |
|---------|----------|
| Backend | [Render] |
| Frontend | [Vercel]|
| Database | [Turso] |
| Images  | [Cloudinary]|

---

## 📸 Screenshots

> *Coming soon*

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

---

## 📄 License

MIT © 2026

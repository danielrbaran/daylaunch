# DayLaunch

A local-first, AI-powered daily planning system that dynamically builds personalized daily schedules based on mental state, capacity, and **curiosity**—not goals. Plans are guided by "I wonder…" (invitations to explore) rather than "I will…" (targets to hit). Any action taken is celebrated.

## Overview

DayLaunch solves the problem of manual planning system maintenance by using a local LLM to analyze journal entries, assess capacity, and generate kind, curiosity-led daily plans across life categories. No goal structure; no pass/fail. See [DAYLAUNCH_V1_PLAN.md](./DAYLAUNCH_V1_PLAN.md) §1.4 for the core philosophy.

## Key Features

- 🤖 **Local AI**: Runs entirely on your machine using Ollama/LM Studio
- 🔒 **Privacy-First**: All data stays local, never leaves your PC
- 🧩 **Modular Architecture**: Components can be swapped for experimentation
- 📱 **PWA**: Works offline, feels native, accessible across devices
- 📊 **Dynamic Planning**: Adapts to your mental state and capacity; curiosity-led ("I wonder…"), not goal-based
- 💚 **Dark Green Theme**: Soothing, calming visual design

## Architecture

- **Frontend**: PWA with timeline view (React/SvelteKit)
- **Backend**: API server (Express/TypeScript)
- **MCP Server**: Data access layer for LLM
- **LLM**: Local models via Ollama (Llama 3.1 70B)
- **Database**: SQLite + Prisma ORM

## Project Structure

```
daylaunch/
├── backend/          # Express API server
├── mcp-server/       # MCP server for LLM integration
├── frontend/         # PWA frontend (coming soon)
└── DAYLAUNCH_V1_PLAN.md  # Detailed planning document
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Ollama installed and running locally
- Llama 3.1 70B model downloaded in Ollama

### Installation

1. Install dependencies:
```bash
npm install
npm run install:all
```

2. Set up the database:
```bash
cd backend
npm run db:generate
npm run db:push
```

3. Configure environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your settings
```

4. Start the backend:
```bash
npm run dev:backend
```

5. Start the MCP server (in another terminal, optional for plan generation):
```bash
npm run dev:mcp
```

### Generate a daily plan (Phase 3)

With the backend and Ollama running:

1. Ensure Ollama has a model (e.g. `ollama pull llama3.1:70b` or `ollama pull llama3.1:8b`).
2. Initialize default categories (one-time): `POST http://localhost:3001/api/categories/initialize`
3. Generate a plan for a date:
   - `POST http://localhost:3001/api/plans/generate` with body `{ "date": "2026-02-15" }`
   - To regenerate and replace an existing plan: `{ "date": "2026-02-15", "replace": true }`
4. Check Ollama: `GET http://localhost:3001/health/ollama`

## Status

✅ **Phase 1: Foundation** – Complete  
✅ **Phase 2: Core Data Layer** – Complete  
✅ **Phase 3: LLM Integration** – Complete (plan generation via Ollama)

See [DAYLAUNCH_V1_PLAN.md](./DAYLAUNCH_V1_PLAN.md) for detailed planning document.

## License

MIT License - See LICENSE file for details

Built with Llama 3.1 (Meta)

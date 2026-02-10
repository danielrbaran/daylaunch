# DayLaunch Setup Guide

## Phase 1: Foundation Setup

### Step 1: Install Ollama

1. Download Ollama from https://ollama.com
2. Install and start Ollama
3. Pull the Llama 3.1 70B model:
```bash
ollama pull llama3.1:70b
```

**Note**: The 70B model is large (~40GB). If you want to start smaller for testing:
```bash
ollama pull llama3.1:8b  # Much smaller, faster, but less capable
```

### Step 2: Verify Ollama is Running

```bash
ollama list
```

You should see your downloaded model(s).

Test the connection:
```bash
curl http://localhost:11434/api/tags
```

### Step 3: Install Project Dependencies

From the project root:
```bash
npm install
npm run install:all
```

### Step 4: Set Up Database

```bash
cd backend
npm run db:generate  # Generate Prisma client
npm run db:push       # Create database schema
```

This creates `backend/data/daylaunch.db` (SQLite database).

### Step 5: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` if needed (defaults should work for local development).

### Step 6: Start Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - MCP Server:**
```bash
npm run dev:mcp
```

### Step 7: Test the Setup

1. Backend health check:
```bash
curl http://localhost:3001/health
```

2. Test Ollama directly:
```bash
ollama run llama3.1:70b "Hello, can you hear me?"
```

## Next Steps

Once Phase 1 is complete, we'll:
- Implement database operations
- Connect MCP server to database
- Test LLM integration via MCP
- Begin Phase 2: Core Data Layer

## Troubleshooting

### Ollama not responding
- Check if Ollama is running: `ollama list`
- Verify port 11434 is accessible
- Try restarting Ollama

### Database errors
- Make sure you ran `npm run db:generate` and `npm run db:push`
- Check that `backend/data/` directory exists and is writable

### Port conflicts
- Backend defaults to port 3001
- Change in `backend/.env` if needed

# DayLaunch

A local-first, AI-powered daily planning system that dynamically builds personalized daily schedules based on mental state, capacity, and goals.

## Overview

DayLaunch solves the problem of manual planning system maintenance by using a local LLM to analyze journal entries, assess capacity, and generate realistic daily plans across multiple life categories.

## Key Features

- 🤖 **Local AI**: Runs entirely on your machine using Ollama/LM Studio
- 🔒 **Privacy-First**: All data stays local, never leaves your PC
- 🧩 **Modular Architecture**: Components can be swapped for experimentation
- 📱 **PWA**: Works offline, feels native, accessible across devices
- 📊 **Dynamic Planning**: Adapts to your mental state and capacity

## Architecture

- **Frontend**: PWA with timeline view (React/SvelteKit)
- **Backend**: API server (FastAPI/Express)
- **MCP Server**: Data access layer for LLM
- **LLM**: Local models via Ollama/LM Studio
- **Database**: SQLite/PostgreSQL + Vector DB

## Status

🚧 **Planning Phase** - See [DAYLAUNCH_V1_PLAN.md](./DAYLAUNCH_V1_PLAN.md) for detailed planning document.

## Getting Started

_Coming soon - project is in early development_

## License

_To be determined_

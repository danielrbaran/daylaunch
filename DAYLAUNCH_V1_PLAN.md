# DayLaunch v1 - Planning Document

**Version:** 1.2  
**Created:** February 6, 2026  
**Last Updated:** February 2026  
**Status:** Planning Phase - Feedback Mechanism Defined; Philosophy: Curiosity, Not Goals

---

## 1. Project Overview

### 1.1 Vision
A local-first, AI-powered daily planning system that dynamically builds personalized daily schedules based on mental state, capacity, and **curiosity**—not goals. The system learns from journal entries and historical patterns to create realistic, kind daily plans that invite exploration and celebrate any action taken. Plans are framed as "I wonder…" (what might I try? what am I curious about?) rather than "I will…" (targets to hit or miss).

### 1.2 Core Problem
Traditional planning systems (spreadsheets, calendars) require manual maintenance that becomes unsustainable. Many also impose a **goal structure** on personal life: daily objectives, targets, pass/fail. DayLaunch rejects that. It automates the planning process by:
- Analyzing mental state and capacity from journal entries
- Dynamically building days that match current capacity
- Offering **invitations to explore** across life categories, not checkboxes to achieve
- Learning from patterns and feedback without punishing "failure"

### 1.3 Key Principles
- **Local-first**: All data stays on your machine, no cloud dependencies
- **Privacy-focused**: Journal entries and personal data never leave your PC
- **Curiosity, not goals**: Personal life is guided by "I wonder…" and exploration; no punitive, target-based framing. Any action taken is celebrated.
- **I wonder, not I will**: Plans suggest what the user might try or explore—not what they must achieve. Completion means "what did I do? what did I notice?" not "did I hit the goal?"
- **Modular architecture**: Components can be swapped out for experimentation
- **AI-powered**: Uses local LLM to understand context and build intelligent, curiosity-led plans
- **PWA experience**: Works offline, feels native, accessible across devices

### 1.4 Core Philosophy: Curiosity, Not Goals (Immutable)

**DayLaunch must never apply a goal structure to how a person conducts their day.**

- **Goals** (e.g. "My goal is to do 10 push-ups today") are built-in failure: you either hit the number or you don't. In personal life, that is toxic and punitive.
- **Curiosity** (e.g. "I wonder how many push-ups I can do today?") is pure exploration. Any action taken—one push-up or twenty—is a success. There is no pass/fail.

The system and all of its copy, prompts, and logic must reflect:
- **Invitations, not obligations**: "You might try…" / "I wonder if…" / "What would it be like to…"
- **Reflection, not judgment**: "What did you do?" / "What did you notice?" — not "Did you achieve your goal?"
- **Celebration of any action**: Something done is always enough. The system never frames the user as having "failed" a day.

This philosophy is a first-order constraint. New features, prompts, or UI that introduce goal-based or target-based framing for personal daily conduct are out of scope and must be rejected.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend PWA                          │
│  (React/SvelteKit - Timeline View, Category Columns)        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Server                        │
│  (FastAPI/Express - REST endpoints, business logic)         │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ↓                               ↓
┌───────────────────────┐      ┌──────────────────────────┐
│   MCP Server          │      │   Database/Data Layer    │
│  (Data Access Layer)  │      │  (SQLite/PostgreSQL +    │
│                       │      │   Vector DB for          │
│  - Tools              │      │   embeddings)            │
│  - Resources          │      │                          │
│  - Data Adapters      │      │  - Journal entries       │
└───────────┬───────────┘      │  - Daily plans           │
            │                   │  - Tasks                 │
            │                   │  - Categories            │
            │                   │  - Completion history    │
            │                   └──────────────────────────┘
            │
            ↓
┌─────────────────────────────────────────────────────────────┐
│                    LLM Integration Layer                     │
│  (Ollama/LM Studio - Local LLM that uses MCP tools)         │
│                                                              │
│  - Planning Engine (generates daily plans)                  │
│  - Context Analyzer (processes journal entries)             │
│  - Capacity Assessor (determines daily capacity)            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

#### Frontend PWA
- Display daily timeline (vertical axis)
- Show categories horizontally (exercise, diet, work, social, debt, etc.)
- Allow task completion/interaction
- Offline support via service worker
- Responsive design

#### Backend API
- REST endpoints for frontend
- Business logic for planning
- Data validation
- Authentication (if needed)
- WebSocket support for real-time updates (future)

#### MCP Server
- Exposes standardized tools/resources to LLM
- Abstracts data access layer
- Enables LLM to query journals, create plans, access history
- Makes swapping LLM providers easy

#### LLM Integration
- Uses MCP tools to access data
- Generates daily plans based on context
- Analyzes journal entries for mental state
- Assesses capacity from historical patterns

#### Database Layer
- Stores all application data
- **Pool** (tasks, events, aspirations) and use tracking (last_used_at, cooldown)
- Journal entries (with embeddings for semantic search)
- Daily plans and tasks (tasks may reference Pool items)
- Completion history
- Category definitions and settings

---

## 3. Core Features

### 3.1 Daily Planning Engine

**Inputs:**
- **The Pool** (see §3.2): active tasks, events, and aspirations—primary raw materials for the plan
- Recent journal entries (last 7-14 days)
- Historical patterns (what the user tended to try or explore; no "achievement" targets)
- **End-of-day feedback from previous days** (primary learning signal)
- Current capacity indicators (sleep, energy, recent workload)
- **Areas of curiosity / what the user is exploring** (per category)—never "goals" or "priorities to achieve"
- Pattern insights (day-of-week, category preferences, capacity trends)
- Pool item use history (last used, cooldown) so items aren’t over- or under-used

**Output:**
- Daily timeline with **invitations to explore** drawn from the Pool (and optionally 1–2 "I wonder…" ideas)
- Time-specific suggestions (e.g. "you might try… at 2pm"); events placed at fixed times
- Realistic scope based on capacity
- **Curiosity-led suggestions** in a suggested order (order is for flow only, not importance or target-hitting)

**Process:**
1. LLM analyzes recent journal entries via MCP `get_journal_entries`
2. Assesses mental state and capacity via MCP `query_capacity_indicators`
3. Reviews historical patterns via MCP `get_task_history`
4. **Loads active items from the Pool** (see §3.2)—tasks, events, aspirations—as raw materials
5. **Analyzes recent feedback via MCP `get_recent_feedback`** (learns what works)
6. **Considers pattern insights via MCP `get_pattern_insights`** (applies learned patterns)
7. **Generates plan** by selecting, adapting, and sequencing from the Pool (plus optional "I wonder…" ideas); uses MCP `create_daily_plan`
8. Plan stored in database, exposed to frontend

### 3.2 The Pool

The **Pool** is the primary input layer for the daily plan: a single place for tasks, events, and aspirations. The planning engine draws from the Pool to build each day instead of inventing the day from scratch. The name is intentional—evocative, fluid; not "backlog."

**Purpose:**
- Give the LLM **raw materials** grounded in what the user actually wants to do or explore
- Keep aspirations (e.g. "look into improv classes in Indy") from getting lost—they stay in the Pool until the right day
- Respect events (dentist, meetings) as fixed points
- Let the engine **curate and sequence** from the Pool rather than generate everything from thin air

**Pool item types:**

| Type | Description | Example |
|------|-------------|--------|
| **Task** | Concrete thing to try or do | "Call Capital One about hardship program" |
| **Event** | Fixed date/time (or known window) | "Dentist 2pm Thursday" |
| **Aspiration** | Open-ended idea to explore when it fits | "Look into improv classes in Indy" |

**Behavior:**
- **Tasks** and **aspirations** can be suggested on any day; the LLM chooses which to surface based on capacity, category balance, and **use frequency** (see below)
- **Events** are placed on the plan on their date/time; the LLM works around them
- The plan can include **0–2 "I wonder…" ideas** generated by the LLM (not from the Pool) to keep curiosity alive—e.g. "I wonder what a 20-minute walk would feel like today?" Some days can be pool-only (zero such ideas).

**Preventing over-use / under-use:**
- **Last used:** When a Pool item is used in a plan, record the date (and optionally which plan/task it became). The LLM can be instructed not to reuse the same item too soon (e.g. cooldown: N days for tasks, longer for aspirations).
- **Use frequency / cooldown:** Optional per-item or global rules (e.g. "use this at most once per week") so the same item doesn’t dominate every day
- **Status:** Items can be *active* (in the pool for selection), *paused* (user temporarily doesn’t want it suggested), or *used* (e.g. one-off event completed). Only *active* (and relevant *event*) items are fed to the planner

**UX (later):** A **Pool** view in the app: add/edit/remove tasks, events, aspirations; optional filters by type or category; the day view remains the timeline, built from the Pool + "I wonder…" layer.

**Pool: design decisions (MVP)**

1. **Cooldown:** Use a **global default** (e.g. 1 day for tasks, 3 for aspirations). More granular per-item or per-type rules can be added later; global is sufficient for MVP.
2. **Dates only for events:** Only **events** have a date/time (`scheduled_at`, optionally `scheduled_end`). Tasks and aspirations do **not** get a "do by" or "try on" date—that would add a punitive layer. What the user actually did or explored is captured by **end-of-day reflection** (feedback + activity log), not by pre-assigning dates to pool items.
3. **"I wonder…" ideas:** **0–2** per day (configurable). Some days can be **pool-only** (zero LLM-generated "I wonder…" suggestions); others can include one or two. Keeps curiosity alive without overwhelming.
4. **Linking Pool → task and updating last_used_at:** When the planner turns a Pool item into a plan task, create the task with `pool_item_id` and update that Pool item’s `last_used_at` and `use_count` **in the same transaction as plan creation**. Keeps data consistent and avoids drift.

### 3.3 Categories

Initial categories to support (each as an **area of curiosity**; Pool items can be tagged with a category):
- **Exercise**: Invitations to move (e.g. "I wonder what kind of movement feels good today?")
- **Diet**: Suggestions for meals/timing—exploration, not "hit your macros"
- **Work**: Focus areas or things to try (e.g. "you might explore…"); no "priority tasks to achieve"
- **Social**: Relationship-building invitations (e.g. "I wonder who you might reach out to?")
- **Debt**: Concrete steps to try (e.g. "you could try calling…"); framed as exploration, not "goal: pay X"
- **Learning**: Skill or reading exploration
- **Personal**: Self-care, hobbies, rest—what might feel good

**Design:**
- Categories are configurable
- Each category can have:
  - **Areas of curiosity or interest** (what the user is exploring)—never "goals" or "priorities to achieve"
  - Time preferences (morning/afternoon/evening)
  - Frequency preferences (how often the user likes to touch this area)
  - Dependencies on other categories (optional)

### 3.4 Journal Entry Analysis

**Data Collection:**
- Free-form text entries
- Optional structured fields (mood, energy level, sleep quality)
- Timestamp and metadata

**Analysis:**
- LLM extracts mental state indicators
- Identifies patterns (what days are harder, what helps)
- Assesses capacity for planning
- Stores insights for future reference

**Storage:**
- Raw entries in database
- Embeddings in vector DB for semantic search
- Summaries/insights stored for quick access

### 3.5 Timeline View

**Visualization:**
- Vertical timeline (hours of day)
- Horizontal categories (as areas of curiosity)
- **Invitations to explore** (not "tasks") placed at suggested times
- Visual indicators:
  - Suggested order (for flow only—not "priority" as in importance or achievement)
  - What happened / what you tried (completion = "I did something" or "I skipped it"—no pass/fail)
  - Capacity level (how full the day is)
  - Category color coding

**Interactions:**
- Note what you did / what you tried (any action celebrated; no "failed" framing)
- Reschedule suggestions
- Add manual invitations ("I wonder if I could…")
- View details
- Adjust timeline zoom

### 3.6 Capacity Assessment

**Factors:**
- Recent sleep patterns
- Mental state from journal entries
- Recent workload/completion rates
- Day of week patterns
- Historical "what works" data
- **End-of-day feedback** (newly added)

**Output:**
- Capacity score (low/medium/high)
- Recommended task count
- Suggested intensity levels
- Time distribution recommendations

### 3.7 End-of-Day Feedback Mechanism

**Purpose:**
Capture user experience with daily plans to enable continuous learning and improvement. This is the primary feedback loop that allows the system to adapt to the user's actual capacity and preferences.

**Timing:**
- Modal appears at end of day (configurable time, default: 8pm)
- Only shows if user hasn't already provided feedback for that day
- Can be manually triggered from the app
- "Skip for today" option available (acknowledges that some days users won't have energy)

**Feedback Flow:**

1. **Quick Assessment (One-Click Buttons):**
   - "Today's plan was about right" ✅
   - "Today's plan was too much" ⚠️
   - "Today's plan was ok except for one specific area" 🎯

2. **Category Selector (if "one specific area" selected):**
   - Shows all categories as buttons
   - User selects which category was problematic
   - Stored for pattern recognition

3. **Text Elaboration (Optional but Encouraged):**
   - Free-form text entry
   - Prompt: "Tell me more about what worked and what didn't..."
   - LLM extracts actionable insights automatically
   - No forced structure - low friction

4. **Activity Log (Optional but Strongly Encouraged):**
   - Separate affordance/button
   - Detailed account of what actually happened
   - "Detail exactly what you did in as much detail as you can remember"
   - Used for pattern recognition and capacity calibration

**Data Processing:**
- LLM analyzes text entries to extract:
  - Specific issues (e.g., "exercise was too early", "work tasks were too vague")
  - Emotional state indicators
  - Patterns across days
- Insights stored separately for quick LLM access
- Raw data always preserved for future analysis/reporting

**Influence on Planning:**
- Feedback directly influences next day's plan generation
- Pattern recognition identifies trends (e.g., "Mondays are harder", "Exercise in morning works better")
- Capacity assessment refined over time based on feedback
- Category-specific adjustments when specific areas flagged
- **Note**: Influence is implicit - no need to show user how feedback affected next plan

**Pattern Recognition (Future Evolution):**
- System identifies patterns over time:
  - Day-of-week patterns
  - Category-specific preferences
  - Capacity trends
  - What works vs. what doesn't
- Data model supports building reports/insights later
- All raw feedback data preserved for analysis

**Feedback History:**
- All feedback stored permanently
- Raw data available for building custom reports
- Users can review past feedback to see progress
- Enables "what worked" analysis over time

---

## 4. Technical Stack

### 4.1 Backend
- **Language**: Python (FastAPI) or Node.js (Express) - TBD
- **API Framework**: FastAPI (Python) or Express (Node.js)
- **Database**: SQLite (initial) or PostgreSQL (if scaling)
- **Vector DB**: ChromaDB or pgvector (for journal embeddings)
- **ORM**: SQLAlchemy (Python) or Prisma (Node.js)

### 4.2 MCP Server
- **Language**: TypeScript/Node.js (most common) or Python
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: stdio or HTTP
- **Tools**: Journal queries, plan creation, capacity assessment
- **Resources**: Journal entries, daily plans, statistics

### 4.3 LLM Integration
- **Provider**: Ollama (primary) or LM Studio
- **Models**: Start with smaller models (7B-13B), scale to 70B if needed
- **Integration**: MCP client that connects to LLM
- **Context Management**: Chunking, summarization for long contexts

### 4.4 Frontend
- **Framework**: React + Vite or SvelteKit
- **UI Library**: Tailwind CSS or similar
- **PWA**: Service Worker, Web App Manifest
- **State Management**: Zustand (React) or Svelte stores
- **Timeline Component**: Custom or library (e.g., react-calendar-timeline)

### 4.5 Design System

**Color Theme:**
- **Primary**: Dark green theme (soothing, calming)
- Color palette to be defined but centered around dark greens
- Accessible contrast ratios maintained

**Tone & Personality:**
- **Light-hearted fun**: Playful elements, encouraging micro-interactions
- **Genuine encouragement**: Positive reinforcement throughout
- **Supportive, not judgmental**: Language that supports growth
- Examples:
  - Celebration animations for completed tasks
  - Encouraging messages ("You've got this!", "Small steps add up")
  - Playful loading states
  - Gentle reminders (not nagging)
  - Progress celebrations

### 4.6 Development Tools
- **Package Manager**: npm/yarn (Node.js) or poetry/pip (Python)
- **Type Checking**: TypeScript or mypy
- **Testing**: Jest/Vitest (Node.js) or pytest (Python)
- **Linting**: ESLint/Prettier or ruff/black
- **Docker**: Optional, for consistent environments

---

## 5. Data Model

### 5.1 Core Entities

#### PoolItem (the Pool)
```
- id: UUID
- type: Enum (task | event | aspiration)
- title: String (short label)
- notes: Text? (optional detail)
- category_id: UUID? (FK; optional, for task/aspiration)
- scheduled_at: DateTime? (events only: when it happens)
- scheduled_end: DateTime? (optional, events only: end of duration)
- status: Enum (active | paused | completed) — only active (and event on its date) are used by planner
- last_used_at: Date? (last date this item was used in a plan; for cooldown)
- use_count: Integer (default 0; how many times used in a plan)
- cooldown_days: Integer? (optional override; else use global default)
- created_at: DateTime
- updated_at: DateTime
```
Dates only for events (`scheduled_at` / `scheduled_end`). Tasks and aspirations have no date. Cooldown and same-transaction linking: see §3.2 "Pool: design decisions".

#### JournalEntry
```
- id: UUID
- timestamp: DateTime
- content: Text (free-form)
- mood: Enum? (optional)
- energy_level: Integer? (1-10, optional)
- sleep_quality: Integer? (1-10, optional)
- embedding: Vector? (for semantic search)
- created_at: DateTime
- updated_at: DateTime
```

#### Category
```
- id: UUID
- name: String (exercise, diet, work, etc.)
- color: String (hex color)
- icon: String? (optional)
- priority: Integer (default ordering)
- time_preferences: JSON? (morning/afternoon/evening)
- frequency: String? (daily, weekly, etc.)
- enabled: Boolean
- created_at: DateTime
```

#### DailyPlan
```
- id: UUID
- date: Date
- capacity_score: String (low/medium/high)
- mental_state_summary: Text? (from journal analysis)
- created_at: DateTime
- updated_at: DateTime
```

#### Task
```
- id: UUID
- daily_plan_id: UUID (FK)
- category_id: UUID (FK)
- pool_item_id: UUID? (FK; optional; if this task came from the Pool, link for last_used_at tracking)
- title: String
- description: Text?
- scheduled_time: DateTime?
- duration_minutes: Integer?
- priority: Integer (1-5, suggested order only)
- status: Enum (pending, in_progress, completed, skipped)
- completed_at: DateTime?
- notes: Text?
- created_at: DateTime
- updated_at: DateTime
```
When a plan is generated from a Pool item, the created task can store `pool_item_id` so we can update that item’s `last_used_at` (and increment `use_count`) for cooldown logic.

#### CompletionHistory
```
- id: UUID
- task_id: UUID (FK)
- completed_at: DateTime
- actual_duration_minutes: Integer?
- notes: Text?
```

#### DailyFeedback
```
- id: UUID
- daily_plan_id: UUID (FK)
- date: Date
- overall_rating: Enum (about_right, too_much, one_area)
- affected_category_id: UUID? (FK, if one_area selected)
- text_elaboration: Text? (free-form feedback)
- activity_log: Text? (detailed account of what happened)
- extracted_insights: JSON? (LLM-extracted actionable insights)
- sentiment: String? (extracted from text)
- skipped: Boolean (if user skipped feedback)
- created_at: DateTime
- updated_at: DateTime
```

#### PatternInsight
```
- id: UUID
- pattern_type: Enum (day_of_week, category_preference, capacity_trend, etc.)
- pattern_data: JSON (structured pattern information)
- confidence: Float (0-1, how strong the pattern is)
- first_observed: DateTime
- last_observed: DateTime
- is_active: Boolean
- created_at: DateTime
```

### 5.2 Relationships
- **PoolItem** belongs to one Category (optional). PoolItems are standalone input; the planner reads active items and optionally links created tasks via `pool_item_id`.
- DailyPlan has many Tasks
- DailyPlan has one DailyFeedback (optional, can be skipped)
- DailyFeedback belongs to one DailyPlan
- DailyFeedback can reference one Category (if "one area" selected)
- Task belongs to one Category
- Task belongs to one DailyPlan
- Task may reference one PoolItem (optional; for last_used_at / cooldown)
- Task has many CompletionHistory entries
- JournalEntry is standalone (linked via date)
- PatternInsight is standalone (derived from feedback and completion data)

---

## 6. MCP Server Design

### 6.1 Tools (Actions LLM can perform)

#### `get_journal_entries`
- **Purpose**: Retrieve journal entries for analysis
- **Parameters**: 
  - `start_date`: Date
  - `end_date`: Date
  - `limit`: Integer (optional)
- **Returns**: Array of journal entries with content and metadata

#### `get_recent_mental_state`
- **Purpose**: Get summarized mental state from recent entries
- **Parameters**:
  - `days`: Integer (default 7)
- **Returns**: Summary of mental state, patterns, capacity indicators

#### `query_capacity_indicators`
- **Purpose**: Assess current capacity for planning
- **Parameters**:
  - `date`: Date (for which day to assess)
- **Returns**: Capacity score, factors, recommendations

#### `get_task_history`
- **Purpose**: Get historical task completion patterns
- **Parameters**:
  - `category_id`: UUID? (optional filter)
  - `days`: Integer (lookback period)
- **Returns**: Completion rates, patterns, insights

#### `create_daily_plan`
- **Purpose**: Generate and store a daily plan
- **Parameters**:
  - `date`: Date
  - `plan_data`: JSON (tasks, timeline, capacity notes)
- **Returns**: Created plan ID and confirmation

#### `update_task_status`
- **Purpose**: Mark tasks complete or update status
- **Parameters**:
  - `task_id`: UUID
  - `status`: Enum
  - `notes`: String? (optional)
- **Returns**: Updated task

#### `get_recent_feedback`
- **Purpose**: Retrieve recent end-of-day feedback for learning
- **Parameters**:
  - `days`: Integer (lookback period, default 14)
  - `category_id`: UUID? (optional filter)
- **Returns**: Array of feedback with ratings, elaborations, and extracted insights

#### `get_pattern_insights`
- **Purpose**: Get identified patterns from historical data
- **Parameters**:
  - `pattern_type`: Enum? (optional filter)
  - `min_confidence`: Float? (minimum confidence threshold)
- **Returns**: Array of pattern insights (day-of-week, category preferences, etc.)

#### `save_daily_feedback`
- **Purpose**: Store end-of-day feedback
- **Parameters**:
  - `daily_plan_id`: UUID
  - `overall_rating`: Enum
  - `affected_category_id`: UUID? (if "one area")
  - `text_elaboration`: String? (optional)
  - `activity_log`: String? (optional)
- **Returns**: Saved feedback ID and extracted insights

### 6.2 Resources (Data LLM can read)

#### `journal://entries/{date}`
- Specific journal entry by date

#### `plan://daily/{date}`
- Daily plan for a specific date

#### `stats://completion/{category_id}`
- Completion statistics for a category

#### `capacity://indicators/{date}`
- Capacity assessment for a date

#### `feedback://daily/{date}`
- End-of-day feedback for a specific date

#### `patterns://insights/{type}`
- Pattern insights by type

---

## 7. Development Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Get basic infrastructure running

- [ ] Set up project structure
- [ ] Initialize backend API (basic endpoints)
- [ ] Set up database schema
- [ ] Create basic data models
- [ ] Set up MCP server skeleton
- [ ] Install and configure Ollama
- [ ] Test LLM connection

**Deliverable**: Backend running, database initialized, LLM responding

### Phase 2: Core Data Layer (Week 2-3)
**Goal**: Data persistence and retrieval working

- [ ] Implement journal entry CRUD
- [ ] Implement category management
- [ ] Implement daily plan storage
- [ ] Implement task management
- [ ] Set up vector DB for embeddings
- [ ] Create MCP tools for data access
- [ ] Test MCP server with LLM

**Deliverable**: All data operations working, MCP server functional

### Phase 3: LLM Integration (Week 3-4)
**Goal**: LLM can generate plans using MCP tools

- [ ] Implement journal entry analysis
- [ ] Implement capacity assessment
- [ ] Implement planning engine
- [ ] Create prompts for plan generation
- [ ] Test plan generation end-to-end
- [ ] Refine prompts based on output quality

**Deliverable**: LLM generates realistic daily plans

### Phase 4: Frontend Foundation (Week 4-5)
**Goal**: Basic PWA with timeline view

- [ ] Set up frontend project
- [ ] Create timeline component
- [ ] Create category columns
- [ ] Implement task display
- [ ] Set up PWA manifest and service worker
- [ ] Connect frontend to backend API
- [ ] Basic styling and layout

**Deliverable**: Functional PWA displaying plans

### Phase 5: User Interactions (Week 5-6)
**Goal**: Users can interact with tasks and provide feedback

- [ ] Task completion flow
- [ ] Task rescheduling
- [ ] Manual task creation
- [ ] Journal entry input
- [ ] Plan regeneration
- [ ] **End-of-day feedback modal**
  - Quick assessment buttons
  - Category selector for "one area" option
  - Text elaboration input
  - Activity log input
  - Skip option
- [ ] Real-time updates

**Deliverable**: Fully interactive PWA with feedback mechanism

### Phase 6: Polish & Refinement (Week 6+)
**Goal**: Improve UX and reliability

- [ ] Error handling
- [ ] Loading states
- [ ] Offline support
- [ ] Performance optimization
- [ ] **Dark green theme implementation**
- [ ] **Encouragement and fun elements throughout UI**
- [ ] **LLM feedback analysis and insight extraction**
- [ ] **Pattern recognition (basic implementation)**
- [ ] UI/UX improvements
- [ ] Testing and bug fixes
- [ ] Documentation

**Deliverable**: Production-ready v1.0

### Phase 7: Pattern Recognition & Insights (Post-v1)
**Goal**: Evolve feedback into actionable insights

- [ ] Advanced pattern recognition algorithms
- [ ] Pattern insight visualization
- [ ] Feedback history reports
- [ ] "What worked" analysis views
- [ ] Trend visualization over time

**Deliverable**: Intelligent insights from feedback data

---

## 8. Success Criteria

### 8.1 Functional Requirements
- ✅ LLM generates daily plans based on journal entries
- ✅ Plans respect capacity and mental state
- ✅ **Plans are curiosity-led ("I wonder…")—no goal or target-based framing**
- ✅ **Plans adapt based on end-of-day feedback**
- ✅ Invitations to explore (not "tasks to achieve") appear in correct categories and times
- ✅ Users can note what they did / what they tried; any action celebrated
- ✅ **End-of-day feedback mechanism functional**
- ✅ **LLM extracts insights from feedback automatically**
- ✅ Journal entries are analyzed for mental state
- ✅ System learns from patterns and feedback without punishing "failure"
- ✅ PWA works offline

### 8.2 Technical Requirements
- ✅ All data stays local (no cloud dependencies)
- ✅ MCP server enables modular LLM swapping
- ✅ Architecture supports easy component replacement
- ✅ Performance acceptable (< 5s for plan generation)
- ✅ Database queries optimized

### 8.3 User Experience Requirements
- ✅ Timeline view is intuitive and clear
- ✅ Categories are easy to distinguish
- ✅ Tasks are actionable and specific
- ✅ **Dark green theme is soothing and pleasant**
- ✅ **Encouraging, light-hearted tone throughout**
- ✅ **Feedback mechanism is low-friction and optional**
- ✅ System feels responsive
- ✅ PWA installs and works like native app

---

## 9. Open Questions & Future Considerations

### 9.1 Data Sources
- How to integrate calendar data?
- Should we support health tracker APIs?
- Browser history/productivity data integration?
- Financial data for debt category?

### 9.2 LLM Considerations
- Which model size provides best balance?
- How to handle context limits for long journal histories?
- Should we fine-tune a model on personal data?
- Multi-model approach (small for quick queries, large for planning)?

### 9.3 Advanced Features (Post-v1)
- **Advanced pattern recognition and visualization**
- **Feedback history reports and insights**
- **"What worked" / "What I explored" analysis views** (curiosity and reflection—never "goal achievement" tracking)
- Multi-day planning (weekly view)
- **Exploration and curiosity reflection** (what did I try? what did I notice?)—no goal or target-based progress visualization
- Habit formation analysis
- Integration with external services (calendar, health apps)
- Mobile app (native)
- Sharing/collaboration features

### 9.4 Technical Debt
- Authentication/security (if needed)
- Backup/restore functionality
- Migration tools for schema changes
- Performance monitoring
- Logging and debugging tools

---

## 10. Notes & Decisions Log

### Decisions Made
- **Architecture**: Option 1 - MCP as data access layer for LLM
- **Local-first**: All data stays on machine, no cloud
- **Modular design**: Components can be swapped for experimentation
- **Start simple**: Build MVP, iterate based on usage
- **Curiosity, not goals (immutable)**: Personal daily conduct is guided by "I wonder…" and exploration only. No goal structure, no targets, no pass/fail. Any action taken is celebrated. "I wonder, not I will." See §1.4.
- **The Pool**: Primary input layer for the plan—tasks, events, aspirations. Planner selects/adapts from the Pool and can add 0–2 "I wonder…" ideas (some days pool-only). Use last_used_at / cooldown (global default for MVP) so items aren’t over-used. Dates only for events; tasks/aspirations have no date (avoids punitive layer). Pool→task linking and last_used_at update in same transaction as plan creation. Name "Pool" (not backlog) is intentional. See §3.2 and "Pool: design decisions" there.
- **Feedback Mechanism**: End-of-day modal with quick buttons, optional elaboration, separate activity log
- **Feedback Processing**: LLM extracts insights automatically (no forced structure)
- **Pattern Recognition**: Data model supports it, implementation evolves over time
- **Design Theme**: Dark green (soothing), light-hearted and encouraging tone
- **Feedback Influence**: Implicit (no need to show how feedback affected next plan)
- **Data Preservation**: All raw feedback data saved for future analysis/reporting

### Key Insights
- Manual maintenance is the failure point - automation is key
- Capacity awareness prevents burnout and abandonment
- **Goal-based framing in personal life is toxic; curiosity-based framing ("I wonder…") supports sustainable engagement and self-compassion**
- Mental state tracking enables personalized planning
- **Feedback loop is critical for continuous improvement and adaptation**
- **Low-friction feedback mechanism prevents abandonment**
- **Pattern recognition enables the system to learn what works for the user**
- **Encouraging, supportive tone helps maintain engagement**
- Modular architecture enables experimentation without full rewrites

---

## 11. References & Resources

- MCP Protocol: [Model Context Protocol documentation]
- Ollama: [Ollama documentation]
- PWA Best Practices: [Web.dev PWA guide]
- Vector Databases: [ChromaDB, pgvector documentation]

---

**Next Steps**: Review this document, make any adjustments, then begin Phase 1 implementation.

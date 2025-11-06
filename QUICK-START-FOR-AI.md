# Quick Start: Explaining invokej AI Memory System to Claude

Copy and paste this to a new Claude session:

---

## What is invokej?

invokej is a Bun-based task runner (like Python's Invoke) where you define tasks as methods in a `Tasks` class. Tasks automatically become CLI commands with JSDoc documentation.

**But the real innovation is its AI memory plugins.**

## The Problem invokej Solves

**AI assistants have no memory between sessions.** Every time you start a new chat:
- You re-explain the entire project context
- AI suggests things you already tried and failed
- AI doesn't know what patterns work in your codebase
- Previous decisions and their rationale are lost

## The Solution: SQLite + Bash = AI Memory

invokej uses **local SQLite databases** for structured memory that ANY AI can access via **bash commands**.

### Why This Works

```bash
# Instead of parsing markdown files:
grep "authentication" notes.md

# You query structured data:
invj ai:patternSearch "auth"
invj wall:rubble | grep "JWT"  # See what failed before
invj ai:decisionShow 5         # See ALL options considered
```

**Benefits:**
- ✅ **Local & fast** - No network calls, no rate limits
- ✅ **Universal** - Works via bash (any AI can use it)
- ✅ **Queryable** - SQL instead of regex
- ✅ **Structured** - Foreign keys, relationships, importance rankings
- ✅ **Free** - No API costs

Better than markdown (unstructured), MCP (needs integration), or agents (complex/expensive).

## The Four Plugins

### 1. **wall_mgr** - Building Block Memory

Uses metaphor of building a wall:

```
Foundation (architectural decisions)
    ↓
Wall (completed components in layers)
    ↓
Edge (current work in progress)
    ↓
Rubble (failed attempts + lessons) ← THE KILLER FEATURE
    ↓
Current (session focus)
```

**Key Command:**
```bash
invj wall:session  # Shows where you left off + lessons learned
```

The `rubble` table is brilliant - it records:
- What approach was tried
- Why it failed
- Lesson learned

So AI **won't retry failed approaches**.

### 2. **work_mgr** - Knowledge Graph

Tracks project knowledge with relationships:

```sql
project_contexts (
  knowledge_type: assumption | discovery | rule | pattern | constraint | insight
  stage: pre | during | post
  importance: 1-10
)

context_relationships (
  relationship_type: supersedes | contradicts | enhances | validates | depends_on
)
```

**Example:**
```bash
# Query discoveries made during development
SELECT * FROM project_contexts
WHERE knowledge_type='discovery'
ORDER BY importance DESC
```

### 3. **todo_mgr** - Simple Task Tracking

Basic todo system with priorities, due dates, search.

### 4. **ai_work_mgr** - AI Memory System (NEW!)

**The star plugin** - Extends work_mgr with AI-specific features:

**Features:**
- 📅 **Session tracking** - Which AI did what, when, duration
- 📦 **Pattern library** - Reusable solutions with success rates
- 🤔 **Decision trees** - ALL options considered (not just winner)
- 📸 **Context snapshots** - Save points (Git for AI memory)
- 📍 **Code mapping** - Links components to actual files
- 📝 **Prompt templates** - Store successful prompts
- 📊 **Quality metrics** - Component stability tracking

**33+ Commands:**
```bash
# Project Management
invj ai:projectCreate "My App"  # Create project
invj ai:projectList             # List all projects
invj ai:projectShow 1           # Show project details
invj ai:setProject 1            # Set current project

# Sessions
invj ai:sessionStart claude-3.5-sonnet "Fix bug"
invj ai:sessionEnd "Bug fixed"
invj ai:context  # Show everything

# Patterns
invj ai:patternAdd "Error Boundary" "Errors crash app" "Wrap in ErrorBoundary"
invj ai:patternSearch "error"  # Find relevant patterns

# Decisions
invj ai:decisionCreate "Which database?"
invj ai:decisionOption 1 "PostgreSQL" "Mature" "Heavy"
invj ai:decisionOption 1 "SQLite" "Simple" "Limited"
invj ai:decisionChoose 1 2 "Start simple"
invj ai:decisionShow 1  # See full decision tree

# Snapshots
invj ai:snapshotCreate "Before refactor"
invj ai:snapshotList

# Code mapping
invj ai:codeMap "Auth System" src/auth.ts 1 150
invj ai:codeFind "Auth"
```

## Real Example Workflow

```bash
# First time setup
invj ai:projectCreate "My App"
invj ai:setProject 1  # Use the ID returned from create

# Morning - Start fresh session
invj ai:sessionStart claude-3.5-sonnet "Add notifications"

# Load context
invj ai:context
# Shows:
#   📊 Current Work: 3 tasks pending
#   📦 Patterns: 12 available
#   🤔 Recent Decisions: 2
#   📈 Quality: Auth has 0 issues, Payments has 3

# Check for existing patterns
invj ai:patternSearch "websocket"
# Found: "WS Reconnection" - used 5x, 85% success rate

# Check what failed before
invj wall:rubble | grep "notification"
# Lesson: "Don't use polling, too slow"

# Make decision
invj ai:decisionCreate "WebSocket or Server-Sent Events?"
invj ai:decisionOption 1 "WebSocket" "Bidirectional" "More complex"
invj ai:decisionOption 1 "SSE" "Simpler" "One-way only"
invj ai:decisionChoose 1 1 "Need bidirectional for typing indicators"

# Work on it
invj ai:log file_write src/notifications.ts "Implemented WebSocket notifications"
invj ai:codeMap "Notifications" src/notifications.ts 1 200

# Discover new pattern
invj ai:patternAdd "WebSocket Health Check" \
  "Connections silently die" \
  "Send ping every 30s, reconnect if no pong"

# Before deploying
invj ai:snapshotCreate "Pre-deploy notifications" "All tests passing"

# Done
invj ai:sessionEnd "Notifications working, WebSocket with health checks"

# Next day - Full context preserved!
invj ai:sessionStart claude-3.5-sonnet "Add notification preferences"
invj ai:context  # AI sees everything from yesterday
```

## Database Schema (Simplified)

```sql
-- wall_mgr
foundation      -- Core architectural decisions
wall            -- Completed components (layers)
edge            -- Current work
rubble          -- Failed attempts + lessons ⭐
current         -- Session focus

-- work_mgr
projects        -- Project definitions
tasks           -- Task list with dependencies
project_contexts -- Knowledge items
context_relationships -- How knowledge relates

-- ai_work_mgr (extends work_mgr)
ai_sessions     -- Track each AI session
patterns        -- Reusable solution library
decisions       -- Decision trees
decision_options -- All options considered
context_snapshots -- Save points
code_locations  -- Component → file mapping
prompt_templates -- Successful prompts
quality_events  -- Issue tracking
```

## Key Files

```
plugins/
  wall_mgr.js       569 lines  - Building block memory
  work_mgr.js       283 lines  - Knowledge graph
  ai_work_mgr.js  1,036 lines  - AI memory system
  todo_mgr.js       434 lines  - Task management

examples/
  with-ai-work.js              - Complete usage guide

AI-PLUGIN-ANALYSIS.md          - Deep analysis
```

## How to Use

1. **Install:** `bun install -g invokej`

2. **Create tasks.js:**
```javascript
import { AIWorkNamespace } from "invokej/plugins";

export class Tasks {
  constructor() {
    this.ai = new AIWorkNamespace("work.db");
  }
}
```

3. **Use it:**
```bash
invj init "My Project"
invj ai:setProject 1
invj ai:sessionStart claude-3.5-sonnet "Build feature"
invj ai:context  # Load all context
# ... work happens ...
invj ai:sessionEnd "Feature complete"
```

## Why This Matters

**The core insight:** SQLite + bash = universal, local, structured memory for ANY AI assistant.

You're not just tracking tasks. You're building a **knowledge graph** of:
- What works (patterns with success rates)
- What doesn't (rubble with lessons)
- Why decisions were made (full option trees)
- Where code lives (component mapping)
- Project evolution (context snapshots)

All queryable with SQL. All accessible via bash. All local and fast.

This solves the AI memory problem better than markdown files (unstructured), MCP (requires integration), or agent frameworks (complex and expensive).

## Quick Reference

```bash
# Essential commands for AI sessions
invj ai:context              # Load full context
invj ai:patternSearch [q]    # Find relevant patterns
invj wall:session            # Building progress + lessons
invj ai:decisionShow [id]    # Review past decisions
invj ai:codeFind [component] # Locate code

# Track your work
invj ai:log file_write src/file.ts "What you did"
invj ai:patternAdd "name" "problem" "solution"
invj ai:codeMap "Component" src/file.ts 1 100

# Important moments
invj ai:snapshotCreate "Before big change"
invj ai:sessionEnd "What you accomplished"
```

## The Bottom Line

invokej transforms AI collaboration from **stateless frustration** to **stateful productivity** by giving AI assistants a persistent, queryable, local memory system accessible via simple bash commands.

**2,322 lines** of AI memory infrastructure.
**All SQLite.** All local. All fast. All free.

---

**Repo:** https://github.com/blueshed/invokej
**Version:** 0.3.7+ (AI features in latest)

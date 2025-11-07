/**
 * AI Work Manager Example
 *
 * This example demonstrates how to use the AIWorkNamespace plugin for
 * tracking AI assistant sessions, patterns, decisions, and more.
 *
 * The AI Work Manager extends the base WorkAPI with AI-specific features:
 * - Session tracking (which AI did what, when)
 * - Pattern library (reusable solutions)
 * - Decision trees (all options considered, not just winners)
 * - Context snapshots (save points)
 * - Code location mapping (components → files)
 * - Prompt templates (successful prompts)
 * - Quality metrics (component stability)
 *
 * This is designed for AI-human collaboration where the AI needs persistent
 * memory across sessions.
 *
 * SETUP:
 * If using invokej from npm/global install:
 *   import { AIWorkNamespace } from "invokej/plugins";
 *
 * If developing invokej locally:
 *   1. Run `bun link` in the invokej directory
 *   2. Then this import will use your local development version
 */

import { AIWorkNamespace } from "invokej/plugins";

export class Tasks {
  constructor() {
    // Initialize AI work namespace
    // All data stored in work.db (includes base WorkAPI tables + AI extensions)
    this.ai = new AIWorkNamespace("work.db");
  }

  // ==================== Quick Start ====================

  /**
   * Note: You no longer need a custom init method!
   * Use the built-in project management commands:
   *   invj ai:projectCreate <name>    - Create a new project
   *   invj ai:projectList             - List all projects
   *   invj ai:projectShow [id]        - Show project details
   *   invj ai:setProject <id>         - Set current project
   */

  /** Quick workflow demo */
  async demo(c) {
    console.log(`
🚀 AI Work Manager Demo Workflow
=================================

# 1. Set up project
invj ai:projectCreate "My App"              # Creates project, returns ID
invj ai:projectList                          # List all projects
invj ai:setProject 1                         # Set project 1 as current

# 2. Start AI session
invj ai:sessionStart claude-3.5-sonnet "Implement user auth"

# 3. Record a pattern you discover
invj ai:patternAdd "Error Boundary" \\
  "Unhandled errors crash app" \\
  "Wrap components in ErrorBoundary" \\
  "error-handling"

# 4. Make a decision
invj ai:decisionCreate "Which auth method?" "Need secure user login"
invj ai:decisionOption 1 "Basic Auth" "Simple" "Not secure"
invj ai:decisionOption 1 "JWT" "Secure, stateless" "More complex"
invj ai:decisionChoose 1 2 "Security is priority"

# 5. Map code to components
invj ai:codeMap "User Auth" "src/auth/jwt.ts" 1 150

# 6. Take a snapshot before risky change
invj ai:snapshotCreate "Before auth refactor" "JWT implementation complete"

# 7. View current context
invj ai:context

# 8. End session
invj ai:sessionEnd "Successfully implemented JWT auth"

# 9. View session history
invj ai:sessionHistory
`);
  }
}

/*
 * Complete Command Reference
 * ==========================
 *
 * Project Management:
 *   invj ai:projectCreate <name>               # Create a new project
 *   invj ai:projectList                        # List all projects
 *   invj ai:projectShow [id]                   # Show project details (current if no ID)
 *   invj ai:setProject <id>                    # Set current project context
 *
 * Sessions:
 *   invj ai:sessionStart [model] [goal]        # Start AI session
 *   invj ai:sessionEnd [outcome]               # End current session
 *   invj ai:sessionStatus                      # Show current session info
 *   invj ai:sessionHistory [limit]             # View past sessions
 *   invj ai:log <type> <target> [details]      # Log an action
 *
 * Patterns:
 *   invj ai:patternAdd <name> <problem> <solution> [category]
 *   invj ai:patternSearch [query] [category]   # Find patterns
 *   invj ai:patternShow <id>                   # View pattern details
 *
 * Decisions:
 *   invj ai:decisionCreate <question> [context]
 *   invj ai:decisionOption <id> <name> [pros] [cons] [effort]
 *   invj ai:decisionChoose <decisionId> <optionId> [rationale]
 *   invj ai:decisionShow <id>                  # View decision tree
 *
 * Snapshots:
 *   invj ai:snapshotCreate <name> [description]
 *   invj ai:snapshotList                       # List all snapshots
 *
 * Code Mapping:
 *   invj ai:codeMap <component> <filePath> [startLine] [endLine]
 *   invj ai:codeFind [component]               # Find mapped code
 *
 * Context:
 *   invj ai:context                            # Show full AI context
 *
 * Example AI Session Workflow
 * ============================
 *
 * # Morning - Start new session
 * invj ai:setProject 1
 * invj ai:sessionStart claude-3.5-sonnet "Fix authentication bug"
 * invj ai:context  # Shows: patterns, decisions, work items
 *
 * # Check for existing patterns
 * invj ai:patternSearch "auth"
 * # Found: "JWT Token Refresh" pattern used 5 times with 90% success
 *
 * # Make a decision about approach
 * invj ai:decisionCreate "How to fix token expiry?" "Users getting logged out"
 * invj ai:decisionOption 1 "Increase expiry time" "Quick fix" "Band-aid solution"
 * invj ai:decisionOption 1 "Implement refresh tokens" "Proper solution" "More work"
 * invj ai:decisionOption 1 "Sliding window" "Good UX" "Complex edge cases"
 * invj ai:decisionChoose 1 2 "Proper solution is worth the effort"
 *
 * # Record work
 * invj ai:log file_write "src/auth/refresh.ts" "Implemented refresh token logic"
 * invj ai:codeMap "Token Refresh" "src/auth/refresh.ts" 45 120
 *
 * # Discovered a new pattern
 * invj ai:patternAdd "Refresh Token Rotation" \\
 *   "Old refresh tokens should be invalidated" \\
 *   "Generate new refresh token on each use and invalidate old" \\
 *   "security"
 *
 * # Take snapshot before deploying
 * invj ai:snapshotCreate "Pre-deployment auth fix" "All tests passing"
 *
 * # End session
 * invj ai:sessionEnd "Fixed auth, added refresh tokens, deployed"
 *
 * # Next day - AI can resume with full context
 * invj ai:sessionStart claude-3.5-sonnet "Continue with user profile"
 * invj ai:context  # Shows yesterday's work, patterns learned, decisions made
 *
 * Benefits for AI Assistants
 * ===========================
 *
 * 1. **Session Continuity**
 *    - AI sees what was done previously
 *    - No need to re-explain context
 *
 * 2. **Pattern Learning**
 *    - AI finds project-specific solutions
 *    - Tracks what works (success rate)
 *    - Avoids anti-patterns
 *
 * 3. **Decision History**
 *    - AI sees ALL options that were considered
 *    - Understands why certain approaches were chosen
 *    - Won't suggest already-rejected options
 *
 * 4. **Code Navigation**
 *    - AI knows where components live
 *    - Can quickly find relevant files
 *    - Tracks component dependencies
 *
 * 5. **Quality Awareness**
 *    - AI sees which areas have issues
 *    - Can be more careful with brittle components
 *    - Suggests refactoring high-risk areas
 *
 * 6. **Snapshots as Save Points**
 *    - Before major refactors, save full context
 *    - If things go wrong, restore previous state
 *    - Git for your AI's memory
 */

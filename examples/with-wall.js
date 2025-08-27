/**
 * Wall Plugin Example - Project Context Management
 *
 * This example shows how to use the Wall plugin to track your project's
 * development context, decisions, and progress.
 *
 * Place this as 'tasks.js' in your project root.
 *
 * Usage:
 *   invokej wall:session      # Start a development session
 *   invokej wall:focus "Working on user authentication"
 *   invokej wall:add "Database schema" "PostgreSQL tables created"
 *   invokej wall:show         # View your progress wall
 */

import { WallNamespace } from "invokej/plugins";

export class Tasks {
  constructor() {
    // Initialize the wall namespace for project context
    this.wall = new WallNamespace();
  }

  // ========== Regular Tasks ==========

  /** Run tests */
  async test(c) {
    await c.run("npm test", { echo: true });

    // Track completion in the wall
    await this.wall.add(c, "Tests", "All tests passing");
  }

  /** Build project */
  async build(c, env = "development") {
    await c.run(`NODE_ENV=${env} npm run build`, { echo: true });

    // Track build in the wall
    await this.wall.add(c, "Build", `Built for ${env}`);
  }

  /** Deploy application */
  async deploy(c, target = "staging") {
    // Set what we're doing
    await this.wall.edge(c, "Deployment", "building");

    // Run deployment
    await c.run(`npm run deploy:${target}`, { echo: true });

    // Move from edge to wall (completed)
    await this.wall.add(c, "Deployment", `Deployed to ${target}`);
    await this.wall.clear_edge(c);
  }
}

/*
 * Wall Commands Available:
 *
 * Project Session:
 *   invokej wall:session              # Start dev session with context
 *
 * Track Progress:
 *   invokej wall:focus "What you're working on" "Last action" "Next action"
 *   invokej wall:edge "Component" "status"  # What you're building now
 *   invokej wall:add "Component" "Description"  # Mark as complete
 *
 * Architectural Decisions:
 *   invokej wall:decide "Use PostgreSQL" "Better JSON support"
 *   invokej wall:foundation           # Show all decisions
 *
 * Learn from Failures:
 *   invokej wall:fail "WebSockets" "Memory leak" "Why" "Lesson learned"
 *   invokej wall:rubble               # Show failures and lessons
 *
 * Visualization:
 *   invokej wall:show                 # ASCII wall visualization
 *   invokej wall:stats                # Project statistics
 *
 * Example Workflow:
 *   1. invokej wall:session           # See where you left off
 *   2. invokej wall:focus "Adding user auth"
 *   3. invokej wall:edge "JWT implementation" "building"
 *   4. invokej test                   # Run tests (auto-tracks)
 *   5. invokej wall:add "JWT auth" "Implemented with refresh tokens"
 *   6. invokej wall:show              # See your progress!
 */

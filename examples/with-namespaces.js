/**
 * Advanced Namespaces Example
 *
 * This example demonstrates how to organize complex projects using namespaces.
 * Namespaces help group related functionality and avoid naming conflicts.
 *
 * Place this as 'tasks.js' in your project root.
 *
 * Usage:
 *   invokej test              # Root-level task
 *   invokej wall:session      # Namespaced task
 *   invokej db:migrate        # Database namespace
 *   invokej git:feature auth  # Git namespace
 */

import { WallNamespace } from "invokej/plugins";

export class Tasks {
  constructor() {
    // Initialize namespaces
    this.wall = new WallNamespace();
    this.db = new DatabaseNamespace();
    this.git = new GitNamespace();
  }

  // ========== Root-Level Tasks ==========

  /** Run tests */
  async test(c, type = "all") {
    console.log(`Running ${type} tests...`);
    await c.run("npm test", { echo: true });
  }

  /** Build project */
  async build(c, env = "production") {
    console.log(`Building for ${env}...`);
    await c.run(`NODE_ENV=${env} npm run build`, { echo: true });
  }

  /** Start development server */
  async dev(c, port = "3000") {
    console.log(`Starting dev server on port ${port}...`);
    await c.run(`PORT=${port} npm run dev`, { echo: true });
  }

  /** Clean everything */
  async clean(c) {
    await c.run("rm -rf dist coverage node_modules/.cache", { echo: true });
    console.log("✅ Clean complete!");
  }
}

// ========== Database Namespace ==========

class DatabaseNamespace {
  /** Run migrations */
  async migrate(c, direction = "up") {
    console.log(`Running migrations ${direction}...`);
    await c.run(`npm run db:migrate:${direction}`, { echo: true });
  }

  /** Seed database */
  async seed(c, env = "development") {
    console.log(`Seeding database for ${env}...`);
    await c.run(`NODE_ENV=${env} npm run db:seed`, { echo: true });
  }

  /** Reset database */
  async reset(c) {
    console.log("⚠️  Resetting database...");
    await c.run("npm run db:reset", { echo: true });
    await this.migrate(c);
    await this.seed(c);
    console.log("✅ Database reset complete");
  }

  /** Create backup */
  async backup(c, name = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = name || `backup-${timestamp}`;
    console.log(`Creating backup: ${filename}...`);
    await c.run(`mkdir -p backups && cp database.db backups/${filename}.db`, { echo: true });
    console.log(`✅ Backup saved: backups/${filename}.db`);
  }
}

// ========== Git Namespace ==========

class GitNamespace {
  /** Create feature branch */
  async feature(c, name) {
    if (!name) {
      console.log('Usage: invokej git:feature <name>');
      return;
    }
    await c.run(`git checkout -b feature/${name}`, { echo: true });
  }

  /** Create release */
  async release(c, version) {
    if (!version) {
      console.log('Usage: invokej git:release <version>');
      return;
    }
    console.log(`Creating release ${version}...`);
    await c.run(`git tag -a v${version} -m "Release v${version}"`, { echo: true });
    await c.run(`git push origin v${version}`, { echo: true });
  }

  /** Clean merged branches */
  async cleanup(c) {
    console.log("Cleaning merged branches...");
    await c.run(
      "git branch --merged | grep -v '\\*\\|main\\|master' | xargs -n 1 git branch -d",
      { echo: true, warn: true }
    );
  }

  /** Show status */
  async status(c) {
    await c.run("git status -sb", { echo: true });
  }
}

/*
 * Complete Command Reference:
 *
 * Root Tasks:
 *   invokej test              # Run all tests
 *   invokej test unit         # Run unit tests only
 *   invokej build             # Build for production
 *   invokej build staging     # Build for staging
 *   invokej dev               # Start dev server on port 3000
 *   invokej dev 4000          # Start dev server on port 4000
 *   invokej clean             # Clean build artifacts
 *
 * Wall Namespace (Project Context):
 *   invokej wall:session      # Start development session
 *   invokej wall:focus "Working on feature X"
 *   invokej wall:add "Component" "Description"
 *   invokej wall:show         # Show the wall
 *   invokej wall:decide "Architecture decision" "Rationale"
 *   invokej wall:fail "What failed" "How" "Why" "Lesson"
 *
 * Database Namespace:
 *   invokej db:migrate        # Run migrations up
 *   invokej db:migrate down   # Run migrations down
 *   invokej db:seed           # Seed development database
 *   invokej db:seed production  # Seed production database
 *   invokej db:reset          # Reset and reseed database
 *   invokej db:backup         # Create timestamped backup
 *   invokej db:backup mybackup  # Create named backup
 *
 * Git Namespace:
 *   invokej git:feature user-auth  # Create feature/user-auth branch
 *   invokej git:release 1.2.0      # Create and push v1.2.0 tag
 *   invokej git:cleanup             # Delete merged branches
 *   invokej git:status              # Show git status
 *
 * Example Development Flow:
 *   1. invokej wall:session         # Check where you left off
 *   2. invokej git:feature new-api  # Start new feature
 *   3. invokej wall:focus "Building API endpoints"
 *   4. invokej dev                  # Start development
 *   5. invokej test                 # Run tests
 *   6. invokej wall:add "API" "REST endpoints complete"
 *   7. invokej git:release 2.0.0   # Release new version
 */

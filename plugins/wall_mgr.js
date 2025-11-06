import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * ContextWall - Core database and state management for project context
 *
 * Uses the metaphor of building a wall:
 * - Foundation: Core architectural decisions
 * - Wall: Completed components (bricks in layers)
 * - Edge: What's currently being built
 * - Rubble: Failed attempts and lessons learned
 * - Current: Session continuity and focus
 */
export class ContextWall {
  constructor(dbPath = null) {
    this.dbPath = dbPath || this.getDefaultPath();
    this.db = null;
  }

  getDefaultPath() {
    // Try project-local first
    if (!existsSync(".invokej")) {
      mkdirSync(".invokej", { recursive: true });
    }
    return ".invokej/context.db";
  }

  initialize() {
    if (!this.db) {
      this.db = new Database(this.dbPath);
      this.ensureSchema();
    }
    return this;
  }

  ensureSchema() {
    // Foundation - core decisions that everything builds on
    this.db.run(`
      CREATE TABLE IF NOT EXISTS foundation (
        id INTEGER PRIMARY KEY,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        constraints TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Wall - completed components/features with their relationships
    this.db.run(`
      CREATE TABLE IF NOT EXISTS wall (
        id INTEGER PRIMARY KEY,
        layer INTEGER NOT NULL,
        position INTEGER NOT NULL,
        component TEXT NOT NULL,
        description TEXT,
        depends_on TEXT, -- JSON array of other brick IDs
        rationale TEXT,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(layer, position)
      )
    `);

    // Edge - what we're actively building
    this.db.run(`
      CREATE TABLE IF NOT EXISTS edge (
        id INTEGER PRIMARY KEY,
        component TEXT NOT NULL,
        status TEXT CHECK(status IN ('planning', 'building', 'testing', 'blocked')),
        current_approach TEXT,
        blockers TEXT,
        next_steps TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rubble - failed attempts and lessons learned
    this.db.run(`
      CREATE TABLE IF NOT EXISTS rubble (
        id INTEGER PRIMARY KEY,
        component TEXT NOT NULL,
        approach_tried TEXT NOT NULL,
        why_failed TEXT NOT NULL,
        lesson_learned TEXT,
        tried_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Current context - single row table for quick session continuity
    this.db.run(`
      CREATE TABLE IF NOT EXISTS current (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        focus TEXT,
        last_action TEXT,
        next_action TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // ========== Foundation Methods ==========

  addFoundation(decision, rationale, constraints = null) {
    const stmt = this.db.prepare(
      "INSERT INTO foundation (decision, rationale, constraints) VALUES (?, ?, ?)",
    );
    return stmt.run(decision, rationale, constraints);
  }

  getFoundation() {
    return this.db
      .prepare("SELECT * FROM foundation ORDER BY created_at")
      .all();
  }

  // ========== Wall Methods ==========

  addToWall(
    component,
    description,
    layer,
    position,
    dependsOn = null,
    rationale = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO wall (layer, position, component, description, depends_on, rationale)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      layer,
      position,
      component,
      description,
      dependsOn,
      rationale,
    );
  }

  getWall() {
    return this.db
      .prepare("SELECT * FROM wall ORDER BY layer DESC, position")
      .all();
  }

  getNextLayer() {
    const result = this.db
      .prepare("SELECT MAX(layer) as max_layer FROM wall")
      .get();
    return (result?.max_layer || 0) + 1;
  }

  getNextPosition(layer) {
    const result = this.db
      .prepare("SELECT MAX(position) as max_pos FROM wall WHERE layer = ?")
      .get(layer);
    return (result?.max_pos || 0) + 1;
  }

  // ========== Edge Methods ==========

  setEdge(
    component,
    status = null,
    approach = null,
    blockers = null,
    nextSteps = null,
  ) {
    this.db.run("DELETE FROM edge"); // Only one active edge
    const stmt = this.db.prepare(`
      INSERT INTO edge (component, status, current_approach, blockers, next_steps)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(component, status, approach, blockers, nextSteps);
  }

  getEdge() {
    return this.db.prepare("SELECT * FROM edge").get() || undefined;
  }

  // ========== Rubble Methods ==========

  addRubble(component, approach, whyFailed, lesson) {
    const stmt = this.db.prepare(`
      INSERT INTO rubble (component, approach_tried, why_failed, lesson_learned)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(component, approach, whyFailed, lesson);
  }

  getRubble(limit = 5) {
    return this.db
      .prepare("SELECT * FROM rubble ORDER BY id DESC LIMIT ?")
      .all(limit);
  }

  // ========== Current Focus Methods ==========

  setFocus(focus, lastAction = null, nextAction = null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO current (id, focus, last_action, next_action, updated_at)
      VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(focus, lastAction, nextAction);
  }

  getCurrentFocus() {
    return (
      this.db.prepare("SELECT * FROM current WHERE id = 1").get() || undefined
    );
  }

  // ========== Utility Methods ==========

  getSessionContext() {
    return {
      current: this.getCurrentFocus(),
      edge: this.getEdge(),
      recentRubble: this.getRubble(3),
      wallHeight: this.db.prepare("SELECT COUNT(*) as count FROM wall").get()
        .count,
      foundationCount: this.db
        .prepare("SELECT COUNT(*) as count FROM foundation")
        .get().count,
    };
  }
}

/**
 * WallNamespace - CLI commands for wall management
 * This class provides the namespace for invokej tasks
 */
export class WallNamespace {
  constructor(contextWall = null) {
    this.wall = (contextWall || new ContextWall()).initialize();
  }

  /** Start a development session showing current context */
  async session(c) {
    const context = this.wall.getSessionContext();

    console.log("\n🚀 DEVELOPMENT SESSION");
    console.log("=".repeat(50) + "\n");

    if (context.current) {
      console.log(`📍 Focus: ${context.current.focus}`);
      if (context.current.last_action)
        console.log(`✅ Last: ${context.current.last_action}`);
      if (context.current.next_action)
        console.log(`➡️  Next: ${context.current.next_action}`);
    } else {
      console.log(
        "📍 No focus set. Use: invokej wall:focus 'what you're working on'",
      );
    }

    if (context.edge) {
      console.log(`\n🔨 Building: ${context.edge.component}`);
      if (context.edge.status) console.log(`   Status: ${context.edge.status}`);
      if (context.edge.current_approach)
        console.log(`   Approach: ${context.edge.current_approach}`);
      if (context.edge.blockers)
        console.log(`   ⚠️  Blockers: ${context.edge.blockers}`);
      if (context.edge.next_steps)
        console.log(`   Next: ${context.edge.next_steps}`);
    }

    if (context.recentRubble.length > 0) {
      console.log("\n📚 Recent Lessons:");
      context.recentRubble.forEach((r) => {
        console.log(`   • ${r.lesson_learned}`);
      });
    }

    console.log(
      `\n📊 Progress: ${context.wallHeight} components built on ${context.foundationCount} decisions`,
    );
  }

  /** Show the wall visualization */
  async show(c, format = "ascii") {
    const wall = this.wall.getWall();

    if (format === "ascii") {
      this._renderAsciiWall(wall);
    } else if (format === "json") {
      console.log(JSON.stringify(wall, null, 2));
    } else {
      // Default text format
      console.log("\n🧱 THE WALL\n");
      if (wall.length === 0) {
        console.log("No components built yet. Use: invokej wall:add");
        return;
      }

      const layers = {};
      wall.forEach((brick) => {
        if (!layers[brick.layer]) layers[brick.layer] = [];
        layers[brick.layer].push(brick);
      });

      Object.entries(layers)
        .sort((a, b) => b[0] - a[0])
        .forEach(([layer, bricks]) => {
          console.log(`\nLayer ${layer}:`);
          bricks.forEach((brick) => {
            console.log(
              `  • ${brick.component} - ${brick.description || "No description"}`,
            );
          });
        });
    }
  }

  /** Add completed work to the wall */
  async add(c, component, description = "", layer = null) {
    if (!component) {
      console.log('Usage: invokej wall:add "component" "description" [layer]');
      return;
    }

    // Auto-determine layer if not specified
    if (layer === null) {
      layer = this.wall.getNextLayer();
    } else {
      layer = parseInt(layer);
    }

    const position = this.wall.getNextPosition(layer);
    this.wall.addToWall(component, description, layer, position);
    console.log(
      `✅ Added to wall: ${component} (Layer ${layer}, Position ${position})`,
    );
  }

  /** Set current development focus */
  async focus(c, what = null, last = null, next = null) {
    if (!what) {
      const current = this.wall.getCurrentFocus();
      if (current) {
        console.log(`\n📍 Current Focus: ${current.focus}`);
        if (current.last_action)
          console.log(`✅ Last Action: ${current.last_action}`);
        if (current.next_action)
          console.log(`➡️  Next Action: ${current.next_action}`);
      } else {
        console.log(
          "No focus set. Use: invokej wall:focus 'what you're working on'",
        );
      }
      return;
    }

    this.wall.setFocus(what, last, next);
    console.log(`📍 Focus updated: ${what}`);
  }

  /** Set what we're currently building */
  async edge(
    c,
    component = null,
    status = null,
    approach = null,
    blockers = null,
    nextSteps = null,
  ) {
    if (!component) {
      const edge = this.wall.getEdge();
      if (edge) {
        console.log(`\n🔨 Building: ${edge.component}`);
        if (edge.status) console.log(`Status: ${edge.status}`);
        if (edge.current_approach)
          console.log(`Approach: ${edge.current_approach}`);
        if (edge.blockers) console.log(`Blockers: ${edge.blockers}`);
        if (edge.next_steps) console.log(`Next Steps: ${edge.next_steps}`);
      } else {
        console.log(
          "No active edge. Use: invokej wall:edge 'component' [status]",
        );
      }
      return;
    }

    this.wall.setEdge(component, status, approach, blockers, nextSteps);
    console.log(`🔨 Now building: ${component}${status ? ` (${status})` : ""}`);
  }

  /** Record a failed attempt and lesson */
  async fail(c, component, approach, why, lesson) {
    if (!component || !approach || !why || !lesson) {
      console.log(
        'Usage: invokej wall:fail "component" "approach" "why it failed" "lesson learned"',
      );
      return;
    }

    this.wall.addRubble(component, approach, why, lesson);
    console.log(`💥 Failure recorded\n📚 Lesson learned: ${lesson}`);
  }

  /** Add architectural decision to foundation */
  async decide(c, decision, rationale, constraints = null) {
    if (!decision || !rationale) {
      console.log(
        'Usage: invokej wall:decide "decision" "rationale" ["constraints"]',
      );
      return;
    }

    this.wall.addFoundation(decision, rationale, constraints);
    console.log(`🏛️  Foundation decision added: ${decision}`);
  }

  /** Show foundation decisions */
  async foundation(c, format = "text") {
    const foundation = this.wall.getFoundation();

    if (format === "json") {
      console.log(JSON.stringify(foundation, null, 2));
      return;
    }

    console.log("\n🏛️  ARCHITECTURAL FOUNDATION");
    console.log("=".repeat(50));

    if (foundation.length === 0) {
      console.log("\nNo foundation decisions yet. Use: invokej wall:decide");
      return;
    }

    foundation.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.decision}`);
      console.log(`   Rationale: ${f.rationale}`);
      if (f.constraints) console.log(`   Constraints: ${f.constraints}`);
      console.log(`   Date: ${f.created_at}`);
    });
  }

  /** Show failures and lessons learned */
  async rubble(c, limit = 10, format = "text") {
    const rubble = this.wall.getRubble(parseInt(limit));

    if (format === "json") {
      console.log(JSON.stringify(rubble, null, 2));
      return;
    }

    console.log("\n💥 RUBBLE (Failures & Lessons)");
    console.log("=".repeat(50));

    if (rubble.length === 0) {
      console.log(
        "\nNo failures recorded yet. That's either very good or very suspicious!",
      );
      return;
    }

    rubble.forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.component}`);
      console.log(`   Approach: ${r.approach_tried}`);
      console.log(`   Why Failed: ${r.why_failed}`);
      console.log(`   📚 Lesson: ${r.lesson_learned}`);
      console.log(`   Date: ${r.tried_at}`);
    });
  }

  /** Clear the current edge */
  async clear_edge(c) {
    this.wall.db.run("DELETE FROM edge");
    console.log("✅ Cleared current edge");
  }

  /** Show statistics about the wall */
  async stats(c) {
    const stats = {
      wall: this.wall.db.prepare("SELECT COUNT(*) as count FROM wall").get()
        .count,
      foundation: this.wall.db
        .prepare("SELECT COUNT(*) as count FROM foundation")
        .get().count,
      rubble: this.wall.db.prepare("SELECT COUNT(*) as count FROM rubble").get()
        .count,
      layers:
        this.wall.db.prepare("SELECT MAX(layer) as max FROM wall").get().max ||
        0,
    };

    console.log("\n📊 PROJECT STATISTICS");
    console.log("=".repeat(50));
    console.log(`🧱 Components Built: ${stats.wall}`);
    console.log(`🏛️  Foundation Decisions: ${stats.foundation}`);
    console.log(`💥 Failures Recorded: ${stats.rubble}`);
    console.log(`📏 Wall Height: ${stats.layers} layers`);

    if (stats.rubble > 0 && stats.wall > 0) {
      const ratio = ((stats.wall / (stats.wall + stats.rubble)) * 100).toFixed(
        1,
      );
      console.log(`✅ Success Rate: ${ratio}%`);
    }
  }

  /** Private: Render ASCII wall visualization */
  _renderAsciiWall(wallData) {
    if (wallData.length === 0) {
      console.log("\n🧱 No bricks in the wall yet!\n");
      return;
    }

    console.log("\n🧱 THE WALL");

    // Get current edge to show what's being built
    const edge = this.wall.getEdge();

    // Group wall by layer
    const layers = {};
    wallData.forEach((brick) => {
      if (!layers[brick.layer]) layers[brick.layer] = [];
      layers[brick.layer].push(brick);
    });

    const maxLayer = Math.max(...Object.keys(layers).map(Number));

    // Build wall from top layer down (newest on top)
    for (let layer = maxLayer; layer >= 1; layer--) {
      const layerBricks = layers[layer] || [];
      const offset = layer % 2 === 0 ? "   " : "";

      let brickLine = offset;
      layerBricks.forEach((brick) => {
        brickLine += "████████ ";
      });

      let labelLine = offset;
      layerBricks.forEach((brick) => {
        let name = brick.component;
        if (name.length > 8) name = name.substring(0, 7) + "…";
        labelLine += name.padEnd(8) + " ";
      });

      console.log(brickLine);
      console.log(labelLine);
    }

    // Foundation bedrock
    console.log("▓".repeat(70));

    // Edge indicator
    if (edge) {
      console.log(`\n🔨 Currently Building: ${edge.component}`);
    }

    // Stats
    const foundationCount = this.wall.db
      .prepare("SELECT COUNT(*) as count FROM foundation")
      .get().count;
    console.log(
      `\n📊 ${wallData.length} components built on ${foundationCount} architectural decisions`,
    );
  }
}

/**
 * Convenience function to create a WallNamespace with optional custom database
 */
export function createWallNamespace(dbPath = null) {
  const contextWall = new ContextWall(dbPath);
  return new WallNamespace(contextWall);
}

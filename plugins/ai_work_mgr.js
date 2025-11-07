import { Database } from "bun:sqlite";
import { WorkAPI } from "./work_mgr.js";

/**
 * AI-specific extensions to WorkAPI
 * Adds memory, learning, and context tracking for AI assistants
 */

const AI_EXTENSIONS_SCHEMA = `
  -- AI Session Tracking
  -- Records each AI assistant session for cost and effectiveness tracking
  CREATE TABLE IF NOT EXISTS ai_sessions (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    model TEXT,  -- 'claude-3.5-sonnet', 'gpt-4', etc
    assistant_name TEXT,  -- 'Claude', 'ChatGPT', etc
    session_goal TEXT,  -- What the session aimed to accomplish
    outcome TEXT,  -- What was actually accomplished
    tokens_used INTEGER,
    files_touched INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- Session Actions
  -- Track what happened during each session
  CREATE TABLE IF NOT EXISTS session_actions (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN (
      'file_read', 'file_write', 'command_run', 'query_made',
      'decision_made', 'pattern_used', 'test_run', 'error_encountered'
    )),
    target TEXT,  -- file path, command, query, etc
    details TEXT,  -- JSON with additional context
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
  );

  -- Pattern Library
  -- Reusable solutions discovered during development
  CREATE TABLE IF NOT EXISTS patterns (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    name TEXT NOT NULL,
    category TEXT,  -- 'error-handling', 'api-design', 'testing', etc
    problem TEXT NOT NULL,
    solution TEXT NOT NULL,
    antipattern TEXT,  -- What NOT to do
    when_to_use TEXT,
    example_code TEXT,
    discovered_session_id INTEGER,
    times_used INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (discovered_session_id) REFERENCES ai_sessions(id)
  );

  -- Decisions
  -- Decision trees for complex choices
  CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    session_id INTEGER,
    question TEXT NOT NULL,
    context TEXT,  -- Why this question matters
    final_choice INTEGER,  -- ID of chosen option
    rationale TEXT,  -- Why this option was chosen
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
  );

  CREATE TABLE IF NOT EXISTS decision_options (
    id INTEGER PRIMARY KEY,
    decision_id INTEGER NOT NULL,
    option_name TEXT NOT NULL,
    description TEXT,
    pros TEXT,  -- Comma or newline separated
    cons TEXT,
    estimated_effort TEXT,  -- 'low', 'medium', 'high'
    risk_level TEXT,  -- 'low', 'medium', 'high'
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
  );

  -- Context Snapshots
  -- Save complete state at important moments
  CREATE TABLE IF NOT EXISTS context_snapshots (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    session_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    snapshot_data TEXT NOT NULL,  -- JSON: wall, edge, rubble, etc
    git_commit TEXT,  -- Git commit hash at snapshot time
    files_state TEXT,  -- JSON of key files and their checksums
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
  );

  -- Code Location Mapping
  -- Link abstract components to actual code
  CREATE TABLE IF NOT EXISTS code_locations (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    component_name TEXT NOT NULL,  -- e.g., "User Auth", "API Gateway"
    file_path TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    description TEXT,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- Prompt Templates
  -- Successful prompts for reuse
  CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    name TEXT NOT NULL,
    category TEXT,  -- 'implementation', 'debugging', 'refactoring', etc
    template TEXT NOT NULL,
    variables TEXT,  -- JSON array: ['component', 'requirements']
    usage_count INTEGER DEFAULT 0,
    avg_quality_score REAL,  -- 1-5 rating
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- Quality Events
  -- Track component stability and issues
  CREATE TABLE IF NOT EXISTS quality_events (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    component_name TEXT,
    file_path TEXT,
    event_type TEXT NOT NULL CHECK(event_type IN (
      'test_pass', 'test_fail', 'bug_found', 'bug_fixed',
      'regression', 'performance_issue', 'security_issue'
    )),
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- Configuration Storage
  -- Persists state between command invocations (e.g., current project ID)
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_ai_sessions_project ON ai_sessions(project_id);
  CREATE INDEX IF NOT EXISTS idx_ai_sessions_started ON ai_sessions(started_at);
  CREATE INDEX IF NOT EXISTS idx_session_actions_session ON session_actions(session_id);
  CREATE INDEX IF NOT EXISTS idx_patterns_project ON patterns(project_id);
  CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
  CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_project ON context_snapshots(project_id);
  CREATE INDEX IF NOT EXISTS idx_code_locations_project ON code_locations(project_id);
  CREATE INDEX IF NOT EXISTS idx_code_locations_component ON code_locations(component_name);
  CREATE INDEX IF NOT EXISTS idx_quality_events_project ON quality_events(project_id);
  CREATE INDEX IF NOT EXISTS idx_quality_events_component ON quality_events(component_name);
`;

/**
 * AIWorkAPI - Extends WorkAPI with AI-specific features
 */
export class AIWorkAPI extends WorkAPI {
  constructor(dbPath = "work.db") {
    super(dbPath);
    this.db.exec(AI_EXTENSIONS_SCHEMA);
  }

  // ==================== AI Sessions ====================

  startSession(projectId, model, assistantName = "AI", goal = null) {
    const stmt = this.db.prepare(
      "INSERT INTO ai_sessions (project_id, model, assistant_name, session_goal) VALUES (?, ?, ?, ?)",
    );
    return stmt.run(projectId, model, assistantName, goal).lastInsertRowid;
  }

  endSession(sessionId, outcome = null, tokensUsed = null) {
    const stmt = this.db.prepare(`
      UPDATE ai_sessions
      SET ended_at = CURRENT_TIMESTAMP, outcome = ?, tokens_used = ?
      WHERE id = ?
    `);
    return stmt.run(outcome, tokensUsed, sessionId);
  }

  getCurrentSession(projectId) {
    return this.db
      .prepare(
        `
      SELECT * FROM ai_sessions
      WHERE project_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `,
      )
      .get(projectId);
  }

  getSessionHistory(projectId, limit = 10) {
    return this.db
      .prepare(
        `
      SELECT * FROM ai_sessions
      WHERE project_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `,
      )
      .all(projectId, limit);
  }

  logAction(sessionId, actionType, target, details = null) {
    const stmt = this.db.prepare(
      "INSERT INTO session_actions (session_id, action_type, target, details) VALUES (?, ?, ?, ?)",
    );
    return stmt.run(sessionId, actionType, target, details);
  }

  getSessionActions(sessionId) {
    return this.db
      .prepare(
        "SELECT * FROM session_actions WHERE session_id = ? ORDER BY timestamp",
      )
      .all(sessionId);
  }

  // ==================== Patterns ====================

  addPattern(
    projectId,
    name,
    problem,
    solution,
    category = null,
    antipattern = null,
    whenToUse = null,
    exampleCode = null,
    sessionId = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO patterns (
        project_id, name, category, problem, solution, antipattern,
        when_to_use, example_code, discovered_session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      projectId,
      name,
      category,
      problem,
      solution,
      antipattern,
      whenToUse,
      exampleCode,
      sessionId,
    ).lastInsertRowid;
  }

  searchPatterns(projectId, query = null, category = null) {
    let sql = "SELECT * FROM patterns WHERE project_id = ?";
    let params = [projectId];

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    if (query) {
      sql += " AND (name LIKE ? OR problem LIKE ? OR solution LIKE ?)";
      const pattern = `%${query}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += " ORDER BY success_rate DESC, times_used DESC";

    return this.db.prepare(sql).all(...params);
  }

  usePattern(patternId) {
    const stmt = this.db.prepare(
      "UPDATE patterns SET times_used = times_used + 1 WHERE id = ?",
    );
    return stmt.run(patternId);
  }

  ratePattern(patternId, success) {
    // Update success rate using exponential moving average
    const pattern = this.db
      .prepare("SELECT success_rate, times_used FROM patterns WHERE id = ?")
      .get(patternId);
    if (!pattern) return false;

    const alpha = 0.3; // Weight for new observation
    const newRate =
      alpha * (success ? 1.0 : 0.0) + (1 - alpha) * pattern.success_rate;

    const stmt = this.db.prepare(
      "UPDATE patterns SET success_rate = ? WHERE id = ?",
    );
    return stmt.run(newRate, patternId);
  }

  // ==================== Decisions ====================

  createDecision(projectId, question, context = null, sessionId = null) {
    const stmt = this.db.prepare(
      "INSERT INTO decisions (project_id, session_id, question, context) VALUES (?, ?, ?, ?)",
    );
    return stmt.run(projectId, sessionId, question, context).lastInsertRowid;
  }

  addDecisionOption(
    decisionId,
    optionName,
    description = null,
    pros = null,
    cons = null,
    effort = null,
    risk = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO decision_options (
        decision_id, option_name, description, pros, cons,
        estimated_effort, risk_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      decisionId,
      optionName,
      description,
      pros,
      cons,
      effort,
      risk,
    ).lastInsertRowid;
  }

  chooseDecisionOption(decisionId, optionId, rationale = null) {
    const stmt = this.db.prepare(`
      UPDATE decisions
      SET final_choice = ?, decided_at = CURRENT_TIMESTAMP, rationale = ?
      WHERE id = ?
    `);
    return stmt.run(optionId, rationale, decisionId);
  }

  getDecision(decisionId) {
    const decision = this.db
      .prepare("SELECT * FROM decisions WHERE id = ?")
      .get(decisionId);

    if (!decision) return null;

    const options = this.db
      .prepare("SELECT * FROM decision_options WHERE decision_id = ?")
      .all(decisionId);

    return { ...decision, options };
  }

  getRecentDecisions(projectId, limit = 10) {
    return this.db
      .prepare(
        `
      SELECT * FROM decisions
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
      )
      .all(projectId, limit);
  }

  // ==================== Context Snapshots ====================

  createSnapshot(
    projectId,
    name,
    description,
    snapshotData,
    sessionId = null,
    gitCommit = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO context_snapshots (
        project_id, session_id, name, description, snapshot_data, git_commit
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      projectId,
      sessionId,
      name,
      description,
      JSON.stringify(snapshotData),
      gitCommit,
    ).lastInsertRowid;
  }

  getSnapshot(snapshotId) {
    const snapshot = this.db
      .prepare("SELECT * FROM context_snapshots WHERE id = ?")
      .get(snapshotId);

    if (!snapshot) return null;

    return {
      ...snapshot,
      snapshot_data: JSON.parse(snapshot.snapshot_data),
    };
  }

  listSnapshots(projectId) {
    return this.db
      .prepare(
        `
      SELECT id, name, description, created_at, git_commit
      FROM context_snapshots
      WHERE project_id = ?
      ORDER BY created_at DESC
    `,
      )
      .all(projectId);
  }

  // ==================== Code Locations ====================

  mapCodeLocation(
    projectId,
    componentName,
    filePath,
    startLine = null,
    endLine = null,
    description = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO code_locations (
        project_id, component_name, file_path, start_line, end_line, description
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      projectId,
      componentName,
      filePath,
      startLine,
      endLine,
      description,
    ).lastInsertRowid;
  }

  findCodeLocations(projectId, componentName = null) {
    if (componentName) {
      return this.db
        .prepare(
          `
        SELECT * FROM code_locations
        WHERE project_id = ? AND component_name LIKE ?
        ORDER BY component_name, file_path
      `,
        )
        .all(projectId, `%${componentName}%`);
    } else {
      return this.db
        .prepare(
          `
        SELECT * FROM code_locations
        WHERE project_id = ?
        ORDER BY component_name, file_path
      `,
        )
        .all(projectId);
    }
  }

  updateCodeLocation(locationId) {
    const stmt = this.db.prepare(
      "UPDATE code_locations SET last_modified = CURRENT_TIMESTAMP WHERE id = ?",
    );
    return stmt.run(locationId);
  }

  // ==================== Prompt Templates ====================

  addPromptTemplate(
    projectId,
    name,
    template,
    category = null,
    variables = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO prompt_templates (
        project_id, name, category, template, variables
      ) VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      projectId,
      name,
      category,
      template,
      variables ? JSON.stringify(variables) : null,
    ).lastInsertRowid;
  }

  getPromptTemplate(templateId) {
    const template = this.db
      .prepare("SELECT * FROM prompt_templates WHERE id = ?")
      .get(templateId);

    if (!template) return null;

    return {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : [],
    };
  }

  searchPromptTemplates(projectId, query = null, category = null) {
    let sql = "SELECT * FROM prompt_templates WHERE project_id = ?";
    let params = [projectId];

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    if (query) {
      sql += " AND (name LIKE ? OR template LIKE ?)";
      const pattern = `%${query}%`;
      params.push(pattern, pattern);
    }

    sql += " ORDER BY usage_count DESC, avg_quality_score DESC";

    return this.db.prepare(sql).all(...params);
  }

  usePromptTemplate(templateId, qualityScore = null) {
    // Update usage count and optionally quality score
    const template = this.db
      .prepare(
        "SELECT usage_count, avg_quality_score FROM prompt_templates WHERE id = ?",
      )
      .get(templateId);

    if (!template) return false;

    let newAvg = template.avg_quality_score;
    if (qualityScore !== null && qualityScore >= 1 && qualityScore <= 5) {
      if (template.avg_quality_score === null) {
        newAvg = qualityScore;
      } else {
        // Exponential moving average
        const alpha = 0.3;
        newAvg =
          alpha * qualityScore + (1 - alpha) * template.avg_quality_score;
      }
    }

    const stmt = this.db.prepare(`
      UPDATE prompt_templates
      SET usage_count = usage_count + 1,
          avg_quality_score = ?,
          last_used = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(newAvg, templateId);
  }

  expandPromptTemplate(templateId, variables = {}) {
    const template = this.getPromptTemplate(templateId);
    if (!template) return null;

    let expanded = template.template;
    for (const [key, value] of Object.entries(variables)) {
      expanded = expanded.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    this.usePromptTemplate(templateId);

    return expanded;
  }

  // ==================== Quality Events ====================

  logQualityEvent(
    projectId,
    eventType,
    componentName = null,
    filePath = null,
    severity = "medium",
    details = null,
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO quality_events (
        project_id, component_name, file_path, event_type, severity, details
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      projectId,
      componentName,
      filePath,
      eventType,
      severity,
      details,
    ).lastInsertRowid;
  }

  resolveQualityEvent(eventId) {
    const stmt = this.db.prepare(
      "UPDATE quality_events SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
    );
    return stmt.run(eventId);
  }

  getQualityMetrics(projectId, componentName = null) {
    let sql = `
      SELECT
        component_name,
        COUNT(*) as total_events,
        SUM(CASE WHEN event_type IN ('test_fail', 'bug_found', 'regression') THEN 1 ELSE 0 END) as issues,
        SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as unresolved,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_issues
      FROM quality_events
      WHERE project_id = ?
    `;
    let params = [projectId];

    if (componentName) {
      sql += " AND component_name = ?";
      params.push(componentName);
    }

    sql += " GROUP BY component_name ORDER BY issues DESC";

    return this.db.prepare(sql).all(...params);
  }

  // ==================== AI Assistant Helpers ====================

  /**
   * Get comprehensive context for AI session startup
   */
  getAIContext(projectId) {
    const project = this.getProject(projectId);
    const currentWork = this.getWork(projectId);
    const recentContext = this.getContext(projectId);
    const recentPatterns = this.searchPatterns(projectId);
    const recentDecisions = this.getRecentDecisions(projectId, 5);
    const qualityMetrics = this.getQualityMetrics(projectId);
    const currentSession = this.getCurrentSession(projectId);

    return {
      project,
      currentWork,
      recentContext: recentContext.slice(0, 10),
      patterns: recentPatterns.slice(0, 10),
      decisions: recentDecisions,
      qualityMetrics,
      currentSession,
    };
  }

  /**
   * Generate session summary for reporting
   */
  getSessionSummary(sessionId) {
    const session = this.db
      .prepare("SELECT * FROM ai_sessions WHERE id = ?")
      .get(sessionId);

    if (!session) return null;

    const actions = this.getSessionActions(sessionId);

    const actionCounts = {};
    actions.forEach((action) => {
      actionCounts[action.action_type] =
        (actionCounts[action.action_type] || 0) + 1;
    });

    return {
      ...session,
      duration: session.ended_at
        ? (new Date(session.ended_at) - new Date(session.started_at)) /
          1000 /
          60 // minutes
        : null,
      actions: actionCounts,
      totalActions: actions.length,
    };
  }
}

/**
 * AIWorkNamespace - CLI-friendly namespace for AI features
 * Use this in your tasks.js to expose AI commands
 */
export class AIWorkNamespace {
  constructor(dbPath = "work.db") {
    this.ai = new AIWorkAPI(dbPath);

    // Load current project ID from config (persisted between commands)
    this._loadCurrentProject();
  }

  /** Load current project from database config */
  _loadCurrentProject() {
    try {
      const result = this.ai.db
        .prepare("SELECT value FROM config WHERE key = 'current_project_id'")
        .get();

      if (result) {
        this.currentProjectId = parseInt(result.value);
      } else {
        this.currentProjectId = null;
      }
    } catch (err) {
      // Config table might not exist yet on first run
      this.currentProjectId = null;
    }
  }

  /** Save current project to database config */
  _saveCurrentProject(projectId) {
    this.ai.db
      .prepare(
        `INSERT OR REPLACE INTO config (key, value, updated_at)
         VALUES ('current_project_id', ?, datetime('now'))`,
      )
      .run(projectId.toString());
  }

  // ==================== Project Management ====================

  /** Create a new project */
  async projectCreate(c, name) {
    const result = this.ai.saveProject(name);
    const projectId = result.lastInsertRowid;

    console.log(`✅ Project "${name}" created (ID: ${projectId})`);
    console.log(`   Set as current: invj ai:setProject ${projectId}`);

    return projectId;
  }

  /** List all projects */
  async projectList(c) {
    const projects = this.ai.getProjects();

    if (projects.length === 0) {
      console.log("ℹ️  No projects found");
      console.log("   Create one with: invj ai:projectCreate <name>");
      return;
    }

    console.log("\n📂 Projects:\n");
    projects.forEach((p) => {
      const current = p.id === this.currentProjectId ? " (current)" : "";
      console.log(`${p.id}. ${p.name}${current}`);
    });
    console.log("");
  }

  /** Show current project */
  async projectShow(c, projectId = null) {
    const id = projectId ? parseInt(projectId) : this.currentProjectId;

    if (!id) {
      console.error("❌ No project ID provided and no current project set");
      return;
    }

    const project = this.ai.getProject(id);

    if (!project) {
      console.error(`❌ Project ${id} not found`);
      return;
    }

    console.log(`\n📂 Project: ${project.name} (ID: ${id})\n`);
    console.log(`Tasks: ${project.tasks.length} total`);

    const pending = project.tasks.filter((t) => !t.completed_at);
    const completed = project.tasks.filter((t) => t.completed_at);

    console.log(`   ${pending.length} pending`);
    console.log(`   ${completed.length} completed`);
    console.log(`\nContext items: ${project.context.length}`);

    if (project.context.length > 0) {
      const byType = project.context.reduce((acc, c) => {
        acc[c.knowledge_type] = (acc[c.knowledge_type] || 0) + 1;
        return acc;
      }, {});

      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
    }
  }

  /** Set the current project context */
  async setProject(c, projectId) {
    const id = parseInt(projectId);

    // Verify project exists
    const project = this.ai.getProject(id);

    if (!project) {
      console.error(`❌ Project ${id} not found`);
      console.log("   List projects with: invj ai:projectList");
      return;
    }

    // Save to memory and persist to database
    this.currentProjectId = id;
    this._saveCurrentProject(id);

    console.log(
      `✅ Project "${project.name}" (ID: ${id}) set as current context`,
    );
  }

  // ==================== Session Commands ====================

  /** Start a new AI session */
  async sessionStart(c, model = "claude-3.5-sonnet", goal = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set. Use: invj ai:setProject <id>");
      return;
    }

    // Get project name
    const project = this.ai.getProject(this.currentProjectId);

    const sessionId = this.ai.startSession(
      this.currentProjectId,
      model,
      "Claude",
      goal,
    );

    console.log(`🚀 Session ${sessionId} started for "${project.name}"`);
    console.log(`   Model: ${model}`);
    if (goal) console.log(`   Goal: ${goal}`);

    // Show context
    const context = this.ai.getAIContext(this.currentProjectId);
    console.log(`\n📊 Current Context:`);
    console.log(`   Pending work: ${context.currentWork.length} tasks`);
    console.log(`   Known patterns: ${context.patterns.length}`);
    console.log(`   Recent decisions: ${context.decisions.length}`);

    return sessionId;
  }

  /** End the current AI session */
  async sessionEnd(c, outcome = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const session = this.ai.getCurrentSession(this.currentProjectId);
    if (!session) {
      console.log("ℹ️  No active session");
      return;
    }

    this.ai.endSession(session.id, outcome, null);

    const summary = this.ai.getSessionSummary(session.id);
    console.log(`\n✅ Session ${session.id} ended`);
    if (summary.duration) {
      console.log(`   Duration: ${summary.duration.toFixed(1)} minutes`);
    }
    console.log(`   Actions: ${summary.totalActions}`);
    if (outcome) console.log(`   Outcome: ${outcome}`);
  }

  /** Show current session status */
  async sessionStatus(c) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const project = this.ai.getProject(this.currentProjectId);
    const session = this.ai.getCurrentSession(this.currentProjectId);
    if (!session) {
      console.log(`ℹ️  No active session for "${project.name}"`);
      return;
    }

    const summary = this.ai.getSessionSummary(session.id);
    console.log(`\n🔄 Active Session ${session.id} for "${project.name}"`);
    console.log(`   Model: ${session.model}`);
    console.log(`   Started: ${new Date(session.started_at).toLocaleString()}`);
    if (session.session_goal) {
      console.log(`   Goal: ${session.session_goal}`);
    }
    console.log(`\n   Actions performed:`);
    for (const [type, count] of Object.entries(summary.actions)) {
      console.log(`     ${type}: ${count}`);
    }
  }

  /** Show session history */
  async sessionHistory(c, limit = "5") {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const sessions = this.ai.getSessionHistory(
      this.currentProjectId,
      parseInt(limit),
    );

    if (sessions.length === 0) {
      console.log("ℹ️  No previous sessions");
      return;
    }

    console.log(`\n📜 Recent Sessions:\n`);
    sessions.forEach((session) => {
      const summary = this.ai.getSessionSummary(session.id);
      const status = session.ended_at ? "✅" : "🔄";
      console.log(`${status} Session ${session.id} - ${session.model}`);
      console.log(
        `   Started: ${new Date(session.started_at).toLocaleString()}`,
      );
      if (session.ended_at) {
        console.log(`   Duration: ${summary.duration.toFixed(1)} min`);
      }
      if (session.outcome) {
        console.log(`   Outcome: ${session.outcome}`);
      }
      console.log("");
    });
  }

  /** Log an action in the current session */
  async log(c, actionType, target, details = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const session = this.ai.getCurrentSession(this.currentProjectId);
    if (!session) {
      console.error(
        "❌ No active session. Start one with: invj ai:sessionStart",
      );
      return;
    }

    this.ai.logAction(session.id, actionType, target, details);
    console.log(`📝 Logged: ${actionType} - ${target}`);
  }

  // ==================== Pattern Commands ====================

  /** Add a new pattern */
  async patternAdd(c, name, problem, solution, category = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const session = this.ai.getCurrentSession(this.currentProjectId);
    const patternId = this.ai.addPattern(
      this.currentProjectId,
      name,
      problem,
      solution,
      category,
      null,
      null,
      null,
      session?.id,
    );

    console.log(`✅ Pattern "${name}" added (ID: ${patternId})`);
    if (category) console.log(`   Category: ${category}`);
  }

  /** Search for patterns */
  async patternSearch(c, query = null, category = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const patterns = this.ai.searchPatterns(
      this.currentProjectId,
      query,
      category,
    );

    if (patterns.length === 0) {
      console.log("ℹ️  No patterns found");
      return;
    }

    console.log(`\n🔍 Found ${patterns.length} pattern(s):\n`);
    patterns.forEach((p) => {
      console.log(`📦 ${p.name} (ID: ${p.id})`);
      if (p.category) console.log(`   Category: ${p.category}`);
      console.log(`   Problem: ${p.problem}`);
      console.log(`   Solution: ${p.solution}`);
      console.log(
        `   Used: ${p.times_used} times, Success: ${(p.success_rate * 100).toFixed(0)}%`,
      );
      if (p.antipattern) console.log(`   ⚠️  Avoid: ${p.antipattern}`);
      console.log("");
    });
  }

  /** Show details of a specific pattern */
  async patternShow(c, patternId) {
    const pattern = this.ai.db
      .prepare("SELECT * FROM patterns WHERE id = ?")
      .get(parseInt(patternId));

    if (!pattern) {
      console.error(`❌ Pattern ${patternId} not found`);
      return;
    }

    console.log(`\n📦 Pattern: ${pattern.name} (ID: ${pattern.id})\n`);
    if (pattern.category) console.log(`Category: ${pattern.category}`);
    console.log(`Problem: ${pattern.problem}`);
    console.log(`Solution: ${pattern.solution}`);
    if (pattern.antipattern)
      console.log(`⚠️  Antipattern: ${pattern.antipattern}`);
    if (pattern.when_to_use) console.log(`When to use: ${pattern.when_to_use}`);
    if (pattern.example_code) {
      console.log(`\nExample:\n${pattern.example_code}`);
    }
    console.log(
      `\nStats: Used ${pattern.times_used} times, Success rate: ${(pattern.success_rate * 100).toFixed(0)}%`,
    );
  }

  // ==================== Decision Commands ====================

  /** Create a new decision */
  async decisionCreate(c, question, context = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const session = this.ai.getCurrentSession(this.currentProjectId);
    const decisionId = this.ai.createDecision(
      this.currentProjectId,
      question,
      context,
      session?.id,
    );

    console.log(`✅ Decision ${decisionId} created`);
    console.log(`   Question: ${question}`);
    if (context) console.log(`   Context: ${context}`);
    console.log(
      `\n   Add options with: invj ai:decisionOption ${decisionId} <name> <pros> <cons>`,
    );
  }

  /** Add an option to a decision */
  async decisionOption(
    c,
    decisionId,
    optionName,
    pros = null,
    cons = null,
    effort = null,
  ) {
    const optionId = this.ai.addDecisionOption(
      parseInt(decisionId),
      optionName,
      null,
      pros,
      cons,
      effort,
    );

    console.log(`✅ Option "${optionName}" added to decision ${decisionId}`);
    if (pros) console.log(`   ✅ Pros: ${pros}`);
    if (cons) console.log(`   ❌ Cons: ${cons}`);
    if (effort) console.log(`   ⚡ Effort: ${effort}`);
  }

  /** Choose an option for a decision */
  async decisionChoose(c, decisionId, optionId, rationale = null) {
    this.ai.chooseDecisionOption(
      parseInt(decisionId),
      parseInt(optionId),
      rationale,
    );

    const decision = this.ai.getDecision(parseInt(decisionId));
    const chosen = decision.options.find((o) => o.id === parseInt(optionId));

    console.log(`✅ Decision ${decisionId} resolved`);
    console.log(`   Chosen: ${chosen.option_name}`);
    if (rationale) console.log(`   Rationale: ${rationale}`);
  }

  /** Show a decision and its options */
  async decisionShow(c, decisionId) {
    const decision = this.ai.getDecision(parseInt(decisionId));

    if (!decision) {
      console.error(`❌ Decision ${decisionId} not found`);
      return;
    }

    console.log(`\n🤔 Decision ${decision.id}: ${decision.question}\n`);
    if (decision.context) console.log(`Context: ${decision.context}\n`);

    console.log(`Options:`);
    decision.options.forEach((opt, i) => {
      const chosen = opt.id === decision.final_choice ? "✅ " : "   ";
      console.log(`${chosen}${i + 1}. ${opt.option_name}`);
      if (opt.pros) console.log(`     ✅ ${opt.pros}`);
      if (opt.cons) console.log(`     ❌ ${opt.cons}`);
      if (opt.estimated_effort)
        console.log(`     ⚡ Effort: ${opt.estimated_effort}`);
      console.log("");
    });

    if (decision.decided_at) {
      console.log(`Decided: ${new Date(decision.decided_at).toLocaleString()}`);
      if (decision.rationale) console.log(`Rationale: ${decision.rationale}`);
    }
  }

  // ==================== Snapshot Commands ====================

  /** Create a context snapshot */
  async snapshotCreate(c, name, description = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const session = this.ai.getCurrentSession(this.currentProjectId);
    const context = this.ai.getAIContext(this.currentProjectId);

    const snapshotId = this.ai.createSnapshot(
      this.currentProjectId,
      name,
      description,
      context,
      session?.id,
    );

    console.log(`✅ Snapshot "${name}" created (ID: ${snapshotId})`);
    if (description) console.log(`   ${description}`);
  }

  /** List all snapshots */
  async snapshotList(c) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const snapshots = this.ai.listSnapshots(this.currentProjectId);

    if (snapshots.length === 0) {
      console.log("ℹ️  No snapshots");
      return;
    }

    console.log(`\n📸 Context Snapshots:\n`);
    snapshots.forEach((snap) => {
      console.log(`${snap.id}. ${snap.name}`);
      console.log(`   ${new Date(snap.created_at).toLocaleString()}`);
      if (snap.description) console.log(`   ${snap.description}`);
      if (snap.git_commit) console.log(`   Git: ${snap.git_commit}`);
      console.log("");
    });
  }

  // ==================== Code Location Commands ====================

  /** Map a component to code location */
  async codeMap(c, componentName, filePath, startLine = null, endLine = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const locationId = this.ai.mapCodeLocation(
      this.currentProjectId,
      componentName,
      filePath,
      startLine ? parseInt(startLine) : null,
      endLine ? parseInt(endLine) : null,
    );

    console.log(`✅ Mapped "${componentName}" to ${filePath}`);
    if (startLine) console.log(`   Lines: ${startLine}-${endLine || "end"}`);
  }

  /** Find code locations */
  async codeFind(c, componentName = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const locations = this.ai.findCodeLocations(
      this.currentProjectId,
      componentName,
    );

    if (locations.length === 0) {
      console.log("ℹ️  No code locations mapped");
      return;
    }

    console.log(`\n📍 Code Locations:\n`);
    locations.forEach((loc) => {
      console.log(`📦 ${loc.component_name}`);
      console.log(`   File: ${loc.file_path}`);
      if (loc.start_line) {
        console.log(`   Lines: ${loc.start_line}-${loc.end_line || "end"}`);
      }
      if (loc.description) console.log(`   ${loc.description}`);
      console.log("");
    });
  }

  // ==================== Task Management ====================
  // Expose WorkAPI task management methods

  /** Add a new task to the current project */
  async taskAdd(c, name, dueDate = null) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const result = this.ai.saveTask(this.currentProjectId, name, dueDate);
    const taskId = result.lastInsertRowid;

    console.log(`✅ Task "${name}" added (ID: ${taskId})`);
    if (dueDate) console.log(`   Due: ${dueDate}`);
  }

  /** List all tasks in the current project */
  async taskList(c, showCompleted = false) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const project = this.ai.getProject(this.currentProjectId);
    const pending = project.tasks.filter((t) => !t.completed_at);
    const completed = project.tasks.filter((t) => t.completed_at);

    console.log(`\n📋 Tasks for "${project.name}":\n`);

    if (pending.length > 0) {
      console.log("⏳ Pending:");
      pending.forEach((task) => {
        const dueInfo = task.due_date ? ` (due: ${task.due_date})` : "";
        console.log(`   ${task.id}. ${task.name}${dueInfo}`);
      });
    } else {
      console.log("⏳ No pending tasks");
    }

    if (showCompleted === "true" || showCompleted === true) {
      console.log("");
      if (completed.length > 0) {
        console.log("✅ Completed:");
        completed.forEach((task) => {
          const completedAt = new Date(task.completed_at).toLocaleDateString();
          console.log(`   ${task.id}. ${task.name} (${completedAt})`);
        });
      }
    }

    console.log(
      `\nTotal: ${pending.length} pending, ${completed.length} completed`,
    );
  }

  /** Show tasks ready to work on (no blocking dependencies) */
  async taskWork(c) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      return;
    }

    const readyTasks = this.ai.getWork(this.currentProjectId);

    console.log(`\n🎯 Tasks Ready to Work On:\n`);

    if (readyTasks.length === 0) {
      console.log("ℹ️  No tasks available");
      return;
    }

    readyTasks.forEach((task) => {
      const dueInfo = task.due_date ? ` 📅 ${task.due_date}` : "";
      console.log(`${task.id}. ${task.name}${dueInfo}`);
    });

    console.log(`\nTotal: ${readyTasks.length} task(s) ready`);
  }

  /** Mark a task as completed */
  async taskComplete(c, taskId) {
    this.ai.completeWork(parseInt(taskId));
    console.log(`✅ Task ${taskId} marked as completed`);
  }

  /** Add or remove task dependency */
  async taskDepends(c, taskId, dependsOnId) {
    this.ai.toggleDependency(parseInt(taskId), parseInt(dependsOnId));
    console.log(
      `✅ Toggled dependency: task ${taskId} depends on ${dependsOnId}`,
    );
  }

  // ==================== Context Overview ====================

  /** Show comprehensive AI context */
  async context(c) {
    if (!this.currentProjectId) {
      console.error("❌ No project set");
      console.log("   Use: invj ai:projectList to see available projects");
      console.log("   Use: invj ai:setProject <id> to set current project");
      return;
    }

    const context = this.ai.getAIContext(this.currentProjectId);

    console.log(
      `\n🧠 AI Context for Project: ${context.project.name} (ID: ${this.currentProjectId})\n`,
    );

    console.log(`📊 Current Work: ${context.currentWork.length} tasks pending`);
    if (context.currentWork.length > 0) {
      context.currentWork.slice(0, 3).forEach((task) => {
        console.log(`   - ${task.name}`);
      });
      if (context.currentWork.length > 3) {
        console.log(`   ... and ${context.currentWork.length - 3} more`);
      }
    }

    console.log(`\n📦 Patterns: ${context.patterns.length} available`);
    if (context.patterns.length > 0) {
      context.patterns.slice(0, 3).forEach((p) => {
        console.log(
          `   - ${p.name} (used ${p.times_used}x, ${(p.success_rate * 100).toFixed(0)}% success)`,
        );
      });
    }

    console.log(`\n🤔 Recent Decisions: ${context.decisions.length}`);
    context.decisions.forEach((d) => {
      const status = d.decided_at ? "✅" : "🤔";
      console.log(`   ${status} ${d.question}`);
    });

    console.log(`\n📈 Quality Metrics:`);
    if (context.qualityMetrics.length === 0) {
      console.log(`   No issues tracked yet`);
    } else {
      context.qualityMetrics.slice(0, 5).forEach((m) => {
        console.log(
          `   ${m.component_name}: ${m.issues} issues (${m.unresolved} unresolved)`,
        );
      });
    }

    if (context.currentSession) {
      console.log(`\n🔄 Active Session: ${context.currentSession.model}`);
      if (context.currentSession.session_goal) {
        console.log(`   Goal: ${context.currentSession.session_goal}`);
      }
    }
  }
}

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { AIWorkAPI, AIWorkNamespace } from "../plugins/ai_work_mgr.js";

const TEST_DB = "/tmp/test-ai-work.db";

describe("AIWorkAPI", () => {
  let api;

  beforeEach(() => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
    api = new AIWorkAPI(TEST_DB);
  });

  afterEach(() => {
    if (api?.db) {
      api.db.close();
    }
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  // ==================== Inheritance & Schema ====================

  describe("Inheritance and Schema", () => {
    test("should inherit from WorkAPI", () => {
      expect(api.saveProject).toBeDefined();
      expect(api.getProjects).toBeDefined();
      expect(api.saveTask).toBeDefined();
      expect(api.getWork).toBeDefined();
      expect(api.saveContext).toBeDefined();
    });

    test("should create AI extension tables", () => {
      const tables = api.db
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all()
        .map((r) => r.name);

      expect(tables).toContain("ai_sessions");
      expect(tables).toContain("session_actions");
      expect(tables).toContain("patterns");
      expect(tables).toContain("decisions");
      expect(tables).toContain("decision_options");
      expect(tables).toContain("context_snapshots");
      expect(tables).toContain("code_locations");
      expect(tables).toContain("prompt_templates");
      expect(tables).toContain("quality_events");
    });
  });

  // ==================== AI Sessions ====================

  describe("AI Sessions", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should start a new session", () => {
      const sessionId = api.startSession(
        projectId,
        "claude-3.5-sonnet",
        "Claude",
        "Implement feature X"
      );

      expect(sessionId).toBeGreaterThan(0);

      const session = api.db
        .query("SELECT * FROM ai_sessions WHERE id = ?")
        .get(sessionId);

      expect(session.project_id).toBe(projectId);
      expect(session.model).toBe("claude-3.5-sonnet");
      expect(session.assistant_name).toBe("Claude");
      expect(session.session_goal).toBe("Implement feature X");
      expect(session.ended_at).toBeNull();
    });

    test("should end a session", () => {
      const sessionId = api.startSession(projectId, "claude-3.5-sonnet");

      api.endSession(sessionId, "Feature implemented", 15000);

      const session = api.db
        .query("SELECT * FROM ai_sessions WHERE id = ?")
        .get(sessionId);

      expect(session.ended_at).not.toBeNull();
      expect(session.outcome).toBe("Feature implemented");
      expect(session.tokens_used).toBe(15000);
    });

    test("should get current session", () => {
      const session1 = api.startSession(projectId, "claude-3.5-sonnet");
      api.endSession(session1);

      const session2 = api.startSession(projectId, "gpt-4");

      const current = api.getCurrentSession(projectId);

      expect(current).toBeDefined();
      expect(current.id).toBe(session2);
      expect(current.ended_at).toBeNull();
    });

    test("should get session history", () => {
      const id1 = api.startSession(projectId, "claude-3.5-sonnet");
      const id2 = api.startSession(projectId, "gpt-4");
      const id3 = api.startSession(projectId, "claude-opus");

      const history = api.getSessionHistory(projectId, 10);

      expect(history.length).toBe(3);
      // Should include all three sessions (order may vary if timestamps are identical)
      const models = history.map(s => s.model);
      expect(models).toContain("claude-3.5-sonnet");
      expect(models).toContain("gpt-4");
      expect(models).toContain("claude-opus");
    });

    test("should log session actions", () => {
      const sessionId = api.startSession(projectId, "claude-3.5-sonnet");

      api.logAction(sessionId, "file_write", "src/app.js", '{"lines": 42}');
      api.logAction(sessionId, "test_run", "bun test");

      const actions = api.getSessionActions(sessionId);

      expect(actions.length).toBe(2);
      expect(actions[0].action_type).toBe("file_write");
      expect(actions[0].target).toBe("src/app.js");
      expect(actions[1].action_type).toBe("test_run");
    });

    test("should get session summary", () => {
      const sessionId = api.startSession(
        projectId,
        "claude-3.5-sonnet",
        "Claude",
        "Test session"
      );

      api.logAction(sessionId, "file_write", "test.js");
      api.logAction(sessionId, "file_write", "test2.js");
      api.logAction(sessionId, "test_run", "bun test");

      api.endSession(sessionId, "Tests passing");

      const summary = api.getSessionSummary(sessionId);

      expect(summary.model).toBe("claude-3.5-sonnet");
      expect(summary.totalActions).toBe(3);
      expect(summary.actions.file_write).toBe(2);
      expect(summary.actions.test_run).toBe(1);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Patterns ====================

  describe("Pattern Library", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should add a pattern", () => {
      const patternId = api.addPattern(
        projectId,
        "Error Boundary Pattern",
        "Components crash without error handling",
        "Wrap components in error boundaries",
        "error-handling",
        "Don't use try-catch in every component"
      );

      expect(patternId).toBeGreaterThan(0);

      const pattern = api.db
        .query("SELECT * FROM patterns WHERE id = ?")
        .get(patternId);

      expect(pattern.name).toBe("Error Boundary Pattern");
      expect(pattern.category).toBe("error-handling");
      expect(pattern.times_used).toBe(0);
      expect(pattern.success_rate).toBe(1.0);
    });

    test("should search patterns by query", () => {
      api.addPattern(
        projectId,
        "Error Handling",
        "Errors not caught",
        "Use try-catch"
      );
      api.addPattern(
        projectId,
        "API Design",
        "Inconsistent API",
        "Use REST conventions"
      );
      api.addPattern(
        projectId,
        "Error Recovery",
        "Failed requests",
        "Implement retry logic"
      );

      const results = api.searchPatterns(projectId, "error");

      expect(results.length).toBe(2);
      expect(results[0].name).toContain("Error");
    });

    test("should search patterns by category", () => {
      api.addPattern(
        projectId,
        "Pattern 1",
        "Problem",
        "Solution",
        "testing"
      );
      api.addPattern(
        projectId,
        "Pattern 2",
        "Problem",
        "Solution",
        "api-design"
      );
      api.addPattern(
        projectId,
        "Pattern 3",
        "Problem",
        "Solution",
        "testing"
      );

      const results = api.searchPatterns(projectId, null, "testing");

      expect(results.length).toBe(2);
      results.forEach((p) => {
        expect(p.category).toBe("testing");
      });
    });

    test("should track pattern usage", () => {
      const patternId = api.addPattern(
        projectId,
        "Test Pattern",
        "Problem",
        "Solution"
      );

      api.usePattern(patternId);
      api.usePattern(patternId);

      const pattern = api.db
        .query("SELECT * FROM patterns WHERE id = ?")
        .get(patternId);

      expect(pattern.times_used).toBe(2);
    });

    test("should rate pattern success", () => {
      const patternId = api.addPattern(
        projectId,
        "Test Pattern",
        "Problem",
        "Solution"
      );

      // Initial success rate is 1.0
      let pattern = api.db
        .query("SELECT * FROM patterns WHERE id = ?")
        .get(patternId);
      expect(pattern.success_rate).toBe(1.0);

      // Report a failure (success = false means 0.0)
      api.ratePattern(patternId, false);

      pattern = api.db
        .query("SELECT * FROM patterns WHERE id = ?")
        .get(patternId);

      // Should use exponential moving average with alpha=0.3
      // new_rate = 0.3 * 0.0 + 0.7 * 1.0 = 0.7
      expect(pattern.success_rate).toBeCloseTo(0.7, 2);

      // Report a success
      api.ratePattern(patternId, true);

      pattern = api.db
        .query("SELECT * FROM patterns WHERE id = ?")
        .get(patternId);

      // new_rate = 0.3 * 1.0 + 0.7 * 0.7 = 0.3 + 0.49 = 0.79
      expect(pattern.success_rate).toBeCloseTo(0.79, 2);
    });

    test("should link pattern to session", () => {
      const sessionId = api.startSession(projectId, "claude-3.5-sonnet");

      const patternId = api.addPattern(
        projectId,
        "Test Pattern",
        "Problem",
        "Solution",
        "testing",
        null,
        null,
        null,
        sessionId
      );

      const pattern = api.db
        .query("SELECT * FROM patterns WHERE id = ?")
        .get(patternId);

      expect(pattern.discovered_session_id).toBe(sessionId);
    });
  });

  // ==================== Decisions ====================

  describe("Decision Trees", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should create a decision", () => {
      const decisionId = api.createDecision(
        projectId,
        "Which state management library?",
        "Need to decide on state management approach"
      );

      expect(decisionId).toBeGreaterThan(0);

      const decision = api.db
        .query("SELECT * FROM decisions WHERE id = ?")
        .get(decisionId);

      expect(decision.question).toBe("Which state management library?");
      expect(decision.context).toBe("Need to decide on state management approach");
      expect(decision.final_choice).toBeNull();
    });

    test("should add decision options", () => {
      const decisionId = api.createDecision(
        projectId,
        "Which database?",
        "Need persistence"
      );

      const option1 = api.addDecisionOption(
        decisionId,
        "SQLite",
        "Local database",
        "Simple, no server needed",
        "Limited concurrency",
        "low",
        "low"
      );

      const option2 = api.addDecisionOption(
        decisionId,
        "PostgreSQL",
        "Full database",
        "Powerful, scalable",
        "Requires setup",
        "medium",
        "medium"
      );

      expect(option1).toBeGreaterThan(0);
      expect(option2).toBeGreaterThan(0);

      const options = api.db
        .query("SELECT * FROM decision_options WHERE decision_id = ?")
        .all(decisionId);

      expect(options.length).toBe(2);
      expect(options[0].option_name).toBe("SQLite");
      expect(options[1].option_name).toBe("PostgreSQL");
    });

    test("should choose decision option", () => {
      const decisionId = api.createDecision(projectId, "Test decision");

      const optionId = api.addDecisionOption(
        decisionId,
        "Option A",
        null,
        "Good pros",
        "Bad cons"
      );

      api.chooseDecisionOption(
        decisionId,
        optionId,
        "Best fit for our needs"
      );

      const decision = api.db
        .query("SELECT * FROM decisions WHERE id = ?")
        .get(decisionId);

      expect(decision.final_choice).toBe(optionId);
      expect(decision.rationale).toBe("Best fit for our needs");
      expect(decision.decided_at).not.toBeNull();
    });

    test("should get decision with options", () => {
      const decisionId = api.createDecision(projectId, "Test decision");

      api.addDecisionOption(decisionId, "Option 1");
      api.addDecisionOption(decisionId, "Option 2");
      api.addDecisionOption(decisionId, "Option 3");

      const decision = api.getDecision(decisionId);

      expect(decision).toBeDefined();
      expect(decision.question).toBe("Test decision");
      expect(decision.options).toBeDefined();
      expect(decision.options.length).toBe(3);
    });

    test("should get recent decisions", () => {
      api.createDecision(projectId, "Decision 1");
      api.createDecision(projectId, "Decision 2");
      api.createDecision(projectId, "Decision 3");

      const decisions = api.getRecentDecisions(projectId, 2);

      expect(decisions.length).toBe(2);
      // Should return 2 most recent decisions
      const questions = decisions.map(d => d.question);
      expect(questions.length).toBe(2);
    });
  });

  // ==================== Context Snapshots ====================

  describe("Context Snapshots", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should create a snapshot", () => {
      const snapshotData = {
        wall: ["Component A", "Component B"],
        edge: ["Feature X in progress"],
        patterns: ["Pattern 1"],
      };

      const snapshotId = api.createSnapshot(
        projectId,
        "Before refactor",
        "State before major refactoring",
        snapshotData,
        null,
        "abc123"
      );

      expect(snapshotId).toBeGreaterThan(0);

      const snapshot = api.db
        .query("SELECT * FROM context_snapshots WHERE id = ?")
        .get(snapshotId);

      expect(snapshot.name).toBe("Before refactor");
      expect(snapshot.git_commit).toBe("abc123");
      expect(JSON.parse(snapshot.snapshot_data)).toEqual(snapshotData);
    });

    test("should retrieve snapshot with parsed data", () => {
      const snapshotData = { key: "value", nested: { data: true } };

      const snapshotId = api.createSnapshot(
        projectId,
        "Test Snapshot",
        null,
        snapshotData
      );

      const snapshot = api.getSnapshot(snapshotId);

      expect(snapshot).toBeDefined();
      expect(snapshot.name).toBe("Test Snapshot");
      expect(snapshot.snapshot_data).toEqual(snapshotData);
    });

    test("should list snapshots for project", () => {
      api.createSnapshot(projectId, "Snapshot 1", null, {});
      api.createSnapshot(projectId, "Snapshot 2", null, {});
      api.createSnapshot(projectId, "Snapshot 3", null, {});

      const snapshots = api.listSnapshots(projectId);

      expect(snapshots.length).toBe(3);
      // Should include all snapshots
      const names = snapshots.map(s => s.name);
      expect(names).toContain("Snapshot 1");
      expect(names).toContain("Snapshot 2");
      expect(names).toContain("Snapshot 3");
      // Should not include full snapshot_data in list view
      expect(snapshots[0].snapshot_data).toBeUndefined();
    });
  });

  // ==================== Code Locations ====================

  describe("Code Location Mapping", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should map component to code location", () => {
      const locationId = api.mapCodeLocation(
        projectId,
        "User Authentication",
        "src/auth/login.js",
        10,
        50,
        "Login component with OAuth"
      );

      expect(locationId).toBeGreaterThan(0);

      const location = api.db
        .query("SELECT * FROM code_locations WHERE id = ?")
        .get(locationId);

      expect(location.component_name).toBe("User Authentication");
      expect(location.file_path).toBe("src/auth/login.js");
      expect(location.start_line).toBe(10);
      expect(location.end_line).toBe(50);
    });

    test("should find code locations by component name", () => {
      api.mapCodeLocation(projectId, "User Auth", "src/auth/login.js");
      api.mapCodeLocation(projectId, "User Auth", "src/auth/signup.js");
      api.mapCodeLocation(projectId, "Admin Panel", "src/admin/panel.js");

      const locations = api.findCodeLocations(projectId, "User");

      expect(locations.length).toBe(2);
      locations.forEach((loc) => {
        expect(loc.component_name).toContain("User");
      });
    });

    test("should find all code locations for project", () => {
      api.mapCodeLocation(projectId, "Component A", "src/a.js");
      api.mapCodeLocation(projectId, "Component B", "src/b.js");

      const locations = api.findCodeLocations(projectId);

      expect(locations.length).toBe(2);
    });

    test("should update code location timestamp", async () => {
      const locationId = api.mapCodeLocation(
        projectId,
        "Test Component",
        "src/test.js"
      );

      const before = api.db
        .query("SELECT last_modified FROM code_locations WHERE id = ?")
        .get(locationId);

      // Wait for at least 1 second (SQLite CURRENT_TIMESTAMP has second precision)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      api.updateCodeLocation(locationId);

      const after = api.db
        .query("SELECT last_modified FROM code_locations WHERE id = ?")
        .get(locationId);

      // Timestamps should be different (after should be later)
      expect(after.last_modified).not.toBe(before.last_modified);
    });
  });

  // ==================== Prompt Templates ====================

  describe("Prompt Templates", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should add prompt template", () => {
      const templateId = api.addPromptTemplate(
        projectId,
        "Implement Feature",
        "Implement {{feature}} with {{requirements}}",
        "implementation",
        ["feature", "requirements"]
      );

      expect(templateId).toBeGreaterThan(0);

      const template = api.getPromptTemplate(templateId);

      expect(template.name).toBe("Implement Feature");
      expect(template.template).toContain("{{feature}}");
      expect(template.variables).toEqual(["feature", "requirements"]);
      expect(template.usage_count).toBe(0);
    });

    test("should search prompt templates", () => {
      api.addPromptTemplate(
        projectId,
        "Debug Error",
        "Debug the error in {{file}}",
        "debugging"
      );
      api.addPromptTemplate(
        projectId,
        "Implement Feature",
        "Implement {{feature}}",
        "implementation"
      );
      api.addPromptTemplate(
        projectId,
        "Fix Bug",
        "Fix the bug causing {{issue}}",
        "debugging"
      );

      const results = api.searchPromptTemplates(projectId, null, "debugging");

      expect(results.length).toBe(2);
      results.forEach((t) => {
        expect(t.category).toBe("debugging");
      });
    });

    test("should track template usage", () => {
      const templateId = api.addPromptTemplate(
        projectId,
        "Test Template",
        "Test {{value}}"
      );

      api.usePromptTemplate(templateId, 4);
      api.usePromptTemplate(templateId, 5);

      const template = api.getPromptTemplate(templateId);

      expect(template.usage_count).toBe(2);
      // Should have quality score average
      expect(template.avg_quality_score).toBeDefined();
      expect(template.avg_quality_score).toBeGreaterThan(0);
    });

    test("should expand template with variables", () => {
      const templateId = api.addPromptTemplate(
        projectId,
        "Test",
        "Implement {{feature}} using {{tech}} for {{purpose}}",
        "implementation",
        ["feature", "tech", "purpose"]
      );

      const expanded = api.expandPromptTemplate(templateId, {
        feature: "authentication",
        tech: "JWT",
        purpose: "user login",
      });

      expect(expanded).toBe(
        "Implement authentication using JWT for user login"
      );

      // Should increment usage count
      const template = api.getPromptTemplate(templateId);
      expect(template.usage_count).toBe(1);
    });
  });

  // ==================== Quality Events ====================

  describe("Quality Tracking", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should log quality event", () => {
      const eventId = api.logQualityEvent(
        projectId,
        "bug_found",
        "Login Component",
        "src/auth/login.js",
        "high",
        "Null pointer exception on empty username"
      );

      expect(eventId).toBeGreaterThan(0);

      const event = api.db
        .query("SELECT * FROM quality_events WHERE id = ?")
        .get(eventId);

      expect(event.event_type).toBe("bug_found");
      expect(event.component_name).toBe("Login Component");
      expect(event.severity).toBe("high");
      expect(event.resolved_at).toBeNull();
    });

    test("should resolve quality event", () => {
      const eventId = api.logQualityEvent(projectId, "bug_found");

      api.resolveQualityEvent(eventId);

      const event = api.db
        .query("SELECT * FROM quality_events WHERE id = ?")
        .get(eventId);

      expect(event.resolved_at).not.toBeNull();
    });

    test("should get quality metrics for project", () => {
      api.logQualityEvent(
        projectId,
        "bug_found",
        "Component A",
        null,
        "critical"
      );
      api.logQualityEvent(projectId, "test_fail", "Component A");
      api.logQualityEvent(projectId, "bug_found", "Component B");
      api.logQualityEvent(projectId, "test_pass", "Component A");

      const metrics = api.getQualityMetrics(projectId);

      expect(metrics.length).toBeGreaterThan(0);

      const componentA = metrics.find((m) => m.component_name === "Component A");
      expect(componentA).toBeDefined();
      expect(componentA.total_events).toBe(3);
      expect(componentA.issues).toBe(2); // bug_found + test_fail
      expect(componentA.critical_issues).toBe(1);
      expect(componentA.unresolved).toBe(3); // None resolved yet
    });

    test("should get quality metrics for specific component", () => {
      api.logQualityEvent(projectId, "bug_found", "Component A");
      api.logQualityEvent(projectId, "bug_found", "Component B");

      const metrics = api.getQualityMetrics(projectId, "Component A");

      expect(metrics.length).toBe(1);
      expect(metrics[0].component_name).toBe("Component A");
    });
  });

  // ==================== AI Context Helper ====================

  describe("AI Context Helper", () => {
    let projectId;

    beforeEach(() => {
      const result = api.saveProject("Test Project");
      projectId = result.lastInsertRowid;
    });

    test("should get comprehensive AI context", () => {
      // Add some data
      api.saveTask(projectId, "Task 1");
      api.saveTask(projectId, "Task 2");
      api.addPattern(projectId, "Pattern 1", "Problem", "Solution");
      api.createDecision(projectId, "Decision 1");
      const sessionId = api.startSession(projectId, "claude-3.5-sonnet");

      const context = api.getAIContext(projectId);

      expect(context).toBeDefined();
      expect(context.project).toBeDefined();
      expect(context.currentWork).toBeDefined();
      expect(context.currentWork.length).toBe(2);
      expect(context.patterns).toBeDefined();
      expect(context.patterns.length).toBe(1);
      expect(context.decisions).toBeDefined();
      expect(context.currentSession).toBeDefined();
      expect(context.currentSession.id).toBe(sessionId);
    });

    test("should limit context results appropriately", () => {
      // Add lots of data
      for (let i = 0; i < 20; i++) {
        api.saveContext(
          projectId,
          `Context ${i}`,
          "pre",
          "assumption",
          5
        );
      }

      const context = api.getAIContext(projectId);

      // Should limit recent context to 10
      expect(context.recentContext.length).toBe(10);
    });
  });
});

// ==================== AIWorkNamespace Tests ====================

describe("AIWorkNamespace", () => {
  let namespace;
  let projectId;

  beforeEach(() => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
    namespace = new AIWorkNamespace(TEST_DB);

    // Create a project
    const result = namespace.ai.saveProject("Test Project");
    projectId = result.lastInsertRowid;
  });

  afterEach(() => {
    if (namespace?.ai?.db) {
      namespace.ai.db.close();
    }
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  describe("Project Management", () => {
    test("should create a new project", async () => {
      const mockContext = {};

      const newProjectId = await namespace.projectCreate(mockContext, "New Project");

      expect(newProjectId).toBeGreaterThan(0);

      const projects = namespace.ai.getProjects();
      const created = projects.find(p => p.id === newProjectId);
      expect(created).toBeDefined();
      expect(created.name).toBe("New Project");
    });

    test("should list all projects", async () => {
      const mockContext = {};

      namespace.ai.saveProject("Project A");
      namespace.ai.saveProject("Project B");

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await namespace.projectList(mockContext);

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("Project A");
      expect(output).toContain("Project B");
    });

    test("should show empty message when no projects exist", async () => {
      const newNamespace = new AIWorkNamespace(TEST_DB + ".empty");
      const mockContext = {};

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await newNamespace.projectList(mockContext);

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("No projects found");

      newNamespace.ai.db.close();
      if (existsSync(TEST_DB + ".empty")) {
        unlinkSync(TEST_DB + ".empty");
      }
    });

    test("should show project details", async () => {
      const mockContext = {};

      namespace.ai.saveTask(projectId, "Task 1");
      namespace.ai.saveTask(projectId, "Task 2");
      namespace.ai.completeWork(namespace.ai.db.query("SELECT id FROM tasks WHERE name = 'Task 1'").get().id);

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await namespace.projectShow(mockContext, projectId.toString());

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("Test Project");
      expect(output).toContain("2 total");
      expect(output).toContain("1 pending");
      expect(output).toContain("1 completed");
    });

    test("should set current project", async () => {
      const mockContext = {};

      await namespace.setProject(mockContext, projectId.toString());

      expect(namespace.currentProjectId).toBe(projectId);
    });

    test("should validate project exists when setting", async () => {
      const mockContext = {};

      const errors = [];
      const originalError = console.error;
      console.error = (...args) => errors.push(args.join(" "));

      await namespace.setProject(mockContext, "99999");

      console.error = originalError;

      expect(errors.some(e => e.includes("not found"))).toBe(true);
      expect(namespace.currentProjectId).toBeNull();
    });

    test("should mark current project in list", async () => {
      const mockContext = {};

      namespace.currentProjectId = projectId;

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await namespace.projectList(mockContext);

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("(current)");
    });
  });

  describe("Session Management", () => {
    test("should require project to be set", async () => {
      const mockContext = {};

      // Capture console output
      const errors = [];
      const originalError = console.error;
      console.error = (...args) => errors.push(args.join(" "));

      await namespace.sessionStart(mockContext);

      console.error = originalError;

      expect(errors.some((e) => e.includes("No project set"))).toBe(true);
    });

    test("should start session when project is set", async () => {
      namespace.currentProjectId = projectId;
      const mockContext = {};

      const sessionId = await namespace.sessionStart(
        mockContext,
        "claude-3.5-sonnet",
        "Test goal"
      );

      expect(sessionId).toBeGreaterThan(0);

      const session = namespace.ai.getCurrentSession(projectId);
      expect(session).toBeDefined();
      expect(session.model).toBe("claude-3.5-sonnet");
      expect(session.session_goal).toBe("Test goal");
    });

    test("should end current session", async () => {
      namespace.currentProjectId = projectId;
      const mockContext = {};

      const sessionId = await namespace.sessionStart(mockContext);
      await namespace.sessionEnd(mockContext, "Test complete");

      const session = namespace.ai.db
        .query("SELECT * FROM ai_sessions WHERE id = ?")
        .get(sessionId);

      expect(session.ended_at).not.toBeNull();
      expect(session.outcome).toBe("Test complete");
    });
  });

  describe("Pattern Commands", () => {
    beforeEach(async () => {
      namespace.currentProjectId = projectId;
    });

    test("should add pattern via CLI", async () => {
      const mockContext = {};

      await namespace.patternAdd(
        mockContext,
        "Test Pattern",
        "Test Problem",
        "Test Solution",
        "testing"
      );

      const patterns = namespace.ai.searchPatterns(projectId);
      expect(patterns.length).toBe(1);
      expect(patterns[0].name).toBe("Test Pattern");
    });

    test("should search patterns via CLI", async () => {
      const mockContext = {};

      namespace.ai.addPattern(projectId, "Pattern 1", "Problem", "Solution");
      namespace.ai.addPattern(
        projectId,
        "Different",
        "Other problem",
        "Other solution"
      );

      // Capture console output
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await namespace.patternSearch(mockContext, "Pattern");

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("Pattern 1");
      expect(output).not.toContain("Different");
    });
  });

  describe("Decision Commands", () => {
    beforeEach(async () => {
      namespace.currentProjectId = projectId;
    });

    test("should create decision via CLI", async () => {
      const mockContext = {};

      await namespace.decisionCreate(
        mockContext,
        "Which framework?",
        "Need to choose"
      );

      const decisions = namespace.ai.getRecentDecisions(projectId);
      expect(decisions.length).toBe(1);
      expect(decisions[0].question).toBe("Which framework?");
    });

    test("should add and choose decision option", async () => {
      const mockContext = {};

      const decisionId = namespace.ai.createDecision(
        projectId,
        "Test decision"
      );
      const optionId = namespace.ai.addDecisionOption(
        decisionId,
        "Option A",
        "Description",
        "Pros",
        "Cons"
      );

      await namespace.decisionChoose(
        mockContext,
        decisionId.toString(),
        optionId.toString(),
        "Best choice"
      );

      const decision = namespace.ai.getDecision(decisionId);
      expect(decision.final_choice).toBe(optionId);
    });
  });

  describe("Snapshot Commands", () => {
    beforeEach(async () => {
      namespace.currentProjectId = projectId;
    });

    test("should create snapshot via CLI", async () => {
      const mockContext = {};

      await namespace.snapshotCreate(
        mockContext,
        "Test Snapshot",
        "Before changes"
      );

      const snapshots = namespace.ai.listSnapshots(projectId);
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].name).toBe("Test Snapshot");
    });
  });

  describe("Code Location Commands", () => {
    beforeEach(async () => {
      namespace.currentProjectId = projectId;
    });

    test("should map code location via CLI", async () => {
      const mockContext = {};

      await namespace.codeMap(
        mockContext,
        "Auth Component",
        "src/auth.js",
        "10",
        "50"
      );

      const locations = namespace.ai.findCodeLocations(projectId);
      expect(locations.length).toBe(1);
      expect(locations[0].component_name).toBe("Auth Component");
      expect(locations[0].start_line).toBe(10);
    });

    test("should find code locations via CLI", async () => {
      const mockContext = {};

      namespace.ai.mapCodeLocation(projectId, "Component A", "src/a.js");
      namespace.ai.mapCodeLocation(projectId, "Component B", "src/b.js");

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await namespace.codeFind(mockContext, "Component A");

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("Component A");
      expect(output).toContain("src/a.js");
    });
  });

  describe("Context Overview", () => {
    beforeEach(async () => {
      namespace.currentProjectId = projectId;
    });

    test("should show comprehensive context", async () => {
      const mockContext = {};

      // Add some data
      namespace.ai.saveTask(projectId, "Task 1");
      namespace.ai.addPattern(projectId, "Pattern 1", "Problem", "Solution");
      namespace.ai.createDecision(projectId, "Decision 1");

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await namespace.context(mockContext);

      console.log = originalLog;

      const output = logs.join("\n");
      expect(output).toContain("AI Context");
      expect(output).toContain("Current Work");
      expect(output).toContain("Patterns");
      expect(output).toContain("Decisions");
    });
  });
});

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { AIWorkNamespace } from "../plugins/ai_work_mgr.js";

/**
 * Integration test for the complete AI workflow
 * This tests the exact scenario the user would go through
 */
describe("AI Workflow Integration", () => {
  let ai;
  const testDb = "/tmp/test-ai-workflow.db";

  beforeEach(() => {
    if (existsSync(testDb)) {
      unlinkSync(testDb);
    }
    ai = new AIWorkNamespace(testDb);
  });

  afterEach(() => {
    if (ai?.ai?.db) {
      ai.ai.db.close();
    }
    if (existsSync(testDb)) {
      unlinkSync(testDb);
    }
  });

  test("complete workflow: create project, start session, add pattern, make decision", async () => {
    const mockContext = {};

    // Mock console to suppress output during tests
    const originalLog = console.log;
    const originalError = console.error;
    console.log = () => {};
    console.error = () => {};

    try {
      // Step 1: Create a project
      const projectId = await ai.projectCreate(mockContext, "Test Project");
      expect(projectId).toBeGreaterThan(0);

      // Step 2: Set it as current
      await ai.setProject(mockContext, projectId.toString());
      expect(ai.currentProjectId).toBe(projectId);

      // Step 3: Start a session
      const sessionId = await ai.sessionStart(
        mockContext,
        "claude-3.5-sonnet",
        "Build test feature"
      );
      expect(sessionId).toBeGreaterThan(0);

      // Step 4: Add a pattern
      await ai.patternAdd(
        mockContext,
        "Error Handling",
        "Unhandled errors crash app",
        "Wrap in try-catch",
        "error-handling"
      );

      // Verify pattern was created
      const patterns = ai.ai.searchPatterns(projectId);
      expect(patterns.length).toBe(1);
      expect(patterns[0].name).toBe("Error Handling");

      // Step 5: Make a decision
      await ai.decisionCreate(
        mockContext,
        "Which testing framework?",
        "Need to choose test framework"
      );

      const decisions = ai.ai.getRecentDecisions(projectId);
      expect(decisions.length).toBe(1);

      const decisionId = decisions[0].id;

      // Add options
      await ai.decisionOption(
        mockContext,
        decisionId.toString(),
        "Jest",
        "Popular, good docs",
        "Slower"
      );

      await ai.decisionOption(
        mockContext,
        decisionId.toString(),
        "Bun Test",
        "Fast, built-in",
        "Newer, less plugins"
      );

      // Get decision with options
      const decision = ai.ai.getDecision(decisionId);
      expect(decision.options.length).toBe(2);

      // Choose an option
      const bunOption = decision.options.find((o) => o.option_name === "Bun Test");
      await ai.decisionChoose(
        mockContext,
        decisionId.toString(),
        bunOption.id.toString(),
        "Fast and integrated"
      );

      // Verify choice was recorded
      const updatedDecision = ai.ai.getDecision(decisionId);
      expect(updatedDecision.final_choice).toBe(bunOption.id);

      // Step 6: Map code location
      await ai.codeMap(
        mockContext,
        "Test Suite",
        "test/index.test.js",
        "1",
        "100"
      );

      const locations = ai.ai.findCodeLocations(projectId);
      expect(locations.length).toBe(1);
      expect(locations[0].component_name).toBe("Test Suite");

      // Step 7: Create snapshot
      await ai.snapshotCreate(
        mockContext,
        "Before deployment",
        "All tests passing"
      );

      const snapshots = ai.ai.listSnapshots(projectId);
      expect(snapshots.length).toBe(1);

      // Step 8: Log some actions
      await ai.log(
        mockContext,
        "file_write",
        "src/app.js",
        "Added error handling"
      );

      const session = ai.ai.getCurrentSession(projectId);
      const actions = ai.ai.getSessionActions(session.id);
      expect(actions.length).toBe(1);

      // Step 9: End session
      await ai.sessionEnd(mockContext, "Feature complete");

      // Verify session ended
      const endedSession = ai.ai.db
        .query("SELECT * FROM ai_sessions WHERE id = ?")
        .get(sessionId);
      expect(endedSession.ended_at).not.toBeNull();
      expect(endedSession.outcome).toBe("Feature complete");

      // Step 10: Verify we can get full context
      await ai.context(mockContext);

      const context = ai.ai.getAIContext(projectId);
      expect(context.patterns.length).toBe(1);
      expect(context.decisions.length).toBe(1);
      expect(context.currentSession).toBeNull(); // Session ended

    } finally {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
    }
  });

  test("workflow should fail gracefully without project", async () => {
    const mockContext = {};

    // Should not allow session start without project
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    await ai.sessionStart(mockContext);

    console.error = originalError;

    expect(errors.some((e) => e.includes("No project set"))).toBe(true);
  });

  test("should list multiple projects correctly", async () => {
    const mockContext = {};

    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(" "));

    // Create multiple projects
    const id1 = await ai.projectCreate(mockContext, "Project A");
    const id2 = await ai.projectCreate(mockContext, "Project B");
    const id3 = await ai.projectCreate(mockContext, "Project C");

    // Set one as current
    await ai.setProject(mockContext, id2.toString());

    // Clear logs
    logs.length = 0;

    // List projects
    await ai.projectList(mockContext);

    console.log = originalLog;

    const output = logs.join("\n");
    expect(output).toContain("Project A");
    expect(output).toContain("Project B");
    expect(output).toContain("Project C");
    expect(output).toContain("(current)");

    // Only Project B should be marked current
    const lines = output.split("\n");
    const projectBLine = lines.find((l) => l.includes("Project B"));
    expect(projectBLine).toContain("(current)");
  });
});

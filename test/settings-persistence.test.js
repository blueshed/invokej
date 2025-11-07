import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { AIWorkNamespace } from "../plugins/ai_work_mgr.js";

const TEST_DB = "/tmp/test-settings-persistence.db";

describe("Settings Persistence", () => {
  beforeEach(() => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  test("should persist current project ID across instances", async () => {
    const mockContext = {};

    // First instance: create and set project
    {
      const ai = new AIWorkNamespace(TEST_DB);
      const projectId = await ai.projectCreate(mockContext, "Test Project");
      await ai.setProject(mockContext, projectId.toString());
      expect(ai.currentProjectId).toBe(projectId);
      ai.ai.db.close();
    }

    // Second instance: should load saved project ID
    {
      const ai = new AIWorkNamespace(TEST_DB);
      expect(ai.currentProjectId).toBe(1);
      ai.ai.db.close();
    }
  });

  test("should allow using commands without setting project each time", async () => {
    const mockContext = {};

    // Setup
    {
      const ai = new AIWorkNamespace(TEST_DB);
      await ai.projectCreate(mockContext, "My App");
      await ai.setProject(mockContext, "1");
      ai.ai.db.close();
    }

    // Command 1: Start session (new instance)
    {
      const ai = new AIWorkNamespace(TEST_DB);
      const sessionId = await ai.sessionStart(
        mockContext,
        "claude-3.5-sonnet",
        "Test goal"
      );
      expect(sessionId).toBeGreaterThan(0);
      ai.ai.db.close();
    }

    // Command 2: Add pattern (new instance)
    {
      const ai = new AIWorkNamespace(TEST_DB);
      await ai.patternAdd(
        mockContext,
        "Test Pattern",
        "Problem",
        "Solution",
        "testing"
      );
      const patterns = ai.ai.searchPatterns(ai.currentProjectId);
      expect(patterns.length).toBe(1);
      ai.ai.db.close();
    }

    // Command 3: Get context (new instance)
    {
      const ai = new AIWorkNamespace(TEST_DB);
      const context = ai.ai.getAIContext(ai.currentProjectId);
      expect(context.patterns.length).toBe(1);
      ai.ai.db.close();
    }
  });

  test("should start with null project if none set", () => {
    const ai = new AIWorkNamespace(TEST_DB);
    expect(ai.currentProjectId).toBeNull();
    ai.ai.db.close();
  });

  test("should update persisted project when changed", async () => {
    const mockContext = {};

    const ai1 = new AIWorkNamespace(TEST_DB);
    await ai1.projectCreate(mockContext, "Project 1");
    await ai1.projectCreate(mockContext, "Project 2");
    await ai1.setProject(mockContext, "1");
    ai1.ai.db.close();

    const ai2 = new AIWorkNamespace(TEST_DB);
    expect(ai2.currentProjectId).toBe(1);
    await ai2.setProject(mockContext, "2");
    ai2.ai.db.close();

    const ai3 = new AIWorkNamespace(TEST_DB);
    expect(ai3.currentProjectId).toBe(2);
    ai3.ai.db.close();
  });
});

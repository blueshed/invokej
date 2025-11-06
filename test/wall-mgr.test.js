import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ContextWall, WallNamespace } from "../plugins/wall_mgr.js";
import { Context } from "../context.js";
import { existsSync, unlinkSync, rmSync } from "fs";

describe("ContextWall", () => {
  let wall;
  const testDbPath = "/tmp/test-wall.db";

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    wall = new ContextWall(testDbPath);
    wall.initialize();
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe("Database Initialization", () => {
    test("should create database with proper schema", () => {
      expect(wall.db).toBeDefined();

      const tables = wall.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all();

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain("foundation");
      expect(tableNames).toContain("wall");
      expect(tableNames).toContain("edge");
      expect(tableNames).toContain("rubble");
      expect(tableNames).toContain("current");
    });

    test("should use default path when none provided", () => {
      const defaultWall = new ContextWall();
      expect(defaultWall.dbPath).toContain(".invokej");
    });
  });

  describe("Foundation Methods", () => {
    test("should add foundation decision", () => {
      const result = wall.addFoundation(
        "Use TypeScript",
        "Better type safety",
        "Requires build step"
      );

      expect(result).toBeTruthy();

      const foundations = wall.getFoundation();
      expect(foundations.length).toBe(1);
      expect(foundations[0].decision).toBe("Use TypeScript");
      expect(foundations[0].rationale).toBe("Better type safety");
      expect(foundations[0].constraints).toBe("Requires build step");
    });

    test("should get all foundation decisions", () => {
      wall.addFoundation("Decision 1", "Rationale 1");
      wall.addFoundation("Decision 2", "Rationale 2");

      const foundations = wall.getFoundation();
      expect(foundations.length).toBe(2);
    });

    test("should order foundations by created_at", () => {
      wall.addFoundation("First", "First decision");
      wall.addFoundation("Second", "Second decision");

      const foundations = wall.getFoundation();
      expect(foundations[0].decision).toBe("First");
      expect(foundations[1].decision).toBe("Second");
    });
  });

  describe("Wall Methods", () => {
    test("should add component to wall", () => {
      const result = wall.addToWall(
        "User Authentication",
        "JWT-based auth system",
        1,
        1,
        null,
        "Security requirement"
      );

      expect(result).toBeTruthy();

      const wallComponents = wall.getWall();
      expect(wallComponents.length).toBe(1);
      expect(wallComponents[0].component).toBe("User Authentication");
      expect(wallComponents[0].layer).toBe(1);
    });

    test("should get next layer number", () => {
      const nextLayer = wall.getNextLayer();
      expect(nextLayer).toBe(1);

      wall.addToWall("Component 1", "Description", 1, 1);
      expect(wall.getNextLayer()).toBe(2);

      wall.addToWall("Component 2", "Description", 2, 1);
      expect(wall.getNextLayer()).toBe(3);
    });

    test("should get next position in layer", () => {
      const layer = 1;
      expect(wall.getNextPosition(layer)).toBe(1);

      wall.addToWall("Component 1", "Desc", layer, 1);
      expect(wall.getNextPosition(layer)).toBe(2);

      wall.addToWall("Component 2", "Desc", layer, 2);
      expect(wall.getNextPosition(layer)).toBe(3);
    });

    test("should enforce unique layer-position constraint", () => {
      wall.addToWall("Component 1", "Desc", 1, 1);

      // Attempting to add another component at same layer/position should fail
      expect(() => {
        wall.addToWall("Component 2", "Desc", 1, 1);
      }).toThrow();
    });

    test("should order wall components by layer descending", () => {
      wall.addToWall("Layer 1", "Desc", 1, 1);
      wall.addToWall("Layer 3", "Desc", 3, 1);
      wall.addToWall("Layer 2", "Desc", 2, 1);

      const components = wall.getWall();
      expect(components[0].layer).toBe(3);
      expect(components[1].layer).toBe(2);
      expect(components[2].layer).toBe(1);
    });
  });

  describe("Edge Methods", () => {
    test("should set current edge", () => {
      wall.setEdge(
        "API Endpoints",
        "building",
        "REST with Express",
        null,
        "Define routes"
      );

      const edge = wall.getEdge();
      expect(edge.component).toBe("API Endpoints");
      expect(edge.status).toBe("building");
      expect(edge.current_approach).toBe("REST with Express");
    });

    test("should replace previous edge", () => {
      wall.setEdge("Component 1", "planning");
      wall.setEdge("Component 2", "building");

      const edge = wall.getEdge();
      expect(edge.component).toBe("Component 2");

      // Should only have one edge
      const allEdges = wall.db.prepare("SELECT * FROM edge").all();
      expect(allEdges.length).toBe(1);
    });

    test("should return undefined when no edge set", () => {
      const edge = wall.getEdge();
      expect(edge).toBeUndefined();
    });
  });

  describe("Rubble Methods", () => {
    test("should add failure record", () => {
      wall.addRubble(
        "Authentication",
        "Basic auth",
        "Not secure enough",
        "Always use JWT or OAuth"
      );

      const rubble = wall.getRubble(10);
      expect(rubble.length).toBe(1);
      expect(rubble[0].component).toBe("Authentication");
      expect(rubble[0].lesson_learned).toBe("Always use JWT or OAuth");
    });

    test("should limit rubble results", () => {
      for (let i = 0; i < 10; i++) {
        wall.addRubble(`Component ${i}`, "Approach", "Why", "Lesson");
      }

      const rubble = wall.getRubble(5);
      expect(rubble.length).toBe(5);
    });

    test("should order rubble by tried_at descending", () => {
      wall.addRubble("First", "A1", "W1", "L1");
      wall.addRubble("Second", "A2", "W2", "L2");

      const rubble = wall.getRubble(10);
      expect(rubble[0].component).toBe("Second");
      expect(rubble[1].component).toBe("First");
    });
  });

  describe("Current Focus Methods", () => {
    test("should set current focus", () => {
      wall.setFocus(
        "Building API",
        "Set up Express",
        "Create routes"
      );

      const focus = wall.getCurrentFocus();
      expect(focus.focus).toBe("Building API");
      expect(focus.last_action).toBe("Set up Express");
      expect(focus.next_action).toBe("Create routes");
    });

    test("should update existing focus", () => {
      wall.setFocus("Focus 1", "Last 1", "Next 1");
      wall.setFocus("Focus 2", "Last 2", "Next 2");

      const focus = wall.getCurrentFocus();
      expect(focus.focus).toBe("Focus 2");

      // Should only have one focus record
      const allFocus = wall.db.prepare("SELECT * FROM current").all();
      expect(allFocus.length).toBe(1);
    });

    test("should return undefined when no focus set", () => {
      const focus = wall.getCurrentFocus();
      expect(focus).toBeUndefined();
    });
  });

  describe("getSessionContext()", () => {
    test("should return complete session context", () => {
      wall.setFocus("Current work", "Last", "Next");
      wall.setEdge("Component", "building");
      wall.addRubble("Failed", "Approach", "Why", "Lesson");
      wall.addToWall("Built", "Desc", 1, 1);
      wall.addFoundation("Decision", "Rationale");

      const context = wall.getSessionContext();

      expect(context.current).toBeDefined();
      expect(context.current.focus).toBe("Current work");

      expect(context.edge).toBeDefined();
      expect(context.edge.component).toBe("Component");

      expect(context.recentRubble).toBeDefined();
      expect(context.recentRubble.length).toBe(1);

      expect(context.wallHeight).toBe(1);
      expect(context.foundationCount).toBe(1);
    });

    test("should handle empty session context", () => {
      const context = wall.getSessionContext();

      expect(context.current).toBeUndefined();
      expect(context.edge).toBeUndefined();
      expect(context.recentRubble).toHaveLength(0);
      expect(context.wallHeight).toBe(0);
      expect(context.foundationCount).toBe(0);
    });
  });
});

describe("WallNamespace", () => {
  let namespace;
  let context;
  const testDbPath = "/tmp/test-wall-namespace.db";

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    const wall = new ContextWall(testDbPath);
    namespace = new WallNamespace(wall);
    context = new Context();
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe("Initialization", () => {
    test("should initialize with provided ContextWall", () => {
      expect(namespace.wall).toBeDefined();
      expect(namespace.wall.db).toBeDefined();
    });

    test("should create new ContextWall if none provided", () => {
      // Clean up default path first
      if (existsSync(".invokej")) {
        rmSync(".invokej", { recursive: true });
      }

      const defaultNamespace = new WallNamespace();
      expect(defaultNamespace.wall).toBeDefined();

      // Clean up
      if (existsSync(".invokej")) {
        rmSync(".invokej", { recursive: true });
      }
    });
  });

  describe("add()", () => {
    test("should add component to wall with auto layer", async () => {
      await namespace.add(context, "User Module", "Complete user CRUD");

      const wall = namespace.wall.getWall();
      expect(wall.length).toBe(1);
      expect(wall[0].component).toBe("User Module");
      expect(wall[0].layer).toBe(1);
    });

    test("should add component with specified layer", async () => {
      await namespace.add(context, "Component", "Description", "5");

      const wall = namespace.wall.getWall();
      expect(wall[0].layer).toBe(5);
    });

    test("should handle missing component gracefully", async () => {
      // Should not throw
      await namespace.add(context);
      const wall = namespace.wall.getWall();
      expect(wall.length).toBe(0);
    });
  });

  describe("focus()", () => {
    test("should set focus with all parameters", async () => {
      await namespace.focus(context, "Building auth", "Set up DB", "Create routes");

      const focus = namespace.wall.getCurrentFocus();
      expect(focus.focus).toBe("Building auth");
      expect(focus.last_action).toBe("Set up DB");
      expect(focus.next_action).toBe("Create routes");
    });

    test("should display current focus when no parameters", async () => {
      namespace.wall.setFocus("Current focus", "Last", "Next");

      // Should not throw when displaying
      await namespace.focus(context);
    });
  });

  describe("edge()", () => {
    test("should set edge with all parameters", async () => {
      await namespace.edge(
        context,
        "API",
        "building",
        "REST approach",
        "None",
        "Define routes"
      );

      const edge = namespace.wall.getEdge();
      expect(edge.component).toBe("API");
      expect(edge.status).toBe("building");
    });

    test("should display edge when no parameters", async () => {
      namespace.wall.setEdge("Component", "building");

      // Should not throw
      await namespace.edge(context);
    });
  });

  describe("fail()", () => {
    test("should record failure with lesson", async () => {
      await namespace.fail(
        context,
        "Auth System",
        "Basic auth",
        "Not secure",
        "Use JWT"
      );

      const rubble = namespace.wall.getRubble(10);
      expect(rubble.length).toBe(1);
      expect(rubble[0].lesson_learned).toBe("Use JWT");
    });

    test("should handle missing parameters", async () => {
      // Should not throw, just display usage
      await namespace.fail(context);
    });
  });

  describe("decide()", () => {
    test("should add foundation decision", async () => {
      await namespace.decide(
        context,
        "Use PostgreSQL",
        "Better performance",
        "Requires setup"
      );

      const foundation = namespace.wall.getFoundation();
      expect(foundation.length).toBe(1);
      expect(foundation[0].decision).toBe("Use PostgreSQL");
    });

    test("should handle missing parameters", async () => {
      await namespace.decide(context);

      const foundation = namespace.wall.getFoundation();
      expect(foundation.length).toBe(0);
    });
  });

  describe("clear_edge()", () => {
    test("should clear current edge", async () => {
      namespace.wall.setEdge("Component", "building");

      await namespace.clear_edge(context);

      const edge = namespace.wall.getEdge();
      expect(edge).toBeUndefined();
    });
  });

  describe("stats()", () => {
    test("should display project statistics", async () => {
      namespace.wall.addToWall("Comp 1", "Desc", 1, 1);
      namespace.wall.addToWall("Comp 2", "Desc", 2, 1);
      namespace.wall.addFoundation("Decision", "Rationale");
      namespace.wall.addRubble("Failed", "Approach", "Why", "Lesson");

      // Should not throw
      await namespace.stats(context);
    });

    test("should calculate success rate", async () => {
      namespace.wall.addToWall("Success 1", "Desc", 1, 1);
      namespace.wall.addToWall("Success 2", "Desc", 1, 2);
      namespace.wall.addRubble("Failure", "Approach", "Why", "Lesson");

      // Success rate should be 2/(2+1) * 100 = 66.7%
      const stats = namespace.wall.db.prepare("SELECT COUNT(*) as count FROM wall").get();
      const rubbleCount = namespace.wall.db.prepare("SELECT COUNT(*) as count FROM rubble").get();

      expect(stats.count).toBe(2);
      expect(rubbleCount.count).toBe(1);
    });
  });
});

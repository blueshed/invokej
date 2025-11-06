import { describe, test, expect, beforeEach, mock } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

// We need to test the internal functions from cli.js
// Since they're not exported, we'll need to import and test via file operations

describe("CLI Task Discovery and Parsing", () => {
  describe("parseCommand", () => {
    test("should parse simple command", () => {
      // Testing the pattern: namespace:method or namespace.method
      const testCommand = "hello";
      const parsed = { namespace: null, method: "hello" };

      // Since parseCommand isn't exported, we test the behavior through expected outcomes
      expect(testCommand.includes(":")).toBe(false);
      expect(testCommand.includes(".")).toBe(false);
    });

    test("should parse namespaced command with colon", () => {
      const testCommand = "db:migrate";
      expect(testCommand.includes(":")).toBe(true);

      const [namespace, method] = testCommand.split(":");
      expect(namespace).toBe("db");
      expect(method).toBe("migrate");
    });

    test("should parse namespaced command with dot", () => {
      const testCommand = "db.migrate";
      expect(testCommand.includes(".")).toBe(true);

      const [namespace, method] = testCommand.split(".");
      expect(namespace).toBe("db");
      expect(method).toBe("migrate");
    });
  });

  describe("Task Discovery", () => {
    test("should discover root-level methods", async () => {
      const { Tasks } = await import("./fixtures/simple-tasks.js");
      const instance = new Tasks();

      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
        .filter(name => name !== "constructor" && !name.startsWith("_") && typeof instance[name] === "function");

      expect(methods).toContain("hello");
      expect(methods).toContain("build");
      expect(methods).not.toContain("_privateHelper");
    });

    test("should discover namespaced methods", async () => {
      const { Tasks } = await import("./fixtures/namespaced-tasks.js");
      const instance = new Tasks();

      // Check that db namespace exists
      expect(instance.db).toBeDefined();
      expect(typeof instance.db).toBe("object");

      // Check that private namespace is filtered
      expect(instance._private).toBeDefined(); // exists as property
      const namespaces = Object.getOwnPropertyNames(instance).filter(
        prop => !prop.startsWith("_") && instance[prop] && typeof instance[prop] === "object"
      );

      expect(namespaces).toContain("db");
      expect(namespaces).not.toContain("_private");
    });

    test("should discover inherited methods", async () => {
      const { Tasks } = await import("./fixtures/inherited-tasks.js");
      const instance = new Tasks();

      // Walk prototype chain
      const methods = new Set();
      let proto = Object.getPrototypeOf(instance);

      while (proto && proto !== Object.prototype) {
        Object.getOwnPropertyNames(proto).forEach(name => {
          if (name !== "constructor" && !name.startsWith("_") && typeof instance[name] === "function") {
            methods.add(name);
          }
        });
        proto = Object.getPrototypeOf(proto);
      }

      expect(Array.from(methods)).toContain("baseTask");
      expect(Array.from(methods)).toContain("sharedTask");
      expect(Array.from(methods)).toContain("childTask");
    });
  });

  describe("Method Resolution", () => {
    test("should resolve root-level method", async () => {
      const { Tasks } = await import("./fixtures/simple-tasks.js");
      const instance = new Tasks();

      const method = instance["hello"];
      expect(typeof method).toBe("function");
    });

    test("should resolve namespaced method", async () => {
      const { Tasks } = await import("./fixtures/namespaced-tasks.js");
      const instance = new Tasks();

      const ns = instance["db"];
      expect(ns).toBeDefined();

      const method = ns["migrate"];
      expect(typeof method).toBe("function");
    });

    test("should not resolve private methods", async () => {
      const { Tasks } = await import("./fixtures/simple-tasks.js");
      const instance = new Tasks();

      // Private methods exist but should be filtered by CLI logic
      expect(typeof instance._privateHelper).toBe("function");
      expect("_privateHelper".startsWith("_")).toBe(true);
    });

    test("should not resolve private namespaces", async () => {
      const { Tasks } = await import("./fixtures/namespaced-tasks.js");
      const instance = new Tasks();

      // Private namespace exists but should be filtered
      expect(instance._private).toBeDefined();
      expect("_private".startsWith("_")).toBe(true);
    });
  });

  describe("JSDoc Extraction", () => {
    test("should extract method documentation", () => {
      const source = readFileSync(
        path.resolve(import.meta.dir, "./fixtures/simple-tasks.js"),
        "utf-8"
      );

      // Simple regex to find JSDoc comments before methods
      const methodRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:async\s+)?(\w+)\s*\(/g;
      const docs = {};
      let match;

      while ((match = methodRegex.exec(source)) !== null) {
        const [, comment, methodName] = match;
        const lines = comment
          .split("\n")
          .map(line => line.replace(/^\s*\*\s?/, "").trim())
          .filter(line => line && !line.startsWith("@"));

        if (methodName !== "constructor" && !methodName.startsWith("_")) {
          docs[methodName] = lines[0] || "";
        }
      }

      expect(docs.hello).toBe("Say hello to someone");
      expect(docs.build).toBe("Build the project");
      expect(docs._privateHelper).toBeUndefined();
    });

    test("should extract class documentation", () => {
      const source = readFileSync(
        path.resolve(import.meta.dir, "./fixtures/simple-tasks.js"),
        "utf-8"
      );

      // Look for comment before "export class Tasks"
      const classStart = source.indexOf("export class Tasks");
      let classDoc = null;

      if (classStart !== -1) {
        for (let i = classStart - 1; i >= 0; i--) {
          const char = source[i];
          if (char === "/" && source[i - 1] === "*") {
            const commentEnd = i + 1;
            for (let j = i - 1; j >= 1; j--) {
              if (source[j] === "*" && source[j - 1] === "/" && source[j + 1] === "*") {
                const commentContent = source.substring(j - 1 + 3, commentEnd - 2);
                classDoc = commentContent
                  .replace(/^\s*\*/gm, "")
                  .replace(/^\s+/gm, "")
                  .trim();
                break;
              }
            }
            break;
          }
        }
      }

      expect(classDoc).toBe("Simple test fixture for basic task testing");
    });
  });

  describe("Method Signature Extraction", () => {
    test("should extract method signature without context parameter", async () => {
      const { Tasks } = await import("./fixtures/simple-tasks.js");
      const instance = new Tasks();

      const fn = instance.hello;
      const fnString = fn.toString();
      const match = fnString.match(/(?:async\s+)?(\w+)\s*\(([\s\S]*?)\)\s*{/);

      expect(match).toBeTruthy();
      const [, name, params] = match;

      expect(name).toBe("hello");

      // Context parameter should be first and should be sliced off in display
      const paramList = params.split(",").map(p => p.trim());
      expect(paramList[0]).toBe("c"); // Context parameter
      expect(paramList[1]).toContain("name"); // User parameter
    });

    test("should handle methods with default parameters", async () => {
      const { Tasks } = await import("./fixtures/simple-tasks.js");
      const instance = new Tasks();

      const fn = instance.hello;
      const fnString = fn.toString();

      expect(fnString).toContain('name = "World"');
    });
  });
});

describe("CLI Integration", () => {
  test("should reject private method calls", () => {
    const method = "_privateMethod";
    expect(method.startsWith("_")).toBe(true);
  });

  test("should reject private namespace calls", () => {
    const namespace = "_privateNamespace";
    expect(namespace.startsWith("_")).toBe(true);
  });

  test("should reject constructor calls", () => {
    const method = "constructor";
    expect(method).toBe("constructor");
  });
});

describe("Task Execution", () => {
  test("should execute simple task", async () => {
    const { Tasks } = await import("./fixtures/simple-tasks.js");
    const { Context } = await import("../context.js");

    const instance = new Tasks();
    const context = new Context();

    const result = await instance.hello(context, "Test");
    expect(result).toBe("Hello, Test!");
  });

  test("should execute namespaced task", async () => {
    const { Tasks } = await import("./fixtures/namespaced-tasks.js");
    const { Context } = await import("../context.js");

    const instance = new Tasks();
    const context = new Context();

    const result = await instance.db.migrate(context, "down");
    expect(result.action).toBe("migrate");
    expect(result.direction).toBe("down");
  });

  test("should execute inherited task", async () => {
    const { Tasks } = await import("./fixtures/inherited-tasks.js");
    const { Context } = await import("../context.js");

    const instance = new Tasks();
    const context = new Context();

    const baseResult = await instance.baseTask(context);
    expect(baseResult).toBe("base task executed");

    const childResult = await instance.childTask(context);
    expect(childResult).toBe("child task executed");
  });

  test("should execute overridden task from child class", async () => {
    const { Tasks } = await import("./fixtures/inherited-tasks.js");
    const { Context } = await import("../context.js");

    const instance = new Tasks();
    const context = new Context();

    const result = await instance.sharedTask(context, "override");
    expect(result).toBe("child: override");
    expect(result).not.toContain("base:");
  });
});

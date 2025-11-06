import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync, existsSync, rmSync } from "fs";
import { join } from "path";

/**
 * End-to-end integration tests for the invokej CLI
 * These tests actually execute the CLI and verify the complete workflow
 */

const CLI_PATH = join(import.meta.dir, "../../cli.js");
const TEST_DIR = "/tmp/invokej-integration-test";

// Helper to execute CLI command
function runCLI(args = [], tasksFile = null) {
  return new Promise((resolve, reject) => {
    const cwd = tasksFile ? TEST_DIR : process.cwd();

    const child = spawn("bun", [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

describe("End-to-End CLI Tests", () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      require("fs").mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("CLI Help and Version", () => {
    test("should show help with --help", async () => {
      // Use a simple tasks file
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async hello(c) {
            console.log("Hello");
          }
        }`
      );

      const result = await runCLI(["--help"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("invokej");
      expect(result.stdout).toContain("Usage:");
    });

    test("should show version with --version", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async test(c) {}
        }`
      );

      const result = await runCLI(["--version"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Version");
    });

    test("should show help with no arguments", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async test(c) {}
        }`
      );

      const result = await runCLI([], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("invokej");
    });
  });

  describe("Task Listing", () => {
    test("should list available tasks", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          /** Build the project */
          async build(c) {
            console.log("Building...");
          }

          /** Run tests */
          async test(c) {
            console.log("Testing...");
          }
        }`
      );

      const result = await runCLI(["--list"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Available tasks:");
      expect(result.stdout).toContain("build");
      expect(result.stdout).toContain("test");
      expect(result.stdout).toContain("Build the project");
      expect(result.stdout).toContain("Run tests");
    });

    test("should list namespaced tasks", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `
        class DbNamespace {
          /** Run migrations */
          async migrate(c) {}
        }

        export class Tasks {
          constructor() {
            this.db = new DbNamespace();
          }

          /** Build project */
          async build(c) {}
        }`
      );

      const result = await runCLI(["--list"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("build");
      expect(result.stdout).toContain("db:");
      expect(result.stdout).toContain("migrate");
    });

    test("should not list private methods", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async publicTask(c) {}
          async _privateTask(c) {}
        }`
      );

      const result = await runCLI(["--list"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("publicTask");
      expect(result.stdout).not.toContain("_privateTask");
    });
  });

  describe("Task Execution", () => {
    test("should execute simple task", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async hello(c) {
            console.log("Hello, World!");
          }
        }`
      );

      const result = await runCLI(["hello"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Hello, World!");
    });

    test("should execute task with arguments", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async greet(c, name = "World") {
            console.log(\`Hello, \${name}!\`);
          }
        }`
      );

      const result = await runCLI(["greet", "Alice"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Hello, Alice!");
    });

    test("should execute namespaced task", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `
        class DbNamespace {
          async migrate(c, direction = "up") {
            console.log(\`Migrating \${direction}\`);
          }
        }

        export class Tasks {
          constructor() {
            this.db = new DbNamespace();
          }
        }`
      );

      const result = await runCLI(["db:migrate", "down"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Migrating down");
    });

    test("should fail on unknown task", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async build(c) {}
        }`
      );

      const result = await runCLI(["unknownTask"], tasksFile);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Unknown");
    });

    test("should fail on private task call", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async _privateTask(c) {
            console.log("Private");
          }
        }`
      );

      const result = await runCLI(["_privateTask"], tasksFile);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("private");
    });

    test("should fail on private namespace call", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `
        class PrivateNamespace {
          async method(c) {}
        }

        export class Tasks {
          constructor() {
            this._private = new PrivateNamespace();
          }
        }`
      );

      const result = await runCLI(["_private:method"], tasksFile);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("private");
    });
  });

  describe("Context API Usage", () => {
    test("should use context to run commands", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async echo(c, message) {
            await c.run(\`echo "\${message}"\`);
          }
        }`
      );

      const result = await runCLI(["echo", "Test Message"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Test Message");
    });

    test("should handle command failures", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async fail(c) {
            await c.run("exit 1");
          }
        }`
      );

      const result = await runCLI(["fail"], tasksFile);
      expect(result.code).toBe(1);
    });

    test("should use warn option to continue on failure", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class Tasks {
          async warnTest(c) {
            await c.run("exit 1", { warn: true });
            console.log("Continued after failure");
          }
        }`
      );

      const result = await runCLI(["warnTest"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Continued after failure");
    });
  });

  describe("Error Handling", () => {
    test("should handle missing tasks.js file", async () => {
      const result = await runCLI(["build"], true);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("No tasks.js file found");
    });

    test("should handle invalid tasks.js file", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(tasksFile, "this is not valid JavaScript {{{");

      const result = await runCLI(["build"], tasksFile);
      expect(result.code).not.toBe(0);
    });

    test("should handle missing Tasks class export", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `export class NotTasks {
          async build(c) {}
        }`
      );

      const result = await runCLI(["build"], tasksFile);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("No Tasks class");
    });
  });

  describe("Class Inheritance", () => {
    test("should execute inherited methods", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `
        class BaseTasks {
          async baseMethod(c) {
            console.log("Base method executed");
          }
        }

        export class Tasks extends BaseTasks {
          async childMethod(c) {
            console.log("Child method executed");
          }
        }`
      );

      const baseResult = await runCLI(["baseMethod"], tasksFile);
      expect(baseResult.code).toBe(0);
      expect(baseResult.stdout).toContain("Base method executed");

      const childResult = await runCLI(["childMethod"], tasksFile);
      expect(childResult.code).toBe(0);
      expect(childResult.stdout).toContain("Child method executed");
    });

    test("should list inherited methods", async () => {
      const tasksFile = join(TEST_DIR, "tasks.js");
      writeFileSync(
        tasksFile,
        `
        class BaseTasks {
          async baseMethod(c) {}
        }

        export class Tasks extends BaseTasks {
          async childMethod(c) {}
        }`
      );

      const result = await runCLI(["--list"], tasksFile);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("baseMethod");
      expect(result.stdout).toContain("childMethod");
    });
  });
});

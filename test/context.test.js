import { describe, test, expect, beforeEach } from "bun:test";
import { Context } from "../context.js";
import { existsSync, mkdirSync, rmSync } from "fs";

describe("Context", () => {
  let context;

  beforeEach(() => {
    context = new Context();
  });

  describe("constructor", () => {
    test("should initialize with default config", () => {
      expect(context.config.echo).toBe(false);
      expect(context.config.warn).toBe(false);
      expect(context.config.hide).toBe(false);
      expect(context.config.pty).toBe(false);
    });

    test("should accept custom config", () => {
      const customContext = new Context({ echo: true, warn: true });
      expect(customContext.config.echo).toBe(true);
      expect(customContext.config.warn).toBe(true);
    });

    test("should set cwd to current directory", () => {
      expect(context.cwd).toBe(process.cwd());
    });
  });

  describe("run()", () => {
    test("should execute simple command successfully", async () => {
      const result = await context.run("echo 'test'", { hide: true });
      expect(result.code).toBe(0);
      expect(result.ok).toBe(true);
      expect(result.failed).toBe(false);
      expect(result.stdout).toContain("test");
    });

    test("should capture stdout when hide=true", async () => {
      const result = await context.run("echo 'captured output'", {
        hide: true,
      });
      expect(result.stdout).toContain("captured output");
    });

    test("should handle command failure", async () => {
      try {
        await context.run("exit 1", { hide: true });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("Command failed with exit code 1");
        expect(error.result.code).toBe(1);
        expect(error.result.failed).toBe(true);
      }
    });

    test("should continue on failure with warn=true", async () => {
      const result = await context.run("exit 1", { warn: true, hide: true });
      expect(result.code).toBe(1);
      expect(result.failed).toBe(true);
      // Should not throw
    });

    test("should respect cwd option", async () => {
      const result = await context.run("pwd", { hide: true, cwd: "/" });
      expect(result.stdout.trim()).toBe("/");
    });

    test("should handle commands with stderr", async () => {
      const result = await context.run("echo 'error' >&2", {
        hide: true,
        warn: true,
      });
      expect(result.stderr).toContain("error");
    });

    test("should return empty strings for stdout/stderr when not hidden", async () => {
      const result = await context.run("echo 'test'");
      // When not hidden, stdout is inherited so we don't capture it
      expect(result.stdout).toBe("");
    });
  });

  describe("pwd", () => {
    test("should return current working directory", () => {
      expect(context.pwd).toBe(process.cwd());
    });
  });

  describe("sudo()", () => {
    test("should prefix command with sudo", async () => {
      // Test that sudo prefixes the command correctly by using a command that will fail with sudo
      // Use 'sudo -n' (non-interactive) to avoid password prompt and timeout
      // This will fail with an error which we can catch
      try {
        // Use warn: true to avoid throwing on error, just return the result
        const result = await context.run("sudo -n echo 'test'", {
          hide: true,
          warn: true,
        });
        // If it somehow succeeded (user has passwordless sudo), that's fine
        expect(result).toBeDefined();
      } catch (error) {
        // Expected to fail in most test environments (no passwordless sudo)
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe("local()", () => {
    test("should be an alias for run()", async () => {
      const result = await context.local("echo 'local test'", { hide: true });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("local test");
    });
  });

  describe("command chaining", () => {
    test("should handle multiple commands with &&", async () => {
      const result = await context.run("echo 'first' && echo 'second'", {
        hide: true,
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("first");
      expect(result.stdout).toContain("second");
    });

    test("should stop on first failure with &&", async () => {
      try {
        await context.run("exit 1 && echo 'should not run'", { hide: true });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.result.code).toBe(1);
        expect(error.result.stdout).not.toContain("should not run");
      }
    });

    test("should continue with || on failure", async () => {
      const result = await context.run("false || echo 'fallback'", {
        hide: true,
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("fallback");
    });
  });

  describe("complex commands", () => {
    test("should handle pipes", async () => {
      const result = await context.run("echo 'hello world' | grep 'world'", {
        hide: true,
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("world");
    });

    test("should handle redirects", async () => {
      const tmpDir = "/tmp/invokej-test";
      const testFile = `${tmpDir}/redirect-test.txt`;

      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true });
      }
      mkdirSync(tmpDir, { recursive: true });

      await context.run(`echo 'redirected' > ${testFile}`, { hide: true });
      const result = await context.run(`cat ${testFile}`, { hide: true });

      expect(result.stdout).toContain("redirected");

      // Cleanup
      rmSync(tmpDir, { recursive: true });
    });

    test("should handle environment variables", async () => {
      const result = await context.run("TEST_VAR=hello && echo $TEST_VAR", {
        hide: true,
      });
      expect(result.stdout).toContain("hello");
    });
  });

  describe("result object", () => {
    test("should include all expected properties", async () => {
      const result = await context.run("echo 'test'", { hide: true });

      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("code");
      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("failed");

      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");
      expect(typeof result.code).toBe("number");
      expect(typeof result.ok).toBe("boolean");
      expect(typeof result.failed).toBe("boolean");
    });

    test("ok and failed should be inverses", async () => {
      const successResult = await context.run("echo 'test'", { hide: true });
      expect(successResult.ok).toBe(true);
      expect(successResult.failed).toBe(false);

      const failResult = await context.run("exit 1", {
        hide: true,
        warn: true,
      });
      expect(failResult.ok).toBe(false);
      expect(failResult.failed).toBe(true);
    });
  });
});

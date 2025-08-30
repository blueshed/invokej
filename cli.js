#!/usr/bin/env bun

import { readFileSync } from "fs";
import path from "path";
import { Context } from "./context.js";
import pkg from "./package.json";

const tasksPath = path.resolve(process.cwd(), "tasks.js");

let Tasks;
try {
  ({ Tasks } = await import(tasksPath));
} catch (err) {
  if (err.code === "ENOENT" || err.message.includes("Cannot find module")) {
    console.error("ERROR: No tasks.js file found in current directory");
    console.error("Please create a tasks.js file with your task definitions.");
    console.error("\nExample tasks.js:");
    console.error(`
export class Tasks {
  /** Example task */
  async hello(c) {
    await c.run("echo 'Hello from invokej!'");
  }
}
`);
    process.exit(1);
  }
  throw err;
}

if (!Tasks) {
  console.error("ERROR: No Tasks class exported from tasks.js");
  process.exit(1);
}

const instance = new Tasks();
const context = new Context();
const { taskDocs, classDoc } = loadTaskDocs(tasksPath);

const argv = process.argv.slice(2);

// Parse namespace:method or namespace.method notation
function parseCommand(command) {
  // Support both : and . as separators
  const separators = [":", "."];
  for (const sep of separators) {
    if (command?.includes(sep)) {
      const [namespace, method] = command.split(sep);
      return { namespace, method };
    }
  }
  return { namespace: null, method: command };
}

// Resolve the actual function to call
function resolveMethod(instance, namespace, method) {
  if (namespace) {
    // Check if namespace is private
    if (namespace.startsWith("_")) {
      return null;
    }

    // Check if namespace exists as a property
    const ns = instance[namespace];
    if (ns && typeof ns === "object" && typeof ns[method] === "function") {
      return { target: ns, fn: ns[method] };
    }
    // Fallback: try underscore notation for backward compatibility
    const underscoreMethod = `${namespace}_${method}`;
    if (typeof instance[underscoreMethod] === "function") {
      console.warn(
        `⚠️  Using ${underscoreMethod} - consider migrating to ${namespace}:${method} notation`,
      );
      return { target: instance, fn: instance[underscoreMethod] };
    }
    return null;
  }

  // Root-level method
  if (typeof instance[method] === "function") {
    return { target: instance, fn: instance[method] };
  }
  return null;
}

// Enhanced task discovery for namespaces
function discoverTasks(instance) {
  const tasks = {
    root: [],
    namespaced: {},
  };

  // Get root-level methods including inherited ones
  const rootMethods = new Set();
  let proto = Object.getPrototypeOf(instance);

  // Walk up the prototype chain until we hit Object.prototype
  while (proto && proto !== Object.prototype) {
    Object.getOwnPropertyNames(proto).forEach((name) => {
      if (
        name !== "constructor" &&
        !name.startsWith("_") &&
        typeof instance[name] === "function"
      ) {
        rootMethods.add(name);
      }
    });
    proto = Object.getPrototypeOf(proto);
  }

  tasks.root = Array.from(rootMethods);

  // Discover namespace objects
  for (const prop of Object.getOwnPropertyNames(instance)) {
    const value = instance[prop];

    // Skip private namespaces
    if (prop.startsWith("_")) {
      continue;
    }

    // Check if it's a namespace object (has methods)
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nsMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(value),
      ).filter(
        (m) =>
          m !== "constructor" &&
          !m.startsWith("_") &&
          typeof value[m] === "function",
      );

      if (nsMethods.length > 0) {
        tasks.namespaced[prop] = nsMethods;
      }
    }
  }

  return tasks;
}

if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
  printHelp(instance);
  process.exit(0);
}

if (argv.includes("-l") || argv.includes("--list")) {
  printTaskList(instance);
  process.exit(0);
}

if (argv.includes("--version")) {
  console.log(`Version ${pkg.version}`);
  process.exit(0);
}

const [subcommand, ...args] = argv;
const { namespace, method } = parseCommand(subcommand);

// Check for private namespace, method, or constructor
if (namespace?.startsWith("_")) {
  console.error(`Cannot call private namespace "${namespace}"\n`);
  printTaskList(instance);
  process.exit(1);
}

if (method?.startsWith("_")) {
  console.error(`Cannot call private method "${method}"\n`);
  printTaskList(instance);
  process.exit(1);
}

if (method === "constructor") {
  console.error(`Cannot call constructor method "${method}"\n`);
  printTaskList(instance);
  process.exit(1);
}

const resolved = resolveMethod(instance, namespace, method);

if (!resolved) {
  console.error(
    `Unknown ${namespace ? "namespaced " : ""}task "${subcommand}"\n`,
  );
  printTaskList(instance);
  process.exit(1);
}

try {
  const result = await resolved.fn.apply(resolved.target, [context, ...args]);
  if (result instanceof Promise) await result;
} catch (err) {
  console.error(`Error running "${subcommand}":`, err.message || err);
  process.exit(1);
}

function printTaskList(instance) {
  if (classDoc) {
    console.log(`${classDoc}\n`);
  }

  const tasks = discoverTasks(instance);

  console.log("Available tasks:\n");

  // Root tasks
  if (tasks.root.length > 0) {
    tasks.root.forEach((task) => {
      const doc = taskDocs[task] ?? "";
      const signature = getMethodSignature(instance[task]);
      console.log(`  ${signature}${doc ? " — " + doc : ""}`);
    });
  }

  // Namespaced tasks
  Object.entries(tasks.namespaced).forEach(([ns, methods]) => {
    console.log(`\n${ns}:`);
    methods.forEach((method) => {
      const nsObj = instance[ns];
      const signature = getMethodSignature(nsObj[method]);
      // Try to get docs for namespaced method
      const doc =
        taskDocs[`${ns}_${method}`] ?? taskDocs[`${ns}:${method}`] ?? "";
      console.log(`  ${ns}:${signature}${doc ? " — " + doc : ""}`);
    });
  });
}

function printHelp(instance) {
  console.log(
    `invokej — JavaScript task runner inspired by Python Invoke — version ${pkg.version}\n`,
  );

  if (classDoc) {
    console.log(`${classDoc}\n`);
  }

  const tasks = discoverTasks(instance);

  console.log("Available tasks:\n");

  // Root tasks
  if (tasks.root.length > 0) {
    tasks.root.forEach((task) => {
      const doc = taskDocs[task] ?? "";
      const signature = getMethodSignature(instance[task]);
      console.log(`  ${signature}${doc ? " — " + doc : ""}`);
    });
  }

  // Namespaced tasks
  Object.entries(tasks.namespaced).forEach(([ns, methods]) => {
    console.log(`\n${ns}:`);
    methods.forEach((method) => {
      const nsObj = instance[ns];
      const signature = getMethodSignature(nsObj[method]);
      const doc =
        taskDocs[`${ns}_${method}`] ?? taskDocs[`${ns}:${method}`] ?? "";
      console.log(`  ${ns}:${signature}${doc ? " — " + doc : ""}`);
    });
  });

  console.log(`\nUsage:`);
  console.log(`  invokej <task> [args...]              # Run root task`);
  console.log(`  invokej <namespace>:<task> [args...]  # Run namespaced task`);
  console.log(`  invokej -l                            # List tasks`);
  console.log(`  invokej -h                            # Show help`);
  console.log(`  invokej --version                     # Show version`);
  console.log(
    `\nFor more information about a specific task, run it with invalid arguments to see its usage.`,
  );
}

function loadTaskDocs(filePath) {
  const source = readFileSync(filePath, "utf-8");
  const allDocs = {};
  let classDoc = null;

  // Check if Tasks extends another class
  const extendsMatch = source.match(/export\s+class\s+Tasks\s+extends\s+(\w+)/);
  if (extendsMatch) {
    // Try to find the import statement for the parent class
    const parentClassName = extendsMatch[1];
    const importMatch = source.match(
      new RegExp(
        `import\\s+(?:{[^}]*${parentClassName}[^}]*}|${parentClassName})\\s+from\\s+["']([^"']+)["']`,
      ),
    );

    if (importMatch) {
      const importPath = importMatch[1];
      // Resolve relative imports
      if (importPath.startsWith(".")) {
        const baseDir = path.dirname(filePath);
        const parentPath = path.resolve(baseDir, importPath);

        try {
          const parentSource = readFileSync(parentPath, "utf-8");
          // Extract methods from parent class
          const parentDocs = extractMethodDocs(parentSource);
          Object.assign(allDocs, parentDocs);
        } catch (err) {
          // Parent file not found or not readable, continue without parent docs
        }
      }
    }
  }

  // Find the Tasks class and extract content between its curly braces
  const tasksClassStart = source.indexOf("export class Tasks");

  // Walk backwards from "export class Tasks" to find class comment
  if (tasksClassStart !== -1) {
    let foundComment = false;

    // Walk backwards character by character
    for (let i = tasksClassStart - 1; i >= 0; i--) {
      const char = source[i];

      // If we hit a closing brace, there's no class comment
      if (char === "}") {
        break;
      }

      // Look for the end of a JSDoc comment */
      if (char === "/" && i > 0 && source[i - 1] === "*") {
        // Found end of comment, now find the start
        let commentEnd = i + 1;
        let commentStart = -1;

        // Walk backwards to find /**
        for (let j = i - 1; j >= 1; j--) {
          if (
            source[j] === "*" &&
            source[j - 1] === "/" &&
            source[j + 1] === "*"
          ) {
            commentStart = j - 1;
            break;
          }
        }

        if (commentStart !== -1) {
          const commentContent = source.substring(
            commentStart + 3,
            commentEnd - 2,
          );
          classDoc = commentContent
            .replace(/^\s*\*/gm, "") // Remove leading * from each line
            .replace(/^\s+/gm, "") // Remove leading whitespace
            .trim();
          foundComment = true;
        }
        break;
      }
    }
  }

  if (tasksClassStart === -1) {
    return { taskDocs: {}, classDoc };
  }

  // Find the opening brace of the Tasks class
  const openBraceIndex = source.indexOf("{", tasksClassStart);
  if (openBraceIndex === -1) {
    return { taskDocs: {}, classDoc };
  }

  // Find the matching closing brace - need to handle strings and comments
  let braceCount = 0;
  let closeBraceIndex = openBraceIndex;
  let inString = false;
  let inComment = false;
  let stringChar = null;

  for (let i = openBraceIndex; i < source.length; i++) {
    const char = source[i];
    const nextChar = source[i + 1];

    // Handle line comments
    if (!inString && !inComment && char === "/" && nextChar === "/") {
      // Skip to end of line
      while (i < source.length && source[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Handle block comments
    if (!inString && !inComment && char === "/" && nextChar === "*") {
      inComment = true;
      i++; // Skip the *
      continue;
    }

    if (!inString && inComment && char === "*" && nextChar === "/") {
      inComment = false;
      i++; // Skip the /
      continue;
    }

    // Skip everything inside comments
    if (inComment) continue;

    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === "`")) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString && char === stringChar && source[i - 1] !== "\\") {
      inString = false;
      stringChar = null;
      continue;
    }

    // Skip everything inside strings
    if (inString) continue;

    // Count braces only outside strings and comments
    if (char === "{") braceCount++;
    if (char === "}") {
      braceCount--;
      if (braceCount === 0) {
        closeBraceIndex = i;
        break;
      }
    }
  }

  // Extract only the content inside the Tasks class
  const tasksClassContent = source.substring(
    openBraceIndex + 1,
    closeBraceIndex,
  );

  // Find method comments within the Tasks class content
  const methodRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:async\s+)?(\w+)\s*\(/g;
  const docs = {};
  let match;

  while ((match = methodRegex.exec(tasksClassContent)) !== null) {
    const [fullMatch, comment, methodName] = match;
    if (methodName !== "constructor" && !methodName.startsWith("_")) {
      // Extract just the first line of the comment for the description
      const lines = comment
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter((line) => line && !line.startsWith("@"));

      docs[methodName] = lines[0] || "";
    }
  }

  // Merge parent docs with current class docs (current class overrides)
  Object.assign(allDocs, docs);

  return { taskDocs: allDocs, classDoc };
}

// Helper function to extract method docs from any source
function extractMethodDocs(source) {
  const docs = {};
  // Match both class and export default class patterns
  const classMatch = source.match(
    /(?:export\s+default\s+)?class\s+\w+\s*(?:extends\s+\w+)?\s*{([\s\S]*?)^}/m,
  );

  if (classMatch) {
    const classContent = classMatch[1];
    const methodRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:async\s+)?(\w+)\s*\(/g;
    let match;

    while ((match = methodRegex.exec(classContent)) !== null) {
      const [fullMatch, comment, methodName] = match;
      if (methodName !== "constructor" && !methodName.startsWith("_")) {
        // Extract just the first line of the comment for the description
        const lines = comment
          .split("\n")
          .map((line) => line.replace(/^\s*\*\s?/, "").trim())
          .filter((line) => line && !line.startsWith("@"));

        docs[methodName] = lines[0] || "";
      }
    }
  }

  return docs;
}

function getMethodSignature(fn) {
  const fnString = fn.toString();

  // Extract function name and parameters, handling multiline functions
  const match = fnString.match(/(?:async\s+)?(\w+)\s*\(([\s\S]*?)\)\s*{/);
  if (!match) return fn.name || "unknown";

  const [, name, params] = match;

  if (!params.trim()) {
    return name + "()";
  }

  // Clean up whitespace and newlines in parameters
  const cleanParams = params.replace(/\s+/g, " ").trim();

  // Parse parameters, handling defaults and destructuring
  const paramList = cleanParams
    .split(",")
    .map((param) => {
      const trimmed = param.trim();

      // Handle destructuring - simplify the display
      if (trimmed.startsWith("{")) {
        const destructured = trimmed.match(/^\{([^}]*)\}/);
        if (destructured) {
          const fields = destructured[1]
            .split(",")
            .map((field) => field.trim().split("=")[0].trim())
            .join(", ");
          const defaultPart = trimmed.includes("=") ? " = {}" : "";
          return `{${fields}}${defaultPart}`;
        }
      }

      // Handle array destructuring
      if (trimmed.startsWith("[")) {
        return (
          trimmed.split("=")[0].trim() + (trimmed.includes("=") ? " = []" : "")
        );
      }

      // Handle rest parameters
      if (trimmed.startsWith("...")) {
        return trimmed;
      }

      // Handle regular parameters with defaults
      return trimmed;
    })
    .slice(1) // Remove first parameter (context 'c')
    .join(", ");

  return `${name}(${paramList})`;
}

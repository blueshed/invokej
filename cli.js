#!/usr/bin/env bun

import { readFileSync } from "fs";
import path from "path";
import { Context } from "./context.js";

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

if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
  printHelp(instance);
  process.exit(0);
}

if (argv.includes("-l") || argv.includes("--list")) {
  printTaskList(instance);
  process.exit(0);
}

if (argv.includes("--version")) {
  console.log(`Version 0.1.3`);
  process.exit(0);
}

const [subcommand, ...args] = argv;

const fn = instance[subcommand];
if (typeof fn !== "function") {
  console.error(`Unknown task "${subcommand}"\n`);
  printTaskList(instance);
  process.exit(1);
}

try {
  const result = await fn.apply(instance, [context, ...args]);
  if (result instanceof Promise) await result;
} catch (err) {
  console.error(`Error running "${subcommand}":`, err.message || err);
  process.exit(1);
}

function printTaskList(instance) {
  if (classDoc) {
    console.log(`${classDoc}\n`);
  }
  console.log("Available tasks:\n");

  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(instance),
  ).filter((m) => m !== "constructor" && typeof instance[m] === "function");

  for (const m of methods) {
    const doc = taskDocs[m] ?? "";
    console.log(`  ${m}${doc ? " — " + doc : ""}`);
  }
}

function printHelp(instance) {
  console.log(
    `invokej — JavaScript task runner inspired by Python Invoke — version 0.1.3\n`,
  );

  if (classDoc) {
    console.log(`${classDoc}\n`);
  }

  console.log("Available tasks:\n");

  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(instance),
  ).filter((m) => m !== "constructor" && typeof instance[m] === "function");

  for (const m of methods) {
    const doc = taskDocs[m] ?? "";
    console.log(`  ${m}${doc ? " — " + doc : ""}`);
  }

  console.log(`\nUsage:`);
  console.log(`  invokej <task> [args...]`);
  console.log(`  invokej -l           # list tasks`);
  console.log(`  invokej -h           # help`);
  console.log(`  invokej --version    # show version`);
  console.log(
    `\nFor more information about a specific task, run it with invalid arguments to see its usage.`,
  );
}

function loadTaskDocs(filePath) {
  const source = readFileSync(filePath, "utf-8");

  // Match class comment: /** comment */ export class Tasks
  const classRegex = /\/\*\*(.*?)\*\/\s*export\s+class\s+Tasks/s;
  const classMatch = classRegex.exec(source);
  const classDoc = classMatch
    ? classMatch[1].replace(/^\s*\*?\s?/gm, "").trim()
    : null;

  // Match method comments, but exclude the class comment by starting search after class declaration
  const classEnd = source.indexOf("export class Tasks");
  const methodSource = classEnd >= 0 ? source.substring(classEnd) : source;

  // Match: /** comment */ methodName(...) or /** comment */ async methodName(...)
  const regex = /\/\*\*(.*?)\*\/\s*(?:async\s+)?(\w+)\s*\(/gs;

  const docs = {};
  let match;

  while ((match = regex.exec(methodSource)) !== null) {
    const [, comment, name] = match;
    // Skip constructor and class name
    if (name !== "constructor" && name !== "Tasks") {
      docs[name] = comment.replace(/^\s*\*?\s?/gm, "").trim();
    }
  }

  return { taskDocs: docs, classDoc };
}

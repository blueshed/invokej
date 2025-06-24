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
const taskDocs = loadTaskDocs(tasksPath);

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
  console.log(`Version 0.1.0`);
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
  console.log("Available tasks:\n");

  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(instance),
  ).filter((m) => m !== "constructor" && typeof instance[m] === "function");

  for (const m of methods) {
    const doc = taskDocs[m] ?? "";
    console.log(`  ${m}${doc ? " — " + doc : ""}`);
  }

  console.log(`Usage:`);
  console.log(`  invokej <task> [args...]`);
  console.log(`  invokej -l           # list tasks`);
  console.log(`  invokej -h           # help`);
  console.log(`  invokej --version    # show version`);
}

function printHelp(instance) {
  console.log(
    `invokej — JavaScript task runner inspired by Python Invoke — version 0.1.0\n`,
  );
  printTaskList(instance);
}

function loadTaskDocs(filePath) {
  const source = readFileSync(filePath, "utf-8");

  // Match: /** comment */ methodName(...) or /** comment */ async methodName(...)
  const regex = /\/\*\*(.*?)\*\/\s*(?:async\s+)?(\w+)\s*\(/gs;

  const docs = {};
  let match;

  while ((match = regex.exec(source)) !== null) {
    const [, comment, name] = match;
    docs[name] = comment.trim().replace(/\s*\*\s*/g, " ");
  }

  return docs;
}

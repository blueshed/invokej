/**
 * Plugin exports for invokej
 *
 * This module re-exports all bundled plugins, making them easily accessible
 * when invokej is installed globally with `bun install -g invokej`
 *
 * Usage in tasks.js:
 *   import { ToDoManager, TodoUI } from "invokej/plugins";
 *   import { WorkAPI } from "invokej/plugins";
 *   import { WallNamespace } from "invokej/plugins";
 */

// Todo Manager Plugin
export { ToDoManager, TodoUI } from "./plugins/todo_mgr.js";

// Work Manager Plugin
export { WorkAPI } from "./plugins/work_mgr.js";

// Wall Context Manager Plugin
export {
  ContextWall,
  WallNamespace,
  createWallNamespace,
} from "./plugins/wall_mgr.js";

// Future plugins can be added here as they are created
// Example:
// export { GitFlow } from "./plugins/git_flow.js";
// export { DockerTasks } from "./plugins/docker_tasks.js";
// export { DatabaseMigrator } from "./plugins/db_migrate.js";

# Architecture

## Core Components

### 1. cli.js (15KB) - Main Entry Point

The CLI is responsible for:
- Loading user's `tasks.js` from current directory
- Parsing commands with namespace:method notation (e.g., `db:migrate`)
- Discovering tasks by walking prototype chain and instance properties
- Extracting JSDoc comments for help text
- Supports superclass task discovery (walks prototype chain)
- Private method/namespace filtering (anything starting with `_`)

### 2. context.js (2.7KB) - Context Object

Context object passed to all tasks with the following API:
- `c.run(command, options)` - Execute shell commands
- Options: `echo`, `hide`, `warn`, `cwd`, `pty`
- `c.cd(dir)` - Change directory context
- `c.sudo(command)` - Run with sudo

### 3. plugins.js - Plugin Re-exports

Re-exports bundled plugins for global installation:
- ToDoManager, TodoUI (todo_mgr.js)
- WorkAPI (work_mgr.js)
- AIWorkAPI, AIWorkNamespace (ai_work_mgr.js)
- ContextWall, WallNamespace (wall_mgr.js)

## Task Discovery Algorithm

The CLI discovers tasks in two places:

### 1. Root-level Methods
Walks prototype chain from instance to Object.prototype, collecting all non-private, non-constructor methods.

### 2. Namespaced Methods
Checks instance properties for objects with methods (e.g., `this.db = new DbNamespace()`).

Private methods/namespaces (starting with `_`) are automatically filtered from CLI.

## JSDoc Documentation System

- **Class-level comments**: Displayed at top of help output
- **Method-level comments**: First line becomes task description
- **Superclass support**: Reads parent class methods if Tasks extends another class
- **Implementation**: Uses regex to parse source code and extract comments within class boundaries

**Key implementation detail**: The doc parser finds the Tasks class, extracts content between its curly braces, then uses regex to match `/** comment */ methodName(` patterns.

## Namespace Support (v0.3.0+)

Tasks can be organized into namespaces:

```javascript
export class Tasks {
  constructor() {
    this.db = new DbNamespace();  // Creates db:* commands
    this._internal = new Internal();  // Hidden - starts with _
  }
}
```

Namespaces are discovered by checking instance properties for objects that have methods. The CLI generates commands like `invokej db:migrate`.

## Method Signature Extraction

The CLI displays method signatures in help output by:
1. Converting function to string with `fn.toString()`
2. Parsing parameters with regex (handles async, destructuring, defaults)
3. Removing first parameter (context `c`)
4. Cleaning up formatting

## Important Implementation Details

### Private Methods and Namespaces
- Anything starting with `_` is hidden from CLI
- Checked in multiple places: parseCommand, resolveMethod, discoverTasks
- Constructor method is also blocked from CLI invocation

### Command Resolution
1. Parse command (supports both `:` and `.` separators)
2. If namespace exists as property with the method, use it
3. Fallback: try underscore notation `namespace_method` (legacy, warns user)
4. If not found, show error and task list

### Plugin System Philosophy

Plugins are **utilities** that AI assistants integrate into user's tasks.js:
- Plugins export classes with clear APIs
- Users import from `invokej/plugins` when globally installed
- AI creates wrapper methods in Tasks class
- Users interact via CLI commands

This is NOT a plugin architecture where plugins auto-register. Users/AI explicitly wire up functionality.

## Key Design Patterns

1. **Class-based task definition**: Tasks are methods, not decorated functions
2. **Context object**: Every task receives `c` as first parameter
3. **Convention over configuration**: No config files, uses class structure and JSDoc
4. **Prototype walking**: Discovers methods through JavaScript's prototype chain
5. **Source code parsing**: Extracts docs by reading tasks.js as text and using regex

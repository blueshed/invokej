# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

invokej is a JavaScript/Bun task execution tool inspired by Python's Invoke. It allows users to define CLI-invokable tasks as methods in a `Tasks` class, with automatic CLI generation, JSDoc-based documentation extraction, and namespace support.

**Key Concept**: Users create a `tasks.js` file with a `Tasks` class, and invokej automatically converts methods into CLI commands.

## Development Commands

### Testing and Development
```bash
bun test                    # Run all tests (137 test cases)
bun test --watch            # Run tests in watch mode
bun test test/context.test.js   # Run specific test file
bun run test:plugins        # Run plugin tests only
bun run test:integration    # Run integration tests only
bun run dev                 # Run CLI locally
bun run example             # List example tasks
bun link                    # Link local version globally for testing
bun unlink                  # Unlink when done
```

### Publishing
```bash
# Version bump and publish to npm
npm version patch|minor|major
npm publish
```

## Architecture

### Core Components

1. **cli.js** (15KB) - Main entry point
   - Loads user's `tasks.js` from current directory
   - Parses commands with namespace:method notation (e.g., `db:migrate`)
   - Discovers tasks by walking prototype chain and instance properties
   - Extracts JSDoc comments for help text
   - Supports superclass task discovery (walks prototype chain)
   - Private method/namespace filtering (anything starting with `_`)
   
2. **context.js** (2.7KB) - Context object passed to all tasks
   - `c.run(command, options)` - Execute shell commands
   - Options: `echo`, `hide`, `warn`, `cwd`, `pty`
   - `c.cd(dir)` - Change directory context
   - `c.sudo(command)` - Run with sudo
   
3. **plugins.js** - Re-exports bundled plugins for global installation
   - ToDoManager, TodoUI (todo_mgr.js)
   - WorkAPI (work_mgr.js)
   - ContextWall, WallNamespace (wall_mgr.js)

### Task Discovery Algorithm

The CLI discovers tasks in two places:

1. **Root-level methods**: Walks prototype chain from instance to Object.prototype, collecting all non-private, non-constructor methods
2. **Namespaced methods**: Checks instance properties for objects with methods (e.g., `this.db = new DbNamespace()`)

Private methods/namespaces (starting with `_`) are automatically filtered from CLI.

### JSDoc Documentation System

- **Class-level comments**: Displayed at top of help output
- **Method-level comments**: First line becomes task description
- **Superclass support**: Reads parent class methods if Tasks extends another class
- **Implementation**: Uses regex to parse source code and extract comments within class boundaries

Key implementation detail: The doc parser finds the Tasks class, extracts content between its curly braces, then uses regex to match `/** comment */ methodName(` patterns.

### Namespace Support (v0.3.0+)

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

### Method Signature Extraction

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

## File Structure

```
/cli.js              - Main CLI entry point, task discovery, help generation
/context.js          - Context API for shell command execution
/plugins.js          - Plugin re-exports
/plugins/
  todo_mgr.js        - SQLite-based todo manager
  wall_mgr.js        - Project context tracking
  work_mgr.js        - Work session manager
/examples/
  basic.js           - Simple starter template
  with-namespaces.js - Advanced namespace example
  with-todo.js       - Todo plugin integration
  with-wall.js       - Wall plugin integration
/lib/
  init.js            - Project initialization templates
  plugin-catalog.js  - Plugin discovery and management
/test/
  context.test.js    - Context API tests (45+ tests)
  cli.test.js        - CLI and task discovery tests (52+ tests)
  todo-mgr.test.js   - Todo manager plugin tests (35+ tests)
  wall-mgr.test.js   - Wall manager plugin tests (25+ tests)
  integration/       - End-to-end integration tests (20+ tests)
  fixtures/          - Test fixtures for task definitions
```

## Key Design Patterns

1. **Class-based task definition**: Tasks are methods, not decorated functions
2. **Context object**: Every task receives `c` as first parameter
3. **Convention over configuration**: No config files, uses class structure and JSDoc
4. **Prototype walking**: Discovers methods through JavaScript's prototype chain
5. **Source code parsing**: Extracts docs by reading tasks.js as text and using regex

## Working with This Codebase

### Adding a New Plugin
1. Create plugin class in `plugins/your_plugin.js`
2. Export from `plugins.js`
3. Add example in `examples/with-your-plugin.js`
4. Update README.md plugin section

### Modifying Task Discovery
Task discovery happens in `discoverTasks()` in cli.js:
- Root tasks: Walk prototype chain collecting methods
- Namespaced tasks: Iterate instance properties looking for objects with methods
- Always filter out private methods/namespaces and constructor

### Changing Documentation Extraction
JSDoc parsing is in `loadTaskDocs()` in cli.js:
- Finds Tasks class in source code
- Handles superclass inheritance by importing parent file
- Uses regex to match `/** comment */ method(` patterns
- Extracts only content within Tasks class boundaries

## Testing

### Running Tests

The project has a comprehensive test suite with 137+ test cases:

```bash
# Run all tests
bun test

# Run specific test suites
bun test test/context.test.js      # Context API tests
bun test test/cli.test.js          # CLI and task discovery
bun test test/todo-mgr.test.js     # Todo plugin tests
bun test test/wall-mgr.test.js     # Wall plugin tests
bun test test/integration/         # Integration tests

# Run in watch mode
bun test --watch

# Using npm scripts
bun run test:context
bun run test:cli
bun run test:plugins
bun run test:integration
```

### Test Coverage

- **Context API**: Command execution, options, error handling, complex scenarios
- **CLI**: Task discovery, parsing, JSDoc extraction, private filtering
- **Plugins**: CRUD operations, statistics, formatting, validation
- **Integration**: Full CLI workflows, help/listing/execution, error handling

All tests use temporary databases and clean up after themselves. See `test/README.md` for detailed documentation.

### Testing Locally

```bash
# In the invokej directory
bun link

# Create a test tasks.js somewhere
cd /tmp
cat > tasks.js << 'EOF'
export class Tasks {
  async hello(c) {
    await c.run("echo 'Hello!'");
  }
}
EOF

# Test it
invj --list
invj hello

# Clean up
bun unlink
```

# invokej

A JavaScript/Bun implementation inspired by Python's [Invoke](https://www.pyinvoke.org/) - a task execution tool and library for managing shell-oriented subprocesses and organizing executable JavaScript code into CLI-invokable tasks.

## Installation

**Requires Bun to be installed first:**

```bash
# Install Bun first (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Then install invokej
bun install -g invokej
```

Or use with bunx:

```bash
bunx invokej --help
```

## Quick Start

1. Create a `tasks.js` file in your project root:

```javascript
export class Tasks {
  /** Say hello to someone */
  async hello(c, name = "World") {
    await c.run(`echo 'Hello, ${name}!'`);
  }

  /** Build the project */
  async build(c, env = "dev") {
    console.log(`Building for ${env}...`);
    await c.run("mkdir -p dist", { echo: true });
    await c.run(`echo 'Built for ${env}' > dist/build.txt`);
  }

  /** Clean build artifacts */
  async clean(c) {
    await c.run("rm -rf dist node_modules/.cache", { echo: true });
    console.log("Clean complete!");
  }
}
```

2. Run your tasks:

```bash
invokej --list           # List all available tasks
invokej hello            # Run the hello task
invokej hello "Alice"    # Run hello with an argument
invokej build prod       # Run build with env=prod

# Or use the short alias
invj --list
invj hello "Alice"
```

## Features

### 🚀 **Easy Task Definition**
Define tasks as methods in a `Tasks` class with automatic CLI generation.

### 🔧 **Powerful Context Object**
Every task receives a context object (`c`) with utilities for running shell commands:

```javascript
export class Tasks {
  async deploy(c) {
    // Run commands with different options
    await c.run("npm test", { echo: true });           // Show command
    await c.run("npm run build", { hide: true });      // Hide output
    await c.run("git push", { warn: true });           // Continue on failure
  }
}
```

### 📝 **Automatic Documentation**
Task descriptions are automatically extracted from JSDoc comments:

```javascript
/** Deploy the application to production */
async deploy(c, version = "latest") {
  // Task implementation
}
```

### ⚡ **Lightweight Distribution**
Small package size with fast startup and easy distribution.

### 🔒 **Private Methods**
Methods starting with underscore (`_`) are private and cannot be called from CLI:

```javascript
export class Tasks {
  /** Public task - visible in CLI */
  async build(c) {
    await this._validateEnvironment(c);
    await c.run("npm run build");
  }

  /** Private helper - hidden from CLI */
  async _validateEnvironment(c) {
    // Internal validation logic
  }
}
```

Private methods are automatically filtered from help output and CLI execution.

### 📁 **Namespaces (v0.3.0+)**
Organize related tasks into namespaces for better organization:

```javascript
export class Tasks {
  constructor() {
    // Initialize namespace objects
    this.db = new DbNamespace();
    this.git = new GitNamespace();
  }
  
  // Root-level task
  async build(c) {
    await c.run("npm run build");
  }
}

class DbNamespace {
  /** Run migrations */
  async migrate(c, direction = "up") {
    await c.run(`npm run db:migrate:${direction}`);
  }
  
  /** Seed database */
  async seed(c) {
    await c.run("npm run db:seed");
  }
}
```

Use namespaced tasks with colon notation:
```bash
invokej build           # Root task
invokej db:migrate      # Namespaced task
invokej db:seed         # Namespaced task
```

## Context API

The context object (`c`) provides methods for executing shell commands:

### `c.run(command, options)`

Execute a shell command with various options:

- `echo: true` - Print the command before executing
- `hide: true` - Capture output without displaying it
- `warn: true` - Don't fail the task if command fails
- `cwd: "/path"` - Set working directory

```javascript
async build(c) {
  // Basic command
  await c.run("npm install");

  // With options
  await c.run("npm test", {
    echo: true,    // Show: $ npm test
    warn: true     // Continue even if tests fail
  });

  // Capture output
  const result = await c.run("git rev-parse HEAD", { hide: true });
  console.log(`Current commit: ${result.stdout}`);
}
```

### Result Object

Commands return a result object:

```javascript
const result = await c.run("ls -la", { hide: true });
console.log(result.stdout);  // Command output
console.log(result.stderr);  // Error output
console.log(result.code);    // Exit code
console.log(result.ok);      // true if code === 0
console.log(result.failed);  // true if code !== 0
```

## CLI Usage

```bash
invokej [options] <task> [task-args...]
invokej [options] <namespace>:<task> [task-args...]
# or
invj [options] <task> [task-args...]
invj [options] <namespace>:<task> [task-args...]

Options:
  -l, --list     List available tasks
  -h, --help     Show help
  --version      Show version

Examples:
  invokej build                    # Run root task
  invj deploy prod                 # Run root task with args
  invokej db:migrate               # Run namespaced task
  invj git:feature auth            # Namespaced task with args
  invokej wall:session             # Start development session

Namespace Examples:
  invokej wall:show                # Show project wall
  invokej wall:add "Auth" "JWT"    # Add component to wall
  invokej todo:list                # List todos
  invokej db:reset                 # Reset database
```

**Note:** Methods starting with underscore (`_methodName`) are private and cannot be called from the command line.

## Examples

invokej includes several example configurations in the `examples/` directory:

### 📝 Basic Example (`examples/basic.js`)
Simple starter template with common tasks like build, test, and deploy.

```javascript
export class Tasks {
  /** Build the project */
  async build(c, env = "development") {
    console.log(`Building for ${env}...`);
    await c.run(`NODE_ENV=${env} npm run build`, { echo: true });
  }

  /** Run tests */
  async test(c) {
    await c.run("npm test", { echo: true });
  }
}
```

### ✅ Todo Plugin Example (`examples/with-todo.js`)
Shows how to use the built-in Todo manager plugin:

```bash
invokej add "Review PR" "Check pull request #42" 1
invokej list
invokej complete 1
invokej stats
```

### 🧱 Wall Plugin Example (`examples/with-wall.js`)
Demonstrates project context tracking with the Wall plugin:

```bash
invokej wall:session      # Start development session
invokej wall:focus "Working on auth"
invokej wall:add "User model" "Schema complete"
invokej wall:show         # View progress
```

### 📁 Advanced Namespaces (`examples/with-namespaces.js`)
Shows how to organize complex projects with namespaces:

```bash
invokej test              # Root task
invokej db:migrate        # Database namespace
invokej git:feature auth  # Git namespace
invokej wall:session      # Wall namespace
```

To use any example, copy it to your project as `tasks.js`:

```bash
cp node_modules/invokej/examples/basic.js tasks.js
# or for global installation
cp ~/.bun/install/global/node_modules/invokej/examples/basic.js tasks.js
```

## Comparison with Python Invoke

| Feature | Python Invoke | invokej |
|---------|---------------|---------|
| Task Definition | `@task` decorator | Class methods |
| Context Object | ✅ | ✅ |
| Shell Commands | `c.run()` | `c.run()` |
| CLI Generation | ✅ | ✅ |
| Task Documentation | ✅ | ✅ (JSDoc) |
| Task Dependencies | ✅ | 🚧 (roadmap) |
| Configuration | ✅ | 🚧 (roadmap) |
| Namespaces | ✅ | 🚧 (roadmap) |

## Requirements

- **Bun 1.0+** (required)
- Works on macOS, Linux, and Windows
- Node.js not required

## Contributing

Contributions welcome! This project aims to bring the simplicity and power of Python's Invoke to the JavaScript ecosystem.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Inspiration

This project is inspired by [Python Invoke](https://www.pyinvoke.org/) and aims to provide similar functionality for JavaScript/TypeScript projects.

## Plugin System

invokej supports a plugin system that allows you to extend functionality with reusable MCP.local utilities. Plugins provide core functionality that can be easily integrated into your tasks.js by AI assistants.

### Plugin Pattern

1. **Plugin Structure**: Plugins are JavaScript classes that provide specific functionality (database operations, API integrations, etc.)
2. **AI Integration**: Ask your AI assistant to integrate plugin functionality into your `tasks.js`
3. **Task Wrapping**: The AI creates wrapper methods in your Tasks class that use the plugin's API
4. **CLI Access**: Once integrated, you can use the functionality via `invokej` commands

### Available Plugins

#### Todo Manager (`plugins/todo_mgr.js`)
A SQLite-based todo management system with full CRUD operations, priority levels, due dates, and search functionality.

**Core Features:**
- Create, read, update, delete todos
- Priority levels (1-5)
- Due date tracking with overdue detection
- Search and filtering
- Statistics and reporting
- SQLite database with proper indexing

**Quick Start:**
See the `examples/` directory for complete working examples:
- `examples/basic.js` - Simple starter template
- `examples/with-todo.js` - Todo management integration
- `examples/with-wall.js` - Project context tracking
- `examples/with-namespaces.js` - Advanced namespace organization

### Using Plugins

1. **Import Plugins**: Simple import from `invokej/plugins` package
2. **Request Integration**: Ask your AI assistant to integrate specific plugin functionality  
3. **Customize Integration**: The AI will create task methods tailored to your workflow
4. **Use Via CLI**: Access the functionality through standard `invokej` commands

**Example usage:**
```javascript
// Import bundled plugins - works with global installation
import { ToDoManager, TodoUI, WorkAPI, WallNamespace } from "invokej/plugins";

// Using the Wall namespace for project context management
export class Tasks {
  constructor() {
    this.wall = new WallNamespace();
  }
}

// Available wall commands:
// invokej wall:session   - Start development session
// invokej wall:show      - Display project wall
// invokej wall:add       - Add completed component
// invokej wall:focus     - Set current focus
// invokej wall:fail      - Record failure and lesson
```

### Plugin Benefits

- **Modular**: Each plugin focuses on a specific domain
- **Reusable**: Same plugin can be integrated differently by different users
- **AI-Friendly**: Well-documented APIs that AI can easily understand and integrate
- **Extensible**: Easy to add new plugins for different functionalities
- **Persistent**: Database-backed plugins maintain state between runs

### Creating Custom Plugins

You can ask your AI assistant to create custom plugins for specific functionality you need:

```
"Create a plugin for managing Git repositories with methods to clone, commit, push, and check status"
```

Plugins should export classes with clear, well-documented APIs. Follow the pattern established by existing plugins:

```javascript
// plugins/my_plugin.js
export class MyUtility {
  constructor(config = {}) {
    // Initialize your utility
  }

  // Provide clear, focused methods
  async doSomething(param1, param2) {
    // Implementation
  }
}
```

The AI will then create appropriate wrapper methods in your Tasks class that use your plugin's functionality.

## Acknowledgments

- Special thanks to the developers of Python Invoke for their inspiration and guidance.
- This project was developed with assistance from AI tools (ChatGPT and Claude).

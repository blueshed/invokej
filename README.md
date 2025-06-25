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
# or
invj [options] <task> [task-args...]

Options:
  -l, --list     List available tasks
  -h, --help     Show help
  --version      Show version

Examples:
  invokej build                    # Run build task
  invj deploy prod                 # Run deploy with env=prod (short form)
  invokej test --coverage true     # Run test with coverage
```

**Note:** Methods starting with underscore (`_methodName`) are private and cannot be called from the command line.

## Task Examples

### Build System
```javascript
export class Tasks {
  /** Install dependencies */
  async install(c) {
    await c.run("npm install", { echo: true });
  }

  /** Run tests with optional coverage */
  async test(c, coverage = "false") {
    const cmd = coverage === "true" ? "npm run test:coverage" : "npm test";
    await c.run(cmd, { echo: true });
  }

  /** Build for production */
  async build(c) {
    await this._validateEnvironment(c);
    await c.run("npm run build", { echo: true });
    console.log("✅ Build complete!");
  }

  /** Deploy to production */
  async deploy(c, env = "staging") {
    // Run tests first
    await this.test(c);

    // Build
    await this.build(c);

    // Deploy with environment validation
    await this._checkDeploymentReadiness(c, env);
    await c.run(`npm run deploy:${env}`, { echo: true });
    console.log(`🚀 Deployed to ${env}!`);
  }

  /** Private: Validate build environment */
  async _validateEnvironment(c) {
    const result = await c.run("node --version", { hide: true });
    console.log(`Node version: ${result.stdout.trim()}`);
  }

  /** Private: Check if ready for deployment */
  async _checkDeploymentReadiness(c, env) {
    if (env === "production") {
      await c.run("npm audit --audit-level high", { echo: true });
    }
  }
}
```

### Docker Workflow
```javascript
export class Tasks {
  /** Build Docker image */
  async docker_build(c, tag = "latest") {
    await c.run(`docker build -t myapp:${tag} .`, { echo: true });
  }

  /** Run Docker container */
  async docker_run(c, port = "3000") {
    await c.run(`docker run -p ${port}:3000 myapp:latest`, { echo: true });
  }

  /** Push to registry */
  async docker_push(c, tag = "latest") {
    await c.run(`docker push myapp:${tag}`, { echo: true });
  }
}
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

**Example AI Integration Request:**
```
"Add todo management functionality to my tasks.js using the todo_mgr plugin"
```

**Resulting CLI Usage:**
```bash
invj add-todo "Review project proposal" "Need to finish by Friday" 2 "2024-01-15"
invj list-todos pending priority
invj complete-todo 5
invj search-todos "meeting"
invj todo-stats
invj clear-completed
```

### Using Plugins

1. **Browse Available Plugins**: Check the `plugins/` directory for available utilities
2. **Request Integration**: Ask your AI assistant to integrate specific plugin functionality
3. **Customize Integration**: The AI will create task methods tailored to your workflow
4. **Use Via CLI**: Access the functionality through standard `invokej` commands

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

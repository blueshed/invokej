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

## Acknowledgments

- Special thanks to the developers of Python Invoke for their inspiration and guidance.
- This project was developed with assistance from AI tools (ChatGPT and Claude).

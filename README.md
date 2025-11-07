# invokej

**Turn your JavaScript into powerful CLI commands. No config files. Just code.**

Build task runners, deployment pipelines, and project automation tools with the simplicity of Python's Invoke, powered by Bun's speed.

```bash
bun install -g invokej
```

[![npm version](https://badge.fury.io/js/invokej.svg)](https://www.npmjs.com/package/invokej)
[![Tests](https://img.shields.io/badge/tests-198%20passing-brightgreen)](https://github.com/blueshed/invokej)

## Why invokej?

### No More Config File Hell
```javascript
// tasks.js - That's it. No JSON, YAML, or endless configuration.
export class Tasks {
  async deploy(c) {
    await c.run("npm test && npm run build");
    await c.run("rsync -av dist/ server:/var/www/");
  }
}
```

```bash
invj deploy  # Done.
```

### The Invokej Difference

| Feature | invokej | npm scripts | Makefiles | Gulp/Grunt |
|---------|---------|-------------|-----------|------------|
| **Language** | Pure JavaScript | JSON strings | Make syntax | JavaScript + config |
| **Setup** | One file | package.json | Makefile | Gulpfile + config |
| **Documentation** | Auto from JSDoc | Manual | Manual | Manual |
| **Shell utilities** | Built-in `c.run()` | Raw commands | Shell scripting | Plugin hell |
| **Type safety** | ✅ | ❌ | ❌ | Partial |
| **AI Memory** | ✅ Unique! | ❌ | ❌ | ❌ |
| **Speed** | ⚡ Bun | Node.js | Native | Node.js |

### 🧠 Unique: AI Memory System

**The Problem:** AI assistants have no memory between sessions. Every conversation starts from zero.

**The Solution:** invokej's plugins create a persistent, queryable knowledge base that ANY AI can access via bash:

```bash
# Instead of repeating yourself every session:
invj ai:context              # AI loads full project context
invj ai:patternSearch auth   # "We use JWT with refresh tokens"
invj wall:rubble             # "Don't use polling, too slow"
invj ai:decisionShow 5       # See ALL options considered, not just what was chosen
```

Built-in plugins track:
- ✅ What works (patterns with success rates)
- ❌ What failed (lessons learned from failures)
- 🤔 Why decisions were made (full decision trees)
- 📍 Where code lives (component mapping)
- 📸 Project state at key moments (snapshots)

All stored in **local SQLite**. No cloud. No rate limits. No cost.

[Read more about AI memory →](docs/quick-start-for-ai.md)

## Quick Start

**1. Install:**
```bash
# Install Bun first (if needed)
curl -fsSL https://bun.sh/install | bash

# Then install invokej
bun install -g invokej
```

**2. Create `tasks.js`:**
```javascript
export class Tasks {
  /** Say hello */
  async hello(c, name = "World") {
    await c.run(`echo 'Hello, ${name}!'`);
  }

  /** Build the project */
  async build(c, env = "dev") {
    console.log(`Building for ${env}...`);
    await c.run("mkdir -p dist", { echo: true });
    await c.run(`echo 'Built for ${env}' > dist/build.txt`);
  }
}
```

**3. Run:**
```bash
invj --list           # See all tasks
invj hello            # Hello, World!
invj hello Alice      # Hello, Alice!
invj build prod       # Build for production
```

That's it. No configuration needed.

## Features That Make Life Easy

### 🚀 Automatic CLI Generation
Methods become commands. JSDoc becomes help text. It just works.

```javascript
/** Deploy to production
 *  Runs tests, builds, and deploys to server
 */
async deploy(c, target = "staging") {
  // Your code
}
```

```bash
$ invj --help
deploy(target = "staging") — Deploy to production
```

### 🔧 Powerful Context Object
Every task gets `c` with battle-tested shell utilities:

```javascript
async deploy(c) {
  // Show command before running
  await c.run("npm test", { echo: true });
  
  // Continue even if it fails
  await c.run("npm run lint", { warn: true });
  
  // Capture output
  const { stdout } = await c.run("git rev-parse HEAD", { hide: true });
  console.log(`Deploying ${stdout.trim()}`);
}
```

### 📁 Smart Organization with Namespaces
Group related tasks. Keep things clean.

```javascript
export class Tasks {
  constructor() {
    this.db = new Database();
    this.git = new Git();
  }
}

class Database {
  /** Run migrations */
  async migrate(c) { /* ... */ }
  
  /** Seed database */
  async seed(c) { /* ... */ }
}
```

```bash
invj db:migrate     # Organized!
invj db:seed
invj git:feature auth
```

### 🔒 Privacy Built-in
Prefix with `_` to hide from CLI:

```javascript
export class Tasks {
  /** Public task */
  async deploy(c) {
    await this._validateEnv(c);  // Can call internally
    await c.run("npm run deploy");
  }
  
  /** Private helper - not accessible via CLI */
  async _validateEnv(c) {
    // Internal validation
  }
}
```

```bash
invj deploy        # ✅ Works
invj _validateEnv  # ❌ Blocked
```

### ⚡ Fast
Powered by Bun. Starts instantly. Runs fast.

## Real-World Examples

### Simple Build Pipeline
```javascript
export class Tasks {
  async test(c) {
    await c.run("bun test", { echo: true });
  }
  
  async build(c) {
    await this.test(c);  // Run tests first
    await c.run("bun run build", { echo: true });
  }
  
  async deploy(c) {
    await this.build(c);  // Build first
    await c.run("rsync -av dist/ server:/var/www/", { echo: true });
  }
}
```

### Docker Workflow
```javascript
export class Tasks {
  constructor() {
    this.docker = new Docker();
  }
}

class Docker {
  async build(c, tag = "latest") {
    await c.run(`docker build -t myapp:${tag} .`, { echo: true });
  }
  
  async run(c, port = 3000) {
    await c.run(`docker run -p ${port}:3000 myapp`, { echo: true });
  }
  
  async push(c, tag = "latest") {
    await c.run(`docker push myapp:${tag}`, { echo: true });
  }
}
```

### AI-Enhanced Development
```javascript
import { AIWorkNamespace } from "invokej/plugins";

export class Tasks {
  constructor() {
    this.ai = new AIWorkNamespace("work.db");
  }
  
  // 30+ AI commands available via `invj ai:*`
  // Full project memory, pattern library, decision tracking
}
```

```bash
invj ai:projectCreate "My App"
invj ai:setProject 1
invj ai:sessionStart claude-3.5-sonnet "Add auth"
invj ai:context              # Load everything
invj ai:patternSearch auth   # Find relevant patterns
invj ai:sessionEnd "Auth complete"
```

## Context API Reference

### `c.run(command, options)`

| Option | Type | Description |
|--------|------|-------------|
| `echo` | boolean | Print command before executing |
| `hide` | boolean | Capture output without displaying |
| `warn` | boolean | Don't fail task if command fails |
| `cwd` | string | Working directory for command |
| `pty` | boolean | Run in pseudo-terminal |

**Returns:** `{ stdout, stderr, code, ok, failed }`

```javascript
// Basic usage
await c.run("npm install");

// Show command
await c.run("npm test", { echo: true });

// Capture output
const result = await c.run("git status", { hide: true });
if (result.ok) {
  console.log("Clean working directory");
}

// Continue on failure
await c.run("npm run lint", { warn: true });
```

## Bundled Plugins

invokej includes powerful plugins that work out of the box:

### 🧠 AI Work Manager
Track projects, sessions, patterns, and decisions. Give AI assistants persistent memory.

```bash
invj ai:projectCreate "My App"
invj ai:sessionStart "Add feature"
invj ai:patternAdd "Error Handling" "Use ErrorBoundary"
invj ai:context  # Show everything
```

[AI Plugin Guide →](docs/quick-start-for-ai.md)

### 🧱 Wall Manager
Track project progress with a building metaphor. Foundation → Wall → Edge → Rubble.

```bash
invj wall:session    # Start development
invj wall:add "Auth System" "Complete"
invj wall:focus "Working on API"
invj wall:fail "Polling approach" "Too slow, use WebSockets"
```

### ✅ Todo Manager
SQLite-based task management with priorities and due dates.

```bash
invj todo:add "Fix bug" "Priority bug in auth" 1
invj todo:list
invj todo:complete 1
```

### 📦 Work Manager
Base project and task tracking system.

See [examples/](examples/) for complete integration examples.

## CLI Usage

```bash
invokej [options] <task> [args...]
invj [options] <namespace>:<task> [args...]  # Short alias

Options:
  -l, --list     List all tasks
  -h, --help     Show help
  --version      Show version

Examples:
  invj --list              # See all tasks
  invj build               # Run task
  invj deploy prod         # Task with arguments
  invj db:migrate          # Namespaced task
  invj ai:context          # AI plugin
```

## Installation Options

### Global (Recommended)
```bash
bun install -g invokej
invj --list
```

### Local Development
```bash
git clone https://github.com/blueshed/invokej.git
cd invokej
bun install
bun link              # Link globally for testing
bun test              # Run 198 tests
```

### With bunx (No Install)
```bash
bunx invokej --help
```

## Requirements

- **Bun 1.0+** - [Install Bun](https://bun.sh)
- Works on macOS, Linux, and Windows (WSL)
- Node.js not required

## Documentation

- **[Quick Start for AI](docs/quick-start-for-ai.md)** - AI memory system guide
- **[Architecture](docs/architecture.md)** - How it works
- **[Testing Guide](docs/testing.md)** - Development and testing
- **[Roadmap](docs/roadmap.md)** - Future plans

## Examples

Check out the [examples/](examples/) directory:

- `basic.js` - Simple starter template
- `with-namespaces.js` - Advanced organization
- `with-todo.js` - Todo plugin integration
- `with-wall.js` - Project tracking
- `with-ai-work.js` - AI memory system

Copy any example to get started:
```bash
cp node_modules/invokej/examples/basic.js tasks.js
```

## Contributing

Contributions welcome! See our [testing guide](docs/testing.md).

```bash
git clone https://github.com/blueshed/invokej.git
cd invokej
bun install
bun test              # 198 tests must pass
bun link              # Test locally
```

## Comparison with Alternatives

### vs npm scripts
- ✅ Real JavaScript instead of JSON strings
- ✅ Type safety and IDE support
- ✅ Reusable code across tasks
- ✅ Built-in documentation
- ✅ AI memory plugins

### vs Make
- ✅ No shell scripting required
- ✅ Cross-platform compatibility
- ✅ Modern JavaScript syntax
- ✅ Better error handling

### vs Gulp/Grunt
- ✅ Zero configuration
- ✅ No plugin ecosystem to learn
- ✅ Simpler mental model
- ✅ Faster startup (Bun)

## Why "invokej"?

Invoke + JavaScript = invokej. Inspired by Python's excellent [Invoke](https://www.pyinvoke.org/) library, bringing the same simplicity and power to the JavaScript ecosystem.

## License

MIT License - see [LICENSE](LICENSE) file

## Links

- [GitHub](https://github.com/blueshed/invokej)
- [npm](https://www.npmjs.com/package/invokej)
- [Documentation](docs/)
- [Examples](examples/)

---

**Built with 💙 by developers, for developers. Enhanced with 🤖 AI assistance from Claude and ChatGPT.**

**Star us on GitHub if invokej makes your life easier! ⭐**

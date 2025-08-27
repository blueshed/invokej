# invokej Examples

This directory contains example `tasks.js` configurations demonstrating different features and use cases of invokej.

## Available Examples

### 🎯 `basic.js`
**Simple starter template** with common tasks like build, test, deploy, and clean.

Perfect for:
- Getting started with invokej
- Simple Node.js projects
- Learning the basics

```bash
# Copy to your project:
cp examples/basic.js tasks.js

# Try it:
invokej hello
invokej test
invokej build production
```

### ✅ `with-todo.js`
**Todo management example** using the built-in Todo plugin.

Perfect for:
- Personal task tracking
- Project management
- Learning plugin usage

```bash
# Copy to your project:
cp examples/with-todo.js tasks.js

# Try it:
invokej add "Review code" "PR #42 needs review" 1
invokej list
invokej complete 1
invokej stats
```

### 🧱 `with-wall.js`
**Project context tracking** using the Wall plugin to maintain development context.

Perfect for:
- Long-running projects
- Team development
- AI-assisted coding (maintains context between sessions)
- Tracking architectural decisions

```bash
# Copy to your project:
cp examples/with-wall.js tasks.js

# Try it:
invokej wall:session          # See where you left off
invokej wall:focus "Adding user auth"
invokej wall:add "Database" "PostgreSQL schema complete"
invokej wall:show             # Visualize progress
```

### 📁 `with-namespaces.js`
**Advanced namespace organization** for complex projects with multiple concerns.

Perfect for:
- Large projects
- Monorepos
- Projects with many tasks
- Avoiding naming conflicts

```bash
# Copy to your project:
cp examples/with-namespaces.js tasks.js

# Try it:
invokej test                  # Root-level task
invokej db:migrate           # Database namespace
invokej git:feature auth     # Git namespace
invokej wall:session         # Wall namespace
```

## Using Examples

### Option 1: Copy Directly
```bash
# From your project directory
cp node_modules/invokej/examples/basic.js tasks.js
```

### Option 2: Global Installation
If invokej is installed globally:
```bash
cp ~/.bun/install/global/node_modules/invokej/examples/basic.js tasks.js
```

### Option 3: View and Customize
1. Browse the examples to understand the patterns
2. Create your own `tasks.js` combining features you need
3. Mix and match namespaces and plugins as needed

## Creating Your Own

Start with `basic.js` and gradually add features:

1. **Start simple** - Basic tasks for your workflow
2. **Add plugins** - Import and use built-in plugins
3. **Create namespaces** - Organize related tasks
4. **Combine patterns** - Mix approaches as needed

## Tips

- Methods starting with `_` are private and won't be exposed to CLI
- Use JSDoc comments (`/** */`) for task descriptions
- Namespaces are just classes assigned to properties
- The context object `c` provides shell command execution
- Tasks can call other tasks using `await this.taskname(c)`

## Need Help?

- Run `invokej --help` to see available options
- Run `invokej --list` to see all tasks
- Check the main README for detailed documentation
- Visit https://github.com/blueshed/invokej for more information
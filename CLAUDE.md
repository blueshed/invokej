# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

invokej is a JavaScript/Bun task execution tool inspired by Python's Invoke. It allows users to define CLI-invokable tasks as methods in a `Tasks` class, with automatic CLI generation, JSDoc-based documentation extraction, and namespace support.

**Key Concept**: Users create a `tasks.js` file with a `Tasks` class, and invokej automatically converts methods into CLI commands.

## Quick Reference

### Development Commands

```bash
# Testing
bun test                    # Run all tests (198 test cases)
bun test --watch            # Run tests in watch mode
bun test test/file.test.js  # Run specific test file
bun run test:plugins        # Run plugin tests only
bun run test:integration    # Run integration tests only

# Development
bun run dev                 # Run CLI locally
bun run example             # List example tasks
bun link                    # Link local version globally for testing
bun unlink                  # Unlink when done

# Publishing
npm version patch|minor|major
npm publish
```

### Testing Changes

See [docs/testing.md](docs/testing.md) for comprehensive testing guide.

**Quick workflow for testing changes:**

1. Make your changes
2. Run relevant tests: `bun test test/your-feature.test.js`
3. Link and test locally:
   ```bash
   bun link
   cd /tmp && cat > tasks.js << 'EOF'
   import { YourPlugin } from "invokej/plugins";
   export class Tasks {
     constructor() { this.plugin = new YourPlugin(); }
   }
   EOF
   invj --list  # Verify commands
   invj plugin:command  # Test execution
   ```
4. Run full test suite: `bun test`
5. Clean up: `bun unlink`

All 198 tests must pass before merging.

## Documentation

Detailed documentation is organized in the `docs/` folder:

### For AI Assistants
- **[docs/quick-start-for-ai.md](docs/quick-start-for-ai.md)** - Complete guide to invokej's AI memory system (copy to new sessions)
- **[docs/ai-plugin-analysis.md](docs/ai-plugin-analysis.md)** - Deep dive into AI plugin architecture and design rationale

### For Developers
- **[docs/architecture.md](docs/architecture.md)** - System architecture, design patterns, and implementation details
- **[docs/testing.md](docs/testing.md)** - Comprehensive testing guide, workflows, and best practices
- **[docs/file-structure.md](docs/file-structure.md)** - Project file organization and naming conventions
- **[docs/roadmap.md](docs/roadmap.md)** - Future development plans and feature roadmap

## Working with This Codebase

### Adding a New Plugin

1. Create plugin class in `plugins/your_plugin.js`
2. Export from `plugins.js`:
   ```javascript
   export { YourPlugin, YourNamespace } from "./plugins/your_plugin.js";
   ```
3. Add example in `examples/with-your-plugin.js`
4. Add tests in `test/your-plugin.test.js`
5. Update README.md plugin section

### Modifying Task Discovery

Task discovery happens in `discoverTasks()` in cli.js:
- Root tasks: Walk prototype chain collecting methods
- Namespaced tasks: Iterate instance properties looking for objects with methods
- Always filter out private methods/namespaces (starting with `_`) and constructor

See [docs/architecture.md](docs/architecture.md) for detailed explanation.

### Changing Documentation Extraction

JSDoc parsing is in `loadTaskDocs()` in cli.js:
- Finds Tasks class in source code
- Handles superclass inheritance by importing parent file
- Uses regex to match `/** comment */ method(` patterns
- Extracts only content within Tasks class boundaries

## Key Implementation Details

### Private Methods and Namespaces
Anything starting with `_` is hidden from CLI. This is checked in:
- `parseCommand()` - Command parsing
- `resolveMethod()` - Method resolution
- `discoverTasks()` - Task discovery
- Constructor method is also blocked

### Command Resolution Order
1. Parse command (supports both `:` and `.` separators)
2. If namespace exists as property with the method, use it
3. Fallback: try underscore notation `namespace_method` (legacy, warns user)
4. If not found, show error and task list

### Plugin Philosophy

Plugins are **utilities** that users/AI assistants integrate into tasks.js:
- Plugins export classes with clear APIs
- Users import from `invokej/plugins` when globally installed
- Users/AI create wrapper methods in Tasks class
- Users interact via CLI commands

This is NOT auto-registration. Users explicitly wire up functionality.

## Design Patterns

1. **Class-based task definition** - Tasks are methods, not decorated functions
2. **Context object** - Every task receives `c` as first parameter  
3. **Convention over configuration** - No config files, uses class structure and JSDoc
4. **Prototype walking** - Discovers methods through JavaScript's prototype chain
5. **Source code parsing** - Extracts docs by reading tasks.js as text and using regex

## Test Coverage Summary

- **Context API** - Command execution, options, error handling (45+ tests)
- **CLI** - Task discovery, parsing, JSDoc extraction, private filtering (52+ tests)
- **Plugins** - CRUD operations, statistics, formatting, validation (100+ tests)
- **Integration** - Full CLI workflows, help/listing/execution, error handling (20+ tests)

**Total: 198 tests across 8 files**

All tests use temporary databases and clean up after themselves.

## Need More Details?

Check the docs folder:
- Architecture details → [docs/architecture.md](docs/architecture.md)
- Testing workflows → [docs/testing.md](docs/testing.md)
- File organization → [docs/file-structure.md](docs/file-structure.md)

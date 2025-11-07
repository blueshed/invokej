# File Structure

```
invokej/
├── cli.js              - Main CLI entry point, task discovery, help generation
├── context.js          - Context API for shell command execution
├── plugins.js          - Plugin re-exports for global installation
├── package.json        - Project metadata and dependencies
├── README.md           - User-facing documentation
├── CLAUDE.md           - AI assistant guidance (this file)
│
├── docs/               - Documentation
│   ├── architecture.md - System architecture and design
│   ├── testing.md      - Testing guide and best practices
│   └── file-structure.md - This file
│
├── plugins/            - Bundled plugins
│   ├── todo_mgr.js     - SQLite-based todo manager
│   ├── wall_mgr.js     - Project context tracking
│   ├── work_mgr.js     - Work/task manager (base class)
│   └── ai_work_mgr.js  - AI-enhanced work manager
│
├── examples/           - Example task files
│   ├── basic.js        - Simple starter template
│   ├── with-namespaces.js - Advanced namespace example
│   ├── with-todo.js    - Todo plugin integration
│   ├── with-wall.js    - Wall plugin integration
│   └── with-ai-work.js - AI work plugin integration
│
├── lib/                - Supporting libraries
│   ├── init.js         - Project initialization templates
│   └── plugin-catalog.js - Plugin discovery and management
│
└── test/               - Test suite
    ├── context.test.js - Context API tests (45+ tests)
    ├── cli.test.js     - CLI and task discovery tests (52+ tests)
    ├── todo-mgr.test.js - Todo plugin tests (35+ tests)
    ├── wall-mgr.test.js - Wall plugin tests (25+ tests)
    ├── ai-work-mgr.test.js - AI work plugin tests (54+ tests)
    ├── ai-workflow.test.js - AI workflow integration tests
    ├── integration/    - End-to-end integration tests (20+ tests)
    │   └── e2e.test.js - Full CLI workflow tests
    └── fixtures/       - Test fixtures for task definitions
        ├── basic-tasks.js
        ├── namespace-tasks.js
        └── inheritance-tasks.js
```

## Key Files

### Core Files
- **cli.js** (15KB) - The heart of invokej, handles all CLI operations
- **context.js** (2.7KB) - Provides the context API for task execution
- **plugins.js** - Central export point for all bundled plugins

### Plugin Files
Each plugin is self-contained and exports classes:
- **todo_mgr.js** - Todo list management with SQLite
- **wall_mgr.js** - Context wall for tracking project knowledge
- **work_mgr.js** - Base work/task manager with project tracking
- **ai_work_mgr.js** - AI-enhanced work manager extending WorkAPI

### Test Files
All test files follow the pattern `*.test.js` and use Bun's test runner.

## Adding New Files

When adding new files to the project:

1. **Plugins** go in `plugins/` and must be exported from `plugins.js`
2. **Examples** go in `examples/` with descriptive names
3. **Tests** go in `test/` with the pattern `feature-name.test.js`
4. **Documentation** goes in `docs/` with descriptive markdown files
5. **Utilities** go in `lib/` for supporting code

## File Naming Conventions

- Use kebab-case for file names: `my-feature.js`
- Test files: `feature-name.test.js`
- Example files: `with-feature-name.js`
- Plugin files: `feature_mgr.js` (using underscores for historical consistency)

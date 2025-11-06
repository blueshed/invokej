# invokej Test Suite

This directory contains comprehensive tests for the invokej project.

## Test Structure

```
test/
├── README.md                 # This file
├── context.test.js           # Tests for Context API
├── cli.test.js              # Tests for CLI and task discovery
├── todo-mgr.test.js         # Tests for todo manager plugin
├── wall-mgr.test.js         # Tests for wall manager plugin
├── fixtures/                # Test fixtures
│   ├── simple-tasks.js      # Basic task definitions
│   ├── namespaced-tasks.js  # Namespace examples
│   └── inherited-tasks.js   # Class inheritance examples
└── integration/             # Integration tests
    └── end-to-end.test.js   # Full CLI workflow tests

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test test/context.test.js

# Run tests in watch mode
bun test --watch

# Run tests with coverage (if configured)
bun test --coverage
```

## Test Coverage

The test suite covers:

### Core Functionality
- ✅ Context API command execution
- ✅ Command options (echo, hide, warn, cwd)
- ✅ Result objects and error handling
- ✅ Complex command scenarios (pipes, redirects, environment variables)

### CLI Features
- ✅ Task discovery (root-level, namespaced, inherited)
- ✅ Command parsing (colon and dot notation)
- ✅ JSDoc documentation extraction
- ✅ Method signature parsing
- ✅ Private method/namespace filtering
- ✅ Task execution with arguments

### Plugins
- ✅ ToDoManager - CRUD operations, search, statistics
- ✅ TodoUI - formatting, validation, display utilities
- ✅ ContextWall - foundation, wall, edge, rubble, focus
- ✅ WallNamespace - all CLI commands

### Integration
- ✅ End-to-end CLI execution
- ✅ Help and version display
- ✅ Task listing and execution
- ✅ Error handling
- ✅ Class inheritance

## Writing New Tests

When adding new features, please add corresponding tests:

1. **Unit tests**: Test individual functions/methods in isolation
2. **Integration tests**: Test complete workflows
3. **Fixtures**: Add test data in `fixtures/` directory

### Example Test Structure

```javascript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe("Sub-feature", () => {
    test("should do something", () => {
      // Arrange
      const input = "test";

      // Act
      const result = someFunction(input);

      // Assert
      expect(result).toBe("expected");
    });
  });
});
```

## Test Database Cleanup

Tests that use SQLite databases create temporary files in `/tmp/`.
Each test properly cleans up after itself using `beforeEach` and `afterEach` hooks.

## CI/CD Integration

These tests are designed to run in CI/CD pipelines. Ensure:
- All tests pass before merging
- No test databases or temporary files are committed
- Tests are deterministic and don't rely on external services

## Troubleshooting

### Tests fail with "bun: command not found"
Install Bun: `curl -fsSL https://bun.sh/install | bash`

### Database locked errors
Ensure previous test runs cleaned up properly. Check for stray `.db` files in `/tmp/`

### Permission errors
Some tests need write access to `/tmp/`. Ensure your system allows this.

## Contributing

When contributing:
1. Write tests for new features
2. Ensure all tests pass: `bun test`
3. Maintain test coverage above 80%
4. Add integration tests for user-facing features

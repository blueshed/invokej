# Testing Guide

## Running Tests

The project has a comprehensive test suite with 198+ test cases covering all functionality.

### Quick Start

```bash
# Run all tests
bun test

# Run in watch mode
bun test --watch
```

### Test Suites

```bash
# Context API tests (45+ tests)
bun test test/context.test.js
bun run test:context

# CLI and task discovery tests (52+ tests)
bun test test/cli.test.js
bun run test:cli

# Plugin tests (100+ tests)
bun test test/todo-mgr.test.js    # Todo plugin
bun test test/wall-mgr.test.js    # Wall plugin
bun test test/ai-work-mgr.test.js # AI Work plugin
bun run test:plugins              # All plugin tests

# Integration tests (20+ tests)
bun test test/integration/
bun run test:integration
```

## Test Coverage

### Context API Tests
- Command execution with various options
- Error handling and exit codes
- Complex command scenarios
- Directory context (`c.cd()`)
- Sudo command execution

### CLI Tests
- Task discovery (root and namespaced)
- Command parsing
- JSDoc extraction
- Private method/namespace filtering
- Help and listing output
- Superclass inheritance

### Plugin Tests
- CRUD operations
- Statistics and formatting
- Data validation
- Database operations
- CLI command integration

### Integration Tests
- Full CLI workflows
- Help/listing/execution flows
- Error handling
- Class inheritance
- End-to-end command execution

## Testing Locally

### Using bun link

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

### Testing Plugin Changes

When modifying plugins, follow this workflow:

1. Make your changes to the plugin file
2. Run the specific plugin tests:
   ```bash
   bun test test/your-plugin.test.js
   ```
3. Link locally to test CLI integration:
   ```bash
   bun link
   cd /tmp
   # Create test tasks.js that uses your plugin
   invj --list  # Verify commands appear
   invj your:command  # Test execution
   bun unlink
   ```
4. Run full test suite before committing:
   ```bash
   bun test
   ```

### Testing New Features

1. **Write tests first** - Add test cases to the appropriate test file
2. **Run tests** - Verify they fail as expected
3. **Implement feature** - Write the code
4. **Verify tests pass** - Run tests again
5. **Test locally with bun link** - Verify CLI integration
6. **Run full suite** - Ensure no regressions

## Test Structure

All tests use temporary databases and clean up after themselves:

```javascript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("My Feature", () => {
  let tempDb;
  
  beforeEach(() => {
    tempDb = `/tmp/test-${Date.now()}.db`;
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  it("should do something", () => {
    // Test implementation
  });
});
```

## Continuous Integration

Tests should pass on all supported platforms:
- macOS
- Linux
- Windows (via WSL)

All 198 tests must pass before merging PRs.

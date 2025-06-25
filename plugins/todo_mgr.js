import { Database } from "bun:sqlite";

// Todo database schema
const TODO_SCHEMA = `
  CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT FALSE,
      priority INTEGER DEFAULT 1 CHECK (priority IN (1, 2, 3, 4, 5)),
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
  CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

  CREATE TRIGGER IF NOT EXISTS update_todos_updated_at
      AFTER UPDATE ON todos
      FOR EACH ROW
  BEGIN
      UPDATE todos SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
`;

/**
 * ToDoManager - Core database and business logic
 */
export class ToDoManager {
  constructor(dbPath = "todos.db") {
    this.db = new Database(dbPath);
    this.db.exec(TODO_SCHEMA);
  }

  addTodo(title, description = "", priority = 3, dueDate = null) {
    const stmt = this.db.prepare(`
      INSERT INTO todos (title, description, priority, due_date)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(title, description, priority, dueDate).lastInsertRowid;
  }

  getTodos(status = "all", sortBy = "priority") {
    let query = "SELECT * FROM todos";

    if (status === "completed") query += " WHERE completed = 1";
    else if (status === "pending") query += " WHERE completed = 0";

    const sortOptions = {
      priority: "ORDER BY priority ASC, created_at DESC",
      date: "ORDER BY due_date ASC, priority ASC",
      created: "ORDER BY created_at DESC",
      updated: "ORDER BY updated_at DESC",
    };

    query += " " + (sortOptions[sortBy] || sortOptions.priority);
    return this.db.prepare(query).all();
  }

  getTodo(id) {
    return this.db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
  }

  completeTodo(id) {
    return (
      this.db.prepare("UPDATE todos SET completed = 1 WHERE id = ?").run(id)
        .changes > 0
    );
  }

  uncompleteTodo(id) {
    return (
      this.db.prepare("UPDATE todos SET completed = 0 WHERE id = ?").run(id)
        .changes > 0
    );
  }

  deleteTodo(id) {
    return (
      this.db.prepare("DELETE FROM todos WHERE id = ?").run(id).changes > 0
    );
  }

  updateTodo(id, field, value) {
    return (
      this.db
        .prepare(`UPDATE todos SET ${field} = ? WHERE id = ?`)
        .run(value, id).changes > 0
    );
  }

  clearCompleted() {
    return this.db.prepare("DELETE FROM todos WHERE completed = 1").run()
      .changes;
  }

  searchTodos(query) {
    const pattern = `%${query}%`;
    return this.db
      .prepare(
        `
      SELECT * FROM todos
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY priority ASC, created_at DESC
    `,
      )
      .all(pattern, pattern);
  }

  getStats() {
    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending,
        COUNT(CASE WHEN due_date IS NOT NULL AND due_date < date('now') AND completed = 0 THEN 1 END) as overdue
      FROM todos
    `,
      )
      .get();

    const priorityStats = this.db
      .prepare(
        `
      SELECT priority, COUNT(*) as count, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending_count
      FROM todos WHERE completed = 0
      GROUP BY priority ORDER BY priority
    `,
      )
      .all();

    return { stats, priorityStats };
  }
}

/**
 * TodoUI - A composable for consistent CLI output formatting and validation
 * Provides utilities for building clean CLI interfaces around ToDoManager
 */
export class TodoUI {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Validate required parameters
   */
  validateRequired(params, paramNames) {
    const missing = [];
    paramNames.forEach((name, index) => {
      if (!params[index]) {
        missing.push(name);
      }
    });

    if (missing.length > 0) {
      this.error(
        `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`,
      );
      return false;
    }
    return true;
  }

  /**
   * Format and display error messages consistently
   */
  error(message) {
    console.error(`❌ ${message}`);
  }

  /**
   * Format and display success messages consistently
   */
  success(message) {
    console.log(`✅ ${message}`);
  }

  /**
   * Format and display info messages consistently
   */
  info(message) {
    console.log(`📝 ${message}`);
  }

  /**
   * Format a single todo for display
   */
  formatTodo(todo, showDetails = false) {
    const status = todo.completed ? "✅" : "⏳";
    const priority = "★".repeat(todo.priority);
    const dueDate = todo.due_date ? ` 📅 Due: ${todo.due_date}` : "";

    let output = `${status} [${todo.id}] ${todo.title} ${priority}${dueDate}`;

    if (showDetails && todo.description) {
      output += `\n    📝 ${todo.description}`;
    }

    return output;
  }

  /**
   * Display a list of todos with consistent formatting
   */
  displayTodoList(todos, title = "Todo List", format = "text") {
    if (format === "json") {
      console.log(JSON.stringify(todos, null, 2));
      return;
    }

    if (todos.length === 0) {
      this.info("No todos found");
      return;
    }

    console.log(`\n📋 ${title} (${todos.length} items):\n`);
    todos.forEach((todo) => {
      console.log(this.formatTodo(todo, true));
      console.log("");
    });
  }

  /**
   * Display detailed todo information
   */
  displayTodoDetails(todo, format = "text") {
    if (format === "json") {
      console.log(JSON.stringify(todo, null, 2));
      return;
    }

    console.log(`\n📋 Todo Details:\n`);
    console.log(`ID: ${todo.id}`);
    console.log(`Title: ${todo.title}`);
    console.log(`Description: ${todo.description || "None"}`);
    console.log(`Status: ${todo.completed ? "✅ Completed" : "⏳ Pending"}`);
    console.log(`Priority: ${"★".repeat(todo.priority)} (${todo.priority}/5)`);
    console.log(`Due Date: ${todo.due_date || "Not set"}`);
    console.log(`Created: ${todo.created_at}`);
    console.log(`Updated: ${todo.updated_at}`);
    console.log("");
  }

  /**
   * Display statistics with consistent formatting
   */
  displayStats(stats, priorityStats, format = "text") {
    if (format === "json") {
      console.log(JSON.stringify({ stats, priorityStats }, null, 2));
      return;
    }

    console.log(`\n📊 Todo Statistics:\n`);
    console.log(`Total Todos: ${stats.total}`);
    console.log(`✅ Completed: ${stats.completed}`);
    console.log(`⏳ Pending: ${stats.pending}`);
    console.log(`🚨 Overdue: ${stats.overdue}`);

    if (priorityStats.length > 0) {
      console.log(`\n📈 Pending by Priority:`);
      priorityStats.forEach((stat) => {
        console.log(
          `${"★".repeat(stat.priority)} Priority ${stat.priority}: ${stat.pending_count} todos`,
        );
      });
    }
    console.log("");
  }

  /**
   * Execute an operation with consistent error handling
   */
  async executeOperation(operation, successMessage) {
    try {
      const result = await operation();
      if (successMessage) {
        this.success(successMessage);
      }
      return result;
    } catch (error) {
      this.error(`Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Execute a todo operation by ID with validation
   */
  async executeTodoOperation(id, operation, successMessage) {
    if (!this.validateRequired([id], ["Todo ID"])) {
      return false;
    }

    const todoId = parseInt(id);
    const result = operation(todoId);

    if (result) {
      this.success(successMessage.replace("{id}", id));
      return true;
    } else {
      this.error(`Todo with ID ${id} not found`);
      return false;
    }
  }

  /**
   * Process bulk operations with progress tracking
   */
  async processBulkOperations(lines, operations) {
    console.log(`🚀 Processing ${lines.length} bulk operations...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`📋 [${i + 1}/${lines.length}] Processing: ${line}`);

      try {
        const [command, ...params] = line.split(
          /\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/,
        );

        if (operations[command]) {
          await operations[command](params);
          successCount++;
        } else {
          throw new Error(`Unknown command: ${command}`);
        }
      } catch (error) {
        this.error(`Error: ${error.message}`);
        errorCount++;
      }
      console.log("");
    }

    console.log(`✅ Bulk operation complete:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${lines.length}`);
  }

  /**
   * Create a bulk template file
   */
  async createBulkTemplate(filename) {
    const template = `# Bulk Operations Template
# Lines starting with # are comments and will be ignored
# Supported commands:
#   add "Title" "Description" priority "YYYY-MM-DD"
#   complete <id>
#   delete <id>
#   update <id> <field> <value>
#
# Examples:
# add "Sample Task" "This is a sample description" 3 "2024-01-30"
# add "Urgent Fix" "Fix critical bug" 1 "2024-01-16"
# complete 5
# delete 10
# update 15 priority 2

# Add your bulk operations below:
`;

    await this.executeOperation(async () => {
      await Bun.write(filename, template);
      this.info(`Created bulk template file: ${filename}`);
      this.info(`Edit the file and then run: invj bulk ${filename}`);
    }, null);
  }

  /**
   * Export todos to bulk format
   */
  async exportToBulk(filename, status = "all") {
    await this.executeOperation(async () => {
      const todos = this.manager.getTodos(status, "priority");
      const commands = [];

      commands.push(`# Bulk export - ${status} todos`);
      commands.push(`# Exported on: ${new Date().toISOString()}`);
      commands.push(`# Total todos: ${todos.length}`);
      commands.push("");

      todos.forEach((todo) => {
        const title = `"${todo.title.replace(/"/g, '\\"')}"`;
        const description = `"${(todo.description || "").replace(/"/g, '\\"')}"`;
        const priority = todo.priority;
        const dueDate = todo.due_date ? `"${todo.due_date}"` : '""';

        commands.push(`add ${title} ${description} ${priority} ${dueDate}`);
      });

      await Bun.write(filename, commands.join("\n"));
      console.log(
        `📤 Exported ${todos.length} ${status} todos to: ${filename}`,
      );
    }, null);
  }

  /**
   * Clean up bulk files
   */
  async cleanupBulkFiles() {
    await this.executeOperation(async () => {
      const files = await Array.fromAsync(new Bun.Glob("*bulk*.txt").scan("."));

      if (files.length === 0) {
        console.log("🧹 No bulk files found to clean up");
        return;
      }

      let deletedCount = 0;
      for (const file of files) {
        try {
          await Bun.unlink(file);
          console.log(`🗑️ Deleted: ${file}`);
          deletedCount++;
        } catch (error) {
          this.error(`Failed to delete ${file}: ${error.message}`);
        }
      }

      console.log(`🧹 Cleanup complete: ${deletedCount} files deleted`);
    }, null);
  }
}

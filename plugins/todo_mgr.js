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

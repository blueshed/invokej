import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ToDoManager, TodoUI } from "../plugins/todo_mgr.js";
import { existsSync, unlinkSync } from "fs";

describe("ToDoManager", () => {
  let manager;
  const testDbPath = "/tmp/test-todos.db";

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    manager = new ToDoManager(testDbPath);
  });

  afterEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe("Database Initialization", () => {
    test("should create database with proper schema", () => {
      expect(manager.db).toBeDefined();

      // Verify tables exist by querying
      const tables = manager.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all();

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain("todos");
    });

    test("should create indices", () => {
      const indices = manager.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='todos'"
      ).all();

      const indexNames = indices.map(i => i.name);
      expect(indexNames).toContain("idx_todos_completed");
      expect(indexNames).toContain("idx_todos_priority");
      expect(indexNames).toContain("idx_todos_due_date");
    });
  });

  describe("addTodo()", () => {
    test("should add a simple todo", () => {
      const id = manager.addTodo("Test Task", "Test Description");
      expect(id).toBeGreaterThan(0);

      const todo = manager.getTodo(id);
      expect(todo.title).toBe("Test Task");
      expect(todo.description).toBe("Test Description");
      expect(todo.completed).toBe(0); // SQLite uses 0/1 for boolean
      expect(todo.priority).toBe(3); // Default priority
    });

    test("should add todo with priority", () => {
      const id = manager.addTodo("High Priority Task", "", 1);
      const todo = manager.getTodo(id);

      expect(todo.priority).toBe(1);
    });

    test("should add todo with due date", () => {
      const dueDate = "2024-12-31";
      const id = manager.addTodo("Task with deadline", "", 3, dueDate);
      const todo = manager.getTodo(id);

      expect(todo.due_date).toBe(dueDate);
    });

    test("should set created_at timestamp", () => {
      const id = manager.addTodo("Test Task");
      const todo = manager.getTodo(id);

      expect(todo.created_at).toBeTruthy();
      expect(new Date(todo.created_at)).toBeInstanceOf(Date);
    });
  });

  describe("getTodos()", () => {
    beforeEach(() => {
      // Add some test todos
      manager.addTodo("Task 1", "First task", 1);
      manager.addTodo("Task 2", "Second task", 2);
      manager.addTodo("Task 3", "Third task", 3);
    });

    test("should get all todos", () => {
      const todos = manager.getTodos("all");
      expect(todos.length).toBe(3);
    });

    test("should get pending todos only", () => {
      const id = manager.addTodo("To be completed");
      manager.completeTodo(id);

      const pending = manager.getTodos("pending");
      expect(pending.length).toBe(3);
      expect(pending.every(t => t.completed === 0)).toBe(true);
    });

    test("should get completed todos only", () => {
      const id = manager.addTodo("Completed task");
      manager.completeTodo(id);

      const completed = manager.getTodos("completed");
      expect(completed.length).toBe(1);
      expect(completed[0].completed).toBe(1);
    });

    test("should sort by priority by default", () => {
      const todos = manager.getTodos("all", "priority");
      expect(todos[0].priority).toBeLessThanOrEqual(todos[1].priority);
      expect(todos[1].priority).toBeLessThanOrEqual(todos[2].priority);
    });

    test("should sort by date", () => {
      manager.addTodo("Future task", "", 3, "2024-12-31");
      manager.addTodo("Near task", "", 3, "2024-06-01");

      const todos = manager.getTodos("all", "date");
      // Tasks with due dates should come first, sorted by date
      const withDates = todos.filter(t => t.due_date);
      expect(withDates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getTodo()", () => {
    test("should get specific todo by id", () => {
      const id = manager.addTodo("Specific Task", "Description");
      const todo = manager.getTodo(id);

      expect(todo).toBeDefined();
      expect(todo.id).toBe(id);
      expect(todo.title).toBe("Specific Task");
    });

    test("should return undefined for non-existent todo", () => {
      const todo = manager.getTodo(9999);
      expect(todo).toBeUndefined();
    });
  });

  describe("completeTodo()", () => {
    test("should mark todo as completed", () => {
      const id = manager.addTodo("Task to complete");
      const result = manager.completeTodo(id);

      expect(result).toBe(true);

      const todo = manager.getTodo(id);
      expect(todo.completed).toBe(1);
    });

    test("should return false for non-existent todo", () => {
      const result = manager.completeTodo(9999);
      expect(result).toBe(false);
    });
  });

  describe("uncompleteTodo()", () => {
    test("should mark completed todo as pending", () => {
      const id = manager.addTodo("Task to uncomplete");
      manager.completeTodo(id);

      const result = manager.uncompleteTodo(id);
      expect(result).toBe(true);

      const todo = manager.getTodo(id);
      expect(todo.completed).toBe(0);
    });
  });

  describe("deleteTodo()", () => {
    test("should delete existing todo", () => {
      const id = manager.addTodo("Task to delete");
      const result = manager.deleteTodo(id);

      expect(result).toBe(true);
      expect(manager.getTodo(id)).toBeUndefined();
    });

    test("should return false for non-existent todo", () => {
      const result = manager.deleteTodo(9999);
      expect(result).toBe(false);
    });
  });

  describe("updateTodo()", () => {
    test("should update todo title", () => {
      const id = manager.addTodo("Original Title");
      const result = manager.updateTodo(id, "title", "Updated Title");

      expect(result).toBe(true);

      const todo = manager.getTodo(id);
      expect(todo.title).toBe("Updated Title");
    });

    test("should update todo priority", () => {
      const id = manager.addTodo("Task", "", 3);
      manager.updateTodo(id, "priority", 1);

      const todo = manager.getTodo(id);
      expect(todo.priority).toBe(1);
    });
  });

  describe("clearCompleted()", () => {
    test("should delete all completed todos", () => {
      const id1 = manager.addTodo("Task 1");
      const id2 = manager.addTodo("Task 2");
      const id3 = manager.addTodo("Task 3");

      manager.completeTodo(id1);
      manager.completeTodo(id2);

      const deletedCount = manager.clearCompleted();
      expect(deletedCount).toBe(2);

      const remaining = manager.getTodos("all");
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(id3);
    });
  });

  describe("searchTodos()", () => {
    beforeEach(() => {
      manager.addTodo("JavaScript tutorial", "Learn JS basics");
      manager.addTodo("Python course", "Advanced Python");
      manager.addTodo("Write JavaScript code", "Build a project");
    });

    test("should search by title", () => {
      const results = manager.searchTodos("JavaScript");
      expect(results.length).toBe(2);
      expect(results.every(t => t.title.includes("JavaScript"))).toBe(true);
    });

    test("should search by description", () => {
      const results = manager.searchTodos("Python");
      expect(results.length).toBe(1);
      expect(results[0].description).toContain("Python");
    });

    test("should be case-insensitive", () => {
      const results = manager.searchTodos("javascript");
      expect(results.length).toBe(2);
    });

    test("should return empty array for no matches", () => {
      const results = manager.searchTodos("NonExistent");
      expect(results.length).toBe(0);
    });
  });

  describe("getStats()", () => {
    test("should return correct statistics", () => {
      manager.addTodo("Task 1", "", 1);
      manager.addTodo("Task 2", "", 2);
      manager.addTodo("Task 3", "", 3);

      const id = manager.addTodo("Completed task");
      manager.completeTodo(id);

      const { stats, priorityStats } = manager.getStats();

      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(3);
    });

    test("should detect overdue todos", () => {
      manager.addTodo("Overdue task", "", 3, "2020-01-01");

      const { stats } = manager.getStats();
      expect(stats.overdue).toBe(1);
    });

    test("should provide priority breakdown", () => {
      manager.addTodo("High", "", 1);
      manager.addTodo("High 2", "", 1);
      manager.addTodo("Low", "", 5);

      const { priorityStats } = manager.getStats();

      const priority1 = priorityStats.find(p => p.priority === 1);
      expect(priority1.pending_count).toBe(2);
    });
  });
});

describe("TodoUI", () => {
  let manager;
  let ui;
  const testDbPath = "/tmp/test-todos-ui.db";

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    manager = new ToDoManager(testDbPath);
    ui = new TodoUI(manager);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe("validateRequired()", () => {
    test("should validate all required params present", () => {
      const result = ui.validateRequired(["value1", "value2"], ["param1", "param2"]);
      expect(result).toBe(true);
    });

    test("should fail when param is missing", () => {
      const result = ui.validateRequired([null, "value2"], ["param1", "param2"]);
      expect(result).toBe(false);
    });

    test("should fail when param is empty string", () => {
      const result = ui.validateRequired(["", "value2"], ["param1", "param2"]);
      expect(result).toBe(false);
    });
  });

  describe("formatTodo()", () => {
    test("should format pending todo", () => {
      const todo = {
        id: 1,
        title: "Test Task",
        priority: 3,
        completed: 0,
        due_date: null,
        description: "Test description"
      };

      const formatted = ui.formatTodo(todo);
      expect(formatted).toContain("⏳"); // Pending icon
      expect(formatted).toContain("[1]");
      expect(formatted).toContain("Test Task");
      expect(formatted).toContain("★★★"); // Priority stars
    });

    test("should format completed todo", () => {
      const todo = {
        id: 1,
        title: "Done Task",
        priority: 1,
        completed: 1,
        due_date: null,
        description: ""
      };

      const formatted = ui.formatTodo(todo);
      expect(formatted).toContain("✅"); // Completed icon
    });

    test("should include due date when present", () => {
      const todo = {
        id: 1,
        title: "Task",
        priority: 3,
        completed: 0,
        due_date: "2024-12-31",
        description: ""
      };

      const formatted = ui.formatTodo(todo);
      expect(formatted).toContain("📅");
      expect(formatted).toContain("2024-12-31");
    });

    test("should show description when showDetails=true", () => {
      const todo = {
        id: 1,
        title: "Task",
        priority: 3,
        completed: 0,
        due_date: null,
        description: "Detailed description"
      };

      const formatted = ui.formatTodo(todo, true);
      expect(formatted).toContain("Detailed description");
    });
  });

  describe("executeTodoOperation()", () => {
    test("should execute operation and return true on success", async () => {
      const id = manager.addTodo("Test Task");

      const result = await ui.executeTodoOperation(
        String(id),
        (todoId) => manager.completeTodo(todoId),
        "Todo {id} completed"
      );

      expect(result).toBe(true);
    });

    test("should return false when todo not found", async () => {
      const result = await ui.executeTodoOperation(
        "9999",
        (todoId) => manager.completeTodo(todoId),
        "Todo {id} completed"
      );

      expect(result).toBe(false);
    });

    test("should validate required ID", async () => {
      const result = await ui.executeTodoOperation(
        null,
        (todoId) => manager.completeTodo(todoId),
        "Todo {id} completed"
      );

      expect(result).toBe(false);
    });
  });
});

/**
 * Todo Plugin Example
 *
 * This example shows how to use the built-in Todo plugin.
 * Place this as 'tasks.js' in your project root.
 *
 * Usage:
 *   invokej add "Review pull request" "Check PR #42" 1
 *   invokej list
 *   invokej complete 1
 *   invokej stats
 */

import { ToDoManager, TodoUI } from "invokej/plugins";

export class Tasks {
  constructor() {
    this.manager = new ToDoManager();
    this.ui = new TodoUI(this.manager);
  }

  /** Add a new todo item */
  async add(c, title, description = "", priority = "3", dueDate = "") {
    if (!title) {
      console.log('Usage: invokej add "title" "description" [priority] [due date]');
      return;
    }

    const id = this.manager.addTodo(
      title,
      description,
      parseInt(priority),
      dueDate || null
    );
    this.ui.success(`Added todo: "${title}" (ID: ${id})`);
  }

  /** List todos */
  async list(c, status = "pending", sortBy = "priority") {
    const todos = this.manager.getTodos(status, sortBy);
    this.ui.displayTodoList(
      todos,
      `${status.charAt(0).toUpperCase() + status.slice(1)} Todos`
    );
  }

  /** Mark todo as completed */
  async complete(c, id) {
    if (!id) {
      console.log("Usage: invokej complete <id>");
      return;
    }

    if (this.manager.completeTodo(parseInt(id))) {
      this.ui.success(`Marked todo ${id} as completed`);
    } else {
      this.ui.error(`Todo with ID ${id} not found`);
    }
  }

  /** Delete a todo */
  async delete(c, id) {
    if (!id) {
      console.log("Usage: invokej delete <id>");
      return;
    }

    if (this.manager.deleteTodo(parseInt(id))) {
      console.log(`🗑️  Deleted todo ${id}`);
    } else {
      this.ui.error(`Todo with ID ${id} not found`);
    }
  }

  /** Show todo statistics */
  async stats(c) {
    const { stats, priorityStats } = this.manager.getStats();
    this.ui.displayStats(stats, priorityStats);
  }

  /** Search todos */
  async search(c, query) {
    if (!query) {
      console.log('Usage: invokej search "query"');
      return;
    }

    const todos = this.manager.searchTodos(query);
    if (todos.length === 0) {
      console.log(`No todos found matching "${query}"`);
      return;
    }

    this.ui.displayTodoList(todos, `Search Results for "${query}"`);
  }

  /** Clear all completed todos */
  async clear(c) {
    const count = this.manager.clearCompleted();
    console.log(`🧹 Cleared ${count} completed todos`);
  }
}

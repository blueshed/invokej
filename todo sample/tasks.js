import { importGlobal } from "import-global";

// because we install with -g we need to import via this tool
const { ToDoManager, TodoUI } = await importGlobal(
  "invokej/plugins/todo_mgr.js",
);

/**
 * Tasks - Clean command-line interface using TodoUI composable
 */
export class Tasks {
  constructor() {
    this.manager = new ToDoManager();
    this.ui = new TodoUI(this.manager);
  }
  /** Add a new todo item */
  async add(c, title, description = "", priority = "3", dueDate = "") {
    if (!this.ui.validateRequired([title], ["Title"])) return;

    const id = this.manager.addTodo(
      title,
      description,
      parseInt(priority),
      dueDate || null,
    );
    this.ui.success(`Added todo: "${title}" (ID: ${id})`);
  }

  /** List todos with optional filtering and sorting */
  async list(c, status = "all", sortBy = "priority", format = "text") {
    const todos = this.manager.getTodos(status, sortBy);
    this.ui.displayTodoList(
      todos,
      `${status.charAt(0).toUpperCase() + status.slice(1)} Todos`,
      format,
    );
  }

  /** Mark a todo as completed */
  async complete(c, id) {
    await this.ui.executeTodoOperation(
      id,
      (todoId) => this.manager.completeTodo(todoId),
      "Marked todo {id} as completed",
    );
  }

  /** Mark a todo as pending */
  async uncomplete(c, id) {
    await this.ui.executeTodoOperation(
      id,
      (todoId) => this.manager.uncompleteTodo(todoId),
      "Marked todo {id} as pending",
    );
  }

  /** Delete a todo item */
  async delete(c, id) {
    await this.ui.executeTodoOperation(
      id,
      (todoId) => this.manager.deleteTodo(todoId),
      "🗑️ Deleted todo {id}",
    );
  }

  /** Update a specific field of a todo */
  async update(c, id, field, value) {
    if (
      !this.ui.validateRequired([id, field, value], ["ID", "field", "value"])
    ) {
      this.ui.error("Usage: update <id> <field> <value>");
      return;
    }

    const processedValue = field === "priority" ? parseInt(value) : value;

    await this.ui.executeTodoOperation(
      id,
      (todoId) => this.manager.updateTodo(todoId, field, processedValue),
      `📝 Updated todo {id}: ${field} = ${value}`,
    );
  }

  /** Show detailed information about a todo */
  async show(c, id, format = "text") {
    if (!this.ui.validateRequired([id], ["Todo ID"])) return;

    const todo = this.manager.getTodo(parseInt(id));
    if (!todo) {
      this.ui.error(`Todo with ID ${id} not found`);
      return;
    }

    this.ui.displayTodoDetails(todo, format);
  }

  /** Clear all completed todos */
  async clear_completed(c) {
    const count = this.manager.clearCompleted();
    console.log(`🧹 Cleared ${count} completed todos`);
  }

  /** Display todo statistics and analytics */
  async stats(c, format = "text") {
    const { stats, priorityStats } = this.manager.getStats();
    this.ui.displayStats(stats, priorityStats, format);
  }

  /** Search todos by title or description */
  async search(c, query, format = "text") {
    if (!this.ui.validateRequired([query], ["Search query"])) return;

    const todos = this.manager.searchTodos(query);

    if (format === "json") {
      console.log(JSON.stringify(todos, null, 2));
      return;
    }

    if (todos.length === 0) {
      console.log(`🔍 No todos found matching "${query}"`);
      return;
    }

    this.ui.displayTodoList(todos, `Search Results for "${query}"`, format);
  }

  /** Execute bulk operations from a file */
  async bulk(c, filename) {
    if (!this.ui.validateRequired([filename], ["Filename"])) return;

    await this.ui.executeOperation(async () => {
      const content = await Bun.file(filename).text();
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      const operations = {
        add: (params) => {
          const cleanParams = params.map((p) => p.replace(/^"|"$/g, ""));
          const id = this.manager.addTodo(...cleanParams);
          this.ui.success(`Added todo: "${cleanParams[0]}" (ID: ${id})`);
        },
        complete: (params) => {
          if (this.manager.completeTodo(parseInt(params[0]))) {
            this.ui.success(`Marked todo ${params[0]} as completed`);
          } else {
            this.ui.error(`Todo with ID ${params[0]} not found`);
          }
        },
        delete: (params) => {
          if (this.manager.deleteTodo(parseInt(params[0]))) {
            console.log(`🗑️ Deleted todo ${params[0]}`);
          } else {
            this.ui.error(`Todo with ID ${params[0]} not found`);
          }
        },
      };

      await this.ui.processBulkOperations(lines, operations);
    }, null);
  }

  /** Create a bulk operations template file */
  async bulk_create(c, filename) {
    if (!this.ui.validateRequired([filename], ["Filename"])) return;
    await this.ui.createBulkTemplate(filename);
  }

  /** Export todos to bulk format file */
  async bulk_export(c, filename, status = "all") {
    if (!this.ui.validateRequired([filename], ["Filename"])) return;
    await this.ui.exportToBulk(filename, status);
  }

  /** Clean up temporary bulk files */
  async bulk_cleanup(c) {
    await this.ui.cleanupBulkFiles();
  }
}

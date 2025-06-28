import { importGlobal } from "import-global";

// because we install with -g we need to import via this tool
const { WorkAPI } = await importGlobal("invokej/plugins/work_mgr.js");

export class Tasks {
  constructor() {
    this.work = null;
  }

  // Ensure MCP.lite is initialized
  _ensureWork() {
    if (!this.work) {
      this.work = new WorkAPI("work.db");
    }
    return this.work;
  }

  /** Create or update a project */
  async project_save(c, name = "", id = null) {
    if (!name) {
      console.log("Usage: invokej project_save <name> [id]");
      console.log("  No id = create new project");
      console.log("  With id = update existing project");
      return;
    }

    const work = this._ensureWork();
    const result = work.saveProject(name, id ? parseInt(id) : null);
    const action = id ? "Updated" : "Created";
    const projectId = id || result.lastInsertRowid;
    console.log(`✅ ${action} project ${projectId}: "${name}"`);
    return result;
  }

  /** List all projects */
  async project_list(c) {
    const work = this._ensureWork();
    const projects = work.getProjects();

    if (projects.length === 0) {
      console.log("No projects found");
      return;
    }

    console.log("📋 Projects:");
    console.log(
      "────────────────────────────────────────────────────────────────────────────────",
    );
    projects.forEach((p) => {
      console.log(`[${p.id}] ${p.name}`);
    });
  }

  /** Show complete project with tasks, dependencies, and context */
  async project_show(c, projectId = "") {
    if (!projectId) {
      console.log("Usage: invokej project_show <project_id>");
      return;
    }

    const work = this._ensureWork();
    const project = work.getProject(parseInt(projectId));

    if (!project) {
      console.log(`Project ${projectId} not found`);
      return;
    }

    console.log(`📊 Project: ${project.name}`);
    console.log(
      "────────────────────────────────────────────────────────────────────────────────",
    );

    // Tasks summary
    const completed = project.tasks.filter((t) => t.completed_at).length;
    console.log(`Tasks: ${project.tasks.length} (${completed} completed)`);
    console.log(`Dependencies: ${project.dependencies.length}`);
    console.log(`Context Items: ${project.context.length}`);
    console.log(`Context Relations: ${project.contextRelations.length}`);

    // Show tasks
    if (project.tasks.length > 0) {
      console.log("\n📝 Tasks:");
      project.tasks.forEach((t) => {
        const status = t.completed_at ? "✅" : "⏳";
        const due = t.due_date ? ` (due: ${t.due_date})` : "";
        console.log(`  ${status} [${t.id}] ${t.name}${due}`);
      });
    }

    // Show key insights
    const keyInsights = project.context
      .filter((c) => c.importance >= 8)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    if (keyInsights.length > 0) {
      console.log("\n⭐ Key Insights:");
      keyInsights.forEach((c) => {
        console.log(`  [${c.importance}/10] ${c.knowledge_type}: ${c.content}`);
      });
    }
  }

  /** Create or update a task */
  async task_save(c, projectId = "", name = "", dueDate = null, id = null) {
    if (!projectId || !name) {
      console.log(
        "Usage: invokej task_save <project_id> <name> [due_date] [id]",
      );
      console.log("  No id = create new task");
      console.log("  With id = update existing task");
      return;
    }

    const work = this._ensureWork();
    const result = work.saveTask(
      parseInt(projectId),
      name,
      dueDate,
      id ? parseInt(id) : null,
    );
    const action = id ? "Updated" : "Created";
    const taskId = id || result.lastInsertRowid;
    console.log(`✅ ${action} task ${taskId}: "${name}"`);
    return result;
  }

  /** Show available work (tasks ready to be done) */
  async work_ready(c, projectId = null) {
    const work = this._ensureWork();
    const readyTasks = work.getWork(projectId ? parseInt(projectId) : null);

    if (readyTasks.length === 0) {
      console.log("🎉 No work available - all tasks completed or blocked!");
      return;
    }

    console.log("🔨 Available Work:");
    console.log(
      "────────────────────────────────────────────────────────────────────────────────",
    );
    readyTasks.forEach((t) => {
      const due = t.due_date ? ` (due: ${t.due_date})` : "";
      console.log(`[${t.id}] ${t.name}${due}`);
    });
  }

  /** Complete a task */
  async work_complete(c, taskId = "") {
    if (!taskId) {
      console.log("Usage: invokej work_complete <task_id>");
      return;
    }

    const work = this._ensureWork();
    const result = work.completeWork(parseInt(taskId));
    console.log(`✅ Completed task ${taskId}`);

    // Show what work is now available
    console.log("\n🔨 Newly Available Work:");
    const newWork = work.getWork();
    if (newWork.length === 0) {
      console.log("  None - all tasks completed or still blocked");
    } else {
      newWork.slice(0, 3).forEach((t) => {
        console.log(`  [${t.id}] ${t.name}`);
      });
    }

    return result;
  }

  /** Add/remove dependency between tasks */
  async work_dependency(c, taskId = "", dependsOnId = "") {
    if (!taskId || !dependsOnId) {
      console.log("Usage: invokej work_dependency <task_id> <depends_on_id>");
      console.log(
        "  This toggles the dependency - adds if missing, removes if present",
      );
      return;
    }

    const work = this._ensureWork();
    const result = work.toggleDependency(
      parseInt(taskId),
      parseInt(dependsOnId),
    );
    console.log(
      `🔗 Toggled dependency: Task ${taskId} depends on Task ${dependsOnId}`,
    );
    return result;
  }

  /** Create or update project context */
  async work_context_save(
    c,
    projectId = "",
    content = "",
    stage = "during",
    knowledgeType = "insight",
    importance = 7,
    taskId = null,
    id = null,
  ) {
    if (!projectId || !content) {
      console.log(
        "Usage: invokej work_context_save <project_id> <content> [stage] [knowledge_type] [importance] [task_id] [id]",
      );
      console.log("  stage: pre, during, post");
      console.log(
        "  knowledge_type: assumption, discovery, rule, pattern, constraint, insight",
      );
      console.log("  importance: 1-10");
      console.log("  No id = create new context");
      console.log("  With id = update existing context");
      return;
    }

    const work = this._ensureWork();
    const result = work.saveContext(
      parseInt(projectId),
      content,
      stage,
      knowledgeType,
      parseInt(importance),
      taskId ? parseInt(taskId) : null,
      id ? parseInt(id) : null,
    );
    const action = id ? "Updated" : "Added";
    const contextId = id || result.lastInsertRowid;
    console.log(
      `🧠 ${action} context [${contextId}]: ${knowledgeType} - ${content.substring(0, 50)}...`,
    );
    return result;
  }

  /** Link context items with relationships */
  async work_context_relate(
    c,
    sourceId = "",
    targetId = "",
    relationshipType = "",
  ) {
    if (!sourceId || !targetId || !relationshipType) {
      console.log(
        "Usage: invokej work_context_relate <source_context_id> <target_context_id> <relationship_type>",
      );
      console.log(
        "  relationship_type: supersedes, contradicts, enhances, validates, depends_on",
      );
      return;
    }

    const work = this._ensureWork();
    const result = work.toggleContextRelation(
      parseInt(sourceId),
      parseInt(targetId),
      relationshipType,
    );
    console.log(
      `🔗 Toggled context relationship: ${sourceId} ${relationshipType} ${targetId}`,
    );
    return result;
  }
}

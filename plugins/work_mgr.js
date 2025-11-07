import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

const WORK_SCHEMA = `
  -- Work Package Schema v0.1.0
  -- Minimal project-task dependency management

  CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      completed_at DATETIME,
      due_date DATETIME,
      FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id INTEGER NOT NULL,
      depends_on_id INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (depends_on_id) REFERENCES tasks(id),
      PRIMARY KEY (task_id, depends_on_id)
  );

  -- Project context that evolves through task execution
  CREATE TABLE IF NOT EXISTS project_contexts (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      task_id INTEGER,
      stage TEXT NOT NULL CHECK (stage IN ('pre', 'during', 'post')),
      knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('assumption', 'discovery', 'rule', 'pattern', 'constraint', 'insight')),
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
  );

  -- Relationships between context items
  CREATE TABLE IF NOT EXISTS context_relationships (
      id INTEGER PRIMARY KEY,
      source_context_id INTEGER NOT NULL,
      target_context_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL CHECK (relationship_type IN ('supersedes', 'contradicts', 'enhances', 'validates', 'depends_on')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_context_id) REFERENCES project_contexts(id),
      FOREIGN KEY (target_context_id) REFERENCES project_contexts(id),
      UNIQUE(source_context_id, target_context_id, relationship_type),
      CHECK (source_context_id != target_context_id)
  );


  -- Indexes based on API query patterns
  CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_completed_work ON tasks(completed_at) WHERE completed_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_dependencies_lookup ON task_dependencies(depends_on_id);

  -- Context-specific indexes
  CREATE INDEX IF NOT EXISTS idx_contexts_project_stage ON project_contexts(project_id, stage);
  CREATE INDEX IF NOT EXISTS idx_contexts_task ON project_contexts(task_id);
  CREATE INDEX IF NOT EXISTS idx_contexts_importance ON project_contexts(importance);
  CREATE INDEX IF NOT EXISTS idx_context_relationships_source ON context_relationships(source_context_id);
  CREATE INDEX IF NOT EXISTS idx_context_relationships_target ON context_relationships(target_context_id);
`;

class WorkAPI {
  constructor(dbPath = "work.db") {
    this.db = new Database(dbPath);
    this.db.exec(WORK_SCHEMA);
  }

  // Projects
  saveProject(name, id = null) {
    if (id) {
      const stmt = this.db.prepare("UPDATE projects SET name = ? WHERE id = ?");
      return stmt.run(name, id);
    } else {
      const stmt = this.db.prepare("INSERT INTO projects (name) VALUES (?)");
      return stmt.run(name);
    }
  }

  getProjects() {
    return this.db.query("SELECT * FROM projects ORDER BY name").all();
  }

  getProject(id) {
    const project = this.db
      .query("SELECT * FROM projects WHERE id = ?")
      .get(id);
    if (!project) return null;

    const tasks = this.db
      .query("SELECT * FROM tasks WHERE project_id = ? ORDER BY name")
      .all(id);
    const dependencies = this.db
      .query(
        `
      SELECT td.*
      FROM task_dependencies td
      JOIN tasks dt ON td.task_id = dt.id
      JOIN tasks pt ON td.depends_on_id = pt.id
      WHERE dt.project_id = ? OR pt.project_id = ?
    `,
      )
      .all(id, id);

    const context = this.db
      .query(
        "SELECT * FROM project_contexts WHERE project_id = ? ORDER BY importance DESC, created_at DESC",
      )
      .all(id);
    const contextRelations = this.db
      .query(
        `
      SELECT cr.*
      FROM context_relationships cr
      JOIN project_contexts pc1 ON cr.source_context_id = pc1.id
      JOIN project_contexts pc2 ON cr.target_context_id = pc2.id
      WHERE pc1.project_id = ? OR pc2.project_id = ?
    `,
      )
      .all(id, id);

    return {
      ...project,
      tasks,
      dependencies,
      context,
      contextRelations,
    };
  }

  // Tasks
  saveTask(projectId, name, dueDate = null, id = null) {
    if (id) {
      const stmt = this.db.prepare(
        "UPDATE tasks SET project_id = ?, name = ?, due_date = ? WHERE id = ?",
      );
      return stmt.run(projectId, name, dueDate, id);
    } else {
      const stmt = this.db.prepare(
        "INSERT INTO tasks (project_id, name, due_date) VALUES (?, ?, ?)",
      );
      return stmt.run(projectId, name, dueDate);
    }
  }

  completeWork(id) {
    const stmt = this.db.prepare(
      "UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = ?",
    );
    return stmt.run(id);
  }

  // Dependencies
  toggleDependency(taskId, dependsOnId) {
    const existing = this.db
      .query(
        "SELECT 1 FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?",
      )
      .get(taskId, dependsOnId);

    if (existing) {
      const stmt = this.db.prepare(
        "DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?",
      );
      return stmt.run(taskId, dependsOnId);
    } else {
      const stmt = this.db.prepare(
        "INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)",
      );
      return stmt.run(taskId, dependsOnId);
    }
  }

  // Work query - tasks ready to work on
  getWork(projectId = null) {
    const query = `
      SELECT t.* FROM tasks t
      WHERE t.completed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM task_dependencies td
        JOIN tasks pt ON td.depends_on_id = pt.id
        WHERE td.task_id = t.id
        AND pt.completed_at IS NULL
      )
      ${projectId ? "AND t.project_id = ?" : ""}
      ORDER BY t.due_date ASC, t.name
    `;
    return projectId
      ? this.db.query(query).all(projectId)
      : this.db.query(query).all();
  }

  // Context
  saveContext(
    projectId,
    content,
    stage,
    knowledgeType,
    importance = 5,
    taskId = null,
    id = null,
  ) {
    if (id) {
      const stmt = this.db.prepare(
        "UPDATE project_contexts SET project_id = ?, task_id = ?, stage = ?, knowledge_type = ?, content = ?, importance = ? WHERE id = ?",
      );
      return stmt.run(
        projectId,
        taskId,
        stage,
        knowledgeType,
        content,
        importance,
        id,
      );
    } else {
      const stmt = this.db.prepare(
        "INSERT INTO project_contexts (project_id, task_id, stage, knowledge_type, content, importance) VALUES (?, ?, ?, ?, ?, ?)",
      );
      return stmt.run(
        projectId,
        taskId,
        stage,
        knowledgeType,
        content,
        importance,
      );
    }
  }

  getContext(projectId, stage = null, knowledgeType = null) {
    let query = "SELECT * FROM project_contexts WHERE project_id = ?";
    let params = [projectId];

    if (stage) {
      query += " AND stage = ?";
      params.push(stage);
    }

    if (knowledgeType) {
      query += " AND knowledge_type = ?";
      params.push(knowledgeType);
    }

    query += " ORDER BY importance DESC, created_at DESC";
    return this.db.query(query).all(...params);
  }

  toggleContextRelation(sourceContextId, targetContextId, relationshipType) {
    const existing = this.db
      .query(
        "SELECT 1 FROM context_relationships WHERE source_context_id = ? AND target_context_id = ? AND relationship_type = ?",
      )
      .get(sourceContextId, targetContextId, relationshipType);

    if (existing) {
      const stmt = this.db.prepare(
        "DELETE FROM context_relationships WHERE source_context_id = ? AND target_context_id = ? AND relationship_type = ?",
      );
      return stmt.run(sourceContextId, targetContextId, relationshipType);
    } else {
      const stmt = this.db.prepare(
        "INSERT INTO context_relationships (source_context_id, target_context_id, relationship_type) VALUES (?, ?, ?)",
      );
      return stmt.run(sourceContextId, targetContextId, relationshipType);
    }
  }

  close() {
    this.db.close();
  }
}

export { WorkAPI };

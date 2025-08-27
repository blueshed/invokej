import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Plugin Catalog - Discovers, manages, and installs invokej plugins
 */
export class PluginCatalog {
  constructor() {
    this.cacheDir = join(homedir(), ".invokej", "cache");
    this.pluginsDir = join(homedir(), ".invokej", "plugins");
    this.catalogFile = join(this.cacheDir, "catalog.json");
    this.userPluginsFile = join(this.cacheDir, "user-plugins.json");

    // Ensure directories exist
    this.ensureDirectories();

    // Load cached catalog
    this.catalog = this.loadCatalog();
    this.userPlugins = this.loadUserPlugins();
  }

  ensureDirectories() {
    [this.cacheDir, this.pluginsDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Default plugin catalog - could be fetched from a remote registry
   */
  getDefaultCatalog() {
    return {
      version: "1.0.0",
      updated: new Date().toISOString(),
      plugins: [
        // Database plugins
        {
          id: "todo-manager",
          name: "Todo Manager",
          description: "SQLite-based todo management with priorities and due dates",
          category: "productivity",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/todo-manager",
          keywords: ["todo", "tasks", "sqlite", "productivity"],
          requirements: ["bun:sqlite"],
          methods: [
            { name: "add_todo", description: "Add a new todo item" },
            { name: "list_todos", description: "List todos with filtering" },
            { name: "complete_todo", description: "Mark todo as complete" },
            { name: "todo_stats", description: "Show todo statistics" }
          ],
          examples: [
            'invokej add_todo "Review PR" "Check the latest pull request" 1',
            'invokej list_todos pending priority'
          ]
        },
        {
          id: "work-tracker",
          name: "Work Time Tracker",
          description: "Track time spent on projects and tasks",
          category: "productivity",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/work-tracker",
          keywords: ["time", "tracking", "projects", "billing"],
          requirements: ["bun:sqlite"],
          methods: [
            { name: "work_start", description: "Start tracking time" },
            { name: "work_stop", description: "Stop tracking time" },
            { name: "work_report", description: "Generate time reports" }
          ]
        },

        // DevOps plugins
        {
          id: "docker-tasks",
          name: "Docker Tasks",
          description: "Common Docker operations and container management",
          category: "devops",
          author: "invokej",
          version: "1.2.0",
          source: "github:invokej/plugins/docker-tasks",
          keywords: ["docker", "containers", "devops"],
          requirements: ["docker"],
          methods: [
            { name: "docker_build", description: "Build Docker image" },
            { name: "docker_run", description: "Run container" },
            { name: "docker_compose", description: "Manage with docker-compose" },
            { name: "docker_clean", description: "Clean unused resources" }
          ]
        },
        {
          id: "k8s-deploy",
          name: "Kubernetes Deploy",
          description: "Kubernetes deployment and management tasks",
          category: "devops",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/k8s-deploy",
          keywords: ["kubernetes", "k8s", "deployment", "helm"],
          requirements: ["kubectl", "helm"],
          methods: [
            { name: "k8s_deploy", description: "Deploy to Kubernetes" },
            { name: "k8s_rollback", description: "Rollback deployment" },
            { name: "k8s_status", description: "Check deployment status" }
          ]
        },

        // Cloud deployment plugins
        {
          id: "aws-deploy",
          name: "AWS Deployment",
          description: "Deploy to various AWS services",
          category: "cloud",
          author: "invokej",
          version: "2.0.0",
          source: "github:invokej/plugins/aws-deploy",
          keywords: ["aws", "lambda", "s3", "deployment"],
          requirements: ["aws-cli"],
          methods: [
            { name: "aws_deploy", description: "Deploy to AWS service" },
            { name: "aws_lambda", description: "Deploy Lambda function" },
            { name: "aws_s3_sync", description: "Sync files to S3" }
          ]
        },
        {
          id: "vercel-deploy",
          name: "Vercel Deployment",
          description: "Deploy projects to Vercel",
          category: "cloud",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/vercel-deploy",
          keywords: ["vercel", "nextjs", "deployment"],
          requirements: ["vercel-cli"],
          methods: [
            { name: "vercel_deploy", description: "Deploy to Vercel" },
            { name: "vercel_preview", description: "Create preview deployment" }
          ]
        },

        // Testing plugins
        {
          id: "test-runner",
          name: "Test Runner",
          description: "Advanced test running with coverage and reports",
          category: "testing",
          author: "invokej",
          version: "1.1.0",
          source: "github:invokej/plugins/test-runner",
          keywords: ["testing", "jest", "vitest", "coverage"],
          methods: [
            { name: "test", description: "Run tests with options" },
            { name: "test_coverage", description: "Generate coverage report" },
            { name: "test_watch", description: "Run tests in watch mode" }
          ]
        },
        {
          id: "e2e-playwright",
          name: "E2E Testing with Playwright",
          description: "End-to-end testing using Playwright",
          category: "testing",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/e2e-playwright",
          keywords: ["e2e", "playwright", "testing", "browser"],
          requirements: ["playwright"],
          methods: [
            { name: "e2e_test", description: "Run E2E tests" },
            { name: "e2e_debug", description: "Debug E2E tests" },
            { name: "e2e_record", description: "Record test scenarios" }
          ]
        },

        // Database plugins
        {
          id: "db-migrate",
          name: "Database Migrations",
          description: "Database migration management",
          category: "database",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/db-migrate",
          keywords: ["database", "migrations", "sql", "schema"],
          methods: [
            { name: "db_migrate", description: "Run migrations" },
            { name: "db_rollback", description: "Rollback migrations" },
            { name: "db_seed", description: "Seed database" }
          ]
        },
        {
          id: "mongo-backup",
          name: "MongoDB Backup",
          description: "MongoDB backup and restore utilities",
          category: "database",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/mongo-backup",
          keywords: ["mongodb", "backup", "restore", "database"],
          requirements: ["mongodump", "mongorestore"],
          methods: [
            { name: "mongo_backup", description: "Backup MongoDB" },
            { name: "mongo_restore", description: "Restore from backup" }
          ]
        },

        // Build & Bundle plugins
        {
          id: "webpack-build",
          name: "Webpack Builder",
          description: "Webpack build tasks with optimization",
          category: "build",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/webpack-build",
          keywords: ["webpack", "bundling", "build", "optimization"],
          methods: [
            { name: "webpack_dev", description: "Start dev server" },
            { name: "webpack_build", description: "Production build" },
            { name: "webpack_analyze", description: "Bundle analysis" }
          ]
        },
        {
          id: "vite-build",
          name: "Vite Builder",
          description: "Vite build and development tasks",
          category: "build",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/vite-build",
          keywords: ["vite", "build", "hmr", "bundling"],
          methods: [
            { name: "vite_dev", description: "Start Vite dev server" },
            { name: "vite_build", description: "Build for production" },
            { name: "vite_preview", description: "Preview production build" }
          ]
        },

        // Git & Version Control
        {
          id: "git-flow",
          name: "Git Flow",
          description: "Git flow workflow automation",
          category: "vcs",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/git-flow",
          keywords: ["git", "flow", "branching", "release"],
          methods: [
            { name: "git_feature", description: "Start/finish feature" },
            { name: "git_release", description: "Create release" },
            { name: "git_hotfix", description: "Create hotfix" }
          ]
        },
        {
          id: "changelog-gen",
          name: "Changelog Generator",
          description: "Generate changelogs from git commits",
          category: "vcs",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/changelog-gen",
          keywords: ["changelog", "release", "commits", "conventional"],
          methods: [
            { name: "changelog", description: "Generate changelog" },
            { name: "release_notes", description: "Create release notes" }
          ]
        },

        // Documentation
        {
          id: "docs-gen",
          name: "Documentation Generator",
          description: "Generate documentation from code",
          category: "docs",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/docs-gen",
          keywords: ["documentation", "jsdoc", "markdown", "api"],
          methods: [
            { name: "docs_generate", description: "Generate documentation" },
            { name: "docs_serve", description: "Serve documentation locally" }
          ]
        },

        // Security
        {
          id: "security-audit",
          name: "Security Audit",
          description: "Security scanning and vulnerability checking",
          category: "security",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/security-audit",
          keywords: ["security", "audit", "vulnerabilities", "scanning"],
          methods: [
            { name: "security_scan", description: "Run security scan" },
            { name: "dep_audit", description: "Audit dependencies" }
          ]
        },

        // AI/ML
        {
          id: "ai-assist",
          name: "AI Assistant",
          description: "AI-powered development assistance",
          category: "ai",
          author: "invokej",
          version: "1.0.0",
          source: "github:invokej/plugins/ai-assist",
          keywords: ["ai", "openai", "copilot", "assistant"],
          requirements: ["openai-api-key"],
          methods: [
            { name: "ai_review", description: "AI code review" },
            { name: "ai_refactor", description: "AI-assisted refactoring" },
            { name: "ai_docs", description: "Generate docs with AI" }
          ]
        }
      ],
      categories: {
        productivity: { name: "Productivity", icon: "📋" },
        devops: { name: "DevOps", icon: "🚀" },
        cloud: { name: "Cloud", icon: "☁️" },
        testing: { name: "Testing", icon: "🧪" },
        database: { name: "Database", icon: "🗄️" },
        build: { name: "Build Tools", icon: "🔨" },
        vcs: { name: "Version Control", icon: "🔀" },
        docs: { name: "Documentation", icon: "📚" },
        security: { name: "Security", icon: "🔒" },
        ai: { name: "AI/ML", icon: "🤖" }
      }
    };
  }

  loadCatalog() {
    if (existsSync(this.catalogFile)) {
      try {
        return JSON.parse(readFileSync(this.catalogFile, "utf-8"));
      } catch (e) {
        console.warn("Failed to load catalog cache, using defaults");
      }
    }
    return this.getDefaultCatalog();
  }

  loadUserPlugins() {
    if (existsSync(this.userPluginsFile)) {
      try {
        return JSON.parse(readFileSync(this.userPluginsFile, "utf-8"));
      } catch (e) {
        return { installed: [], custom: [] };
      }
    }
    return { installed: [], custom: [] };
  }

  saveCatalog() {
    writeFileSync(this.catalogFile, JSON.stringify(this.catalog, null, 2));
  }

  saveUserPlugins() {
    writeFileSync(this.userPluginsFile, JSON.stringify(this.userPlugins, null, 2));
  }

  /**
   * Update catalog from remote registry
   */
  async updateCatalog(registryUrl = "https://api.github.com/repos/invokej/plugin-registry/contents/catalog.json") {
    try {
      console.log("Updating plugin catalog...");
      const response = await fetch(registryUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
      }

      const data = await response.json();
      let catalogContent;

      if (data.content) {
        // GitHub API response
        catalogContent = Buffer.from(data.content, 'base64').toString('utf-8');
      } else if (data.plugins) {
        // Direct JSON response
        catalogContent = JSON.stringify(data);
      } else {
        throw new Error("Invalid catalog format");
      }

      this.catalog = JSON.parse(catalogContent);
      this.catalog.updated = new Date().toISOString();
      this.saveCatalog();

      console.log(`✅ Catalog updated with ${this.catalog.plugins.length} plugins`);
      return true;
    } catch (error) {
      console.error("Failed to update catalog:", error.message);
      console.log("Using cached/default catalog");
      return false;
    }
  }

  /**
   * Search plugins
   */
  searchPlugins(query, options = {}) {
    const { category, author, keywords } = options;
    let results = this.catalog.plugins;

    // Filter by category
    if (category) {
      results = results.filter(p => p.category === category);
    }

    // Filter by author
    if (author) {
      results = results.filter(p => p.author === author);
    }

    // Search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.keywords?.some(k => k.toLowerCase().includes(lowerQuery)) ||
        p.id.toLowerCase().includes(lowerQuery)
      );
    }

    // Filter by keywords
    if (keywords && Array.isArray(keywords)) {
      results = results.filter(p =>
        keywords.some(kw => p.keywords?.includes(kw))
      );
    }

    return results;
  }

  /**
   * List plugins by category
   */
  listByCategory() {
    const categorized = {};

    for (const [key, info] of Object.entries(this.catalog.categories)) {
      categorized[key] = {
        ...info,
        plugins: this.catalog.plugins.filter(p => p.category === key)
      };
    }

    return categorized;
  }

  /**
   * Get plugin details
   */
  getPlugin(pluginId) {
    return this.catalog.plugins.find(p => p.id === pluginId);
  }

  /**
   * Install a plugin
   */
  async installPlugin(pluginId, options = {}) {
    const plugin = this.getPlugin(pluginId);

    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    // Check if already installed
    if (this.isInstalled(pluginId) && !options.force) {
      console.log(`Plugin '${plugin.name}' is already installed`);
      return false;
    }

    console.log(`Installing plugin: ${plugin.name}...`);

    // Parse source (github:user/repo/path or npm:package)
    const [type, ...pathParts] = plugin.source.split(':');
    const path = pathParts.join(':');

    let installedPath;

    try {
      switch (type) {
        case 'github':
          installedPath = await this.installFromGitHub(path, plugin);
          break;
        case 'npm':
          installedPath = await this.installFromNpm(path, plugin);
          break;
        case 'local':
          installedPath = await this.installFromLocal(path, plugin);
          break;
        default:
          throw new Error(`Unknown source type: ${type}`);
      }

      // Mark as installed
      if (!this.userPlugins.installed.some(p => p.id === pluginId)) {
        this.userPlugins.installed.push({
          id: pluginId,
          version: plugin.version,
          installedAt: new Date().toISOString(),
          path: installedPath
        });
        this.saveUserPlugins();
      }

      console.log(`✅ Plugin '${plugin.name}' installed successfully`);

      // Show usage examples
      if (plugin.examples && plugin.examples.length > 0) {
        console.log("\nExample usage:");
        plugin.examples.forEach(ex => console.log(`  ${ex}`));
      }

      return true;
    } catch (error) {
      console.error(`Failed to install plugin: ${error.message}`);
      return false;
    }
  }

  async installFromGitHub(path, plugin) {
    const pluginDir = join(this.pluginsDir, plugin.id);

    // Create plugin directory
    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true });
    }

    // Clone or download from GitHub
    const [owner, repo, ...filePath] = path.split('/');
    const githubUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath.join('/')}`;

    const response = await fetch(githubUrl);
    if (!response.ok) {
      throw new Error(`Failed to download plugin from GitHub`);
    }

    const content = await response.text();
    const pluginFile = join(pluginDir, 'index.js');

    writeFileSync(pluginFile, content);
    return pluginFile;
  }

  async installFromNpm(packageName, plugin) {
    const pluginDir = join(this.pluginsDir, plugin.id);

    // Install npm package
    await execAsync(`cd ${pluginDir} && npm install ${packageName}`);

    return join(pluginDir, 'node_modules', packageName);
  }

  async installFromLocal(path, plugin) {
    // Copy local plugin
    const pluginDir = join(this.pluginsDir, plugin.id);
    const sourcePath = join(process.cwd(), path);

    if (!existsSync(sourcePath)) {
      throw new Error(`Local plugin not found: ${path}`);
    }

    await execAsync(`cp -r ${sourcePath} ${pluginDir}`);
    return pluginDir;
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId) {
    const plugin = this.getPlugin(pluginId);

    if (!plugin) {
      console.error(`Plugin '${pluginId}' not found`);
      return false;
    }

    if (!this.isInstalled(pluginId)) {
      console.log(`Plugin '${plugin.name}' is not installed`);
      return false;
    }

    console.log(`Uninstalling plugin: ${plugin.name}...`);

    // Remove plugin files
    const pluginDir = join(this.pluginsDir, pluginId);
    if (existsSync(pluginDir)) {
      await execAsync(`rm -rf ${pluginDir}`);
    }

    // Remove from installed list
    this.userPlugins.installed = this.userPlugins.installed.filter(
      p => p.id !== pluginId
    );
    this.saveUserPlugins();

    console.log(`✅ Plugin '${plugin.name}' uninstalled successfully`);
    return true;
  }

  /**
   * Check if plugin is installed
   */
  isInstalled(pluginId) {
    return this.userPlugins.installed.some(p => p.id === pluginId);
  }

  /**
   * List installed plugins
   */
  listInstalled() {
    return this.userPlugins.installed.map(installed => {
      const plugin = this.getPlugin(installed.id);
      return {
        ...plugin,
        ...installed
      };
    });
  }

  /**
   * Generate plugin code for tasks.js
   */
  generatePluginCode(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) return null;

    const installed = this.userPlugins.installed.find(p => p.id === pluginId);
    if (!installed) return null;

    let code = `// ${plugin.name} - ${plugin.description}\n`;
    code += `import { ${plugin.name.replace(/\s+/g, '')} } from "${installed.path}";\n\n`;

    if (plugin.methods) {
      plugin.methods.forEach(method => {
        code += `  /** ${method.description} */\n`;
        code += `  async ${method.name}(c, ...args) {\n`;
        code += `    // Implementation using ${plugin.name}\n`;
        code += `  }\n\n`;
      });
    }

    return code;
  }

  /**
   * Check plugin requirements
   */
  async checkRequirements(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (!plugin || !plugin.requirements) return { valid: true };

    const missing = [];

    for (const req of plugin.requirements) {
      if (req.startsWith('bun:')) {
        // Check Bun built-in modules
        continue;
      } else if (req.endsWith('-cli')) {
        // Check CLI tools
        const tool = req.replace('-cli', '');
        try {
          await execAsync(`which ${tool}`);
        } catch {
          missing.push(req);
        }
      } else if (req.endsWith('-api-key')) {
        // Check environment variables
        const envVar = req.replace('-', '_').toUpperCase();
        if (!process.env[envVar]) {
          missing.push(`Environment variable: ${envVar}`);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Export for use in CLI
export default PluginCatalog;

#!/usr/bin/env bun

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, basename } from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

// Template registry - could be fetched from a remote source
const TEMPLATES = {
  basic: {
    name: "Basic",
    description: "Simple task runner setup",
    plugins: [],
    template: `export class Tasks {
  /** Say hello */
  async hello(c, name = "World") {
    await c.run(\`echo 'Hello, \${name}!'\`);
  }

  /** Run tests */
  async test(c) {
    await c.run("bun test", { echo: true });
  }

  /** Build the project */
  async build(c) {
    console.log("Building project...");
    await c.run("bun build ./src/index.js --outdir ./dist", { echo: true });
  }

  /** Clean build artifacts */
  async clean(c) {
    await c.run("rm -rf dist coverage", { echo: true });
  }
}`
  },

  node: {
    name: "Node.js Project",
    description: "Node.js project with npm scripts",
    plugins: [],
    template: `export class Tasks {
  /** Install dependencies */
  async install(c) {
    await c.run("npm install", { echo: true });
  }

  /** Run development server */
  async dev(c, port = "3000") {
    console.log(\`Starting dev server on port \${port}...\`);
    await c.run(\`PORT=\${port} npm run dev\`, { echo: true });
  }

  /** Run tests */
  async test(c, watch = "false") {
    const cmd = watch === "true" ? "npm run test:watch" : "npm test";
    await c.run(cmd, { echo: true });
  }

  /** Build for production */
  async build(c, env = "production") {
    await c.run(\`NODE_ENV=\${env} npm run build\`, { echo: true });
  }

  /** Lint code */
  async lint(c, fix = "false") {
    const cmd = fix === "true" ? "npm run lint:fix" : "npm run lint";
    await c.run(cmd, { echo: true });
  }
}`
  },

  docker: {
    name: "Docker Project",
    description: "Docker-based project with container management",
    plugins: [],
    template: `export class Tasks {
  /** Build Docker image */
  async docker_build(c, tag = "latest") {
    const imageName = "\${PROJECT_NAME}:\${tag}";
    await c.run(\`docker build -t \${imageName} .\`, { echo: true });
  }

  /** Run Docker container */
  async docker_run(c, port = "3000", tag = "latest") {
    const imageName = "\${PROJECT_NAME}:\${tag}";
    await c.run(\`docker run -p \${port}:3000 --rm --name \${PROJECT_NAME} \${imageName}\`, { echo: true });
  }

  /** Stop running container */
  async docker_stop(c) {
    await c.run(\`docker stop \${PROJECT_NAME}\`, { echo: true, warn: true });
  }

  /** Docker compose up */
  async compose_up(c, detached = "false") {
    const flags = detached === "true" ? "-d" : "";
    await c.run(\`docker-compose up \${flags}\`, { echo: true });
  }

  /** Docker compose down */
  async compose_down(c) {
    await c.run("docker-compose down", { echo: true });
  }

  /** View logs */
  async logs(c, tail = "100") {
    await c.run(\`docker logs -f --tail=\${tail} \${PROJECT_NAME}\`, { echo: true });
  }
}`
  },

  fullstack: {
    name: "Full-Stack Application",
    description: "Full-stack app with frontend and backend tasks",
    plugins: [],
    template: `export class Tasks {
  /** Install all dependencies */
  async install(c) {
    console.log("Installing backend dependencies...");
    await c.run("cd backend && npm install", { echo: true });
    console.log("Installing frontend dependencies...");
    await c.run("cd frontend && npm install", { echo: true });
  }

  /** Start development servers */
  async dev(c) {
    console.log("Starting development servers...");
    // Start backend
    await c.run("cd backend && npm run dev &", { echo: true });
    // Start frontend
    await c.run("cd frontend && npm run dev", { echo: true });
  }

  /** Run all tests */
  async test(c, type = "all") {
    if (type === "all" || type === "backend") {
      await c.run("cd backend && npm test", { echo: true });
    }
    if (type === "all" || type === "frontend") {
      await c.run("cd frontend && npm test", { echo: true });
    }
  }

  /** Build for production */
  async build(c) {
    console.log("Building backend...");
    await c.run("cd backend && npm run build", { echo: true });
    console.log("Building frontend...");
    await c.run("cd frontend && npm run build", { echo: true });
  }

  /** Deploy application */
  async deploy(c, env = "staging") {
    await this.test(c);
    await this.build(c);
    console.log(\`Deploying to \${env}...\`);
    await c.run(\`./scripts/deploy.sh \${env}\`, { echo: true });
  }
}`
  },

  python: {
    name: "Python Project",
    description: "Python project with virtual environment",
    plugins: [],
    template: `export class Tasks {
  /** Create virtual environment */
  async venv_create(c) {
    await c.run("python -m venv venv", { echo: true });
    console.log("Virtual environment created. Activate with: source venv/bin/activate");
  }

  /** Install dependencies */
  async install(c, dev = "false") {
    const reqFile = dev === "true" ? "requirements-dev.txt" : "requirements.txt";
    await c.run(\`pip install -r \${reqFile}\`, { echo: true });
  }

  /** Run tests */
  async test(c, coverage = "false") {
    const cmd = coverage === "true"
      ? "pytest --cov=. --cov-report=html"
      : "pytest";
    await c.run(cmd, { echo: true });
  }

  /** Format code */
  async format(c) {
    await c.run("black . && isort .", { echo: true });
  }

  /** Lint code */
  async lint(c) {
    await c.run("flake8 . && mypy .", { echo: true });
  }

  /** Run application */
  async run(c, args = "") {
    await c.run(\`python main.py \${args}\`, { echo: true });
  }
}`
  },

  api: {
    name: "REST API",
    description: "REST API with database and testing",
    plugins: [],
    template: `export class Tasks {
  /** Start development server */
  async dev(c, port = "3000") {
    await c.run(\`PORT=\${port} npm run dev\`, { echo: true });
  }

  /** Run database migrations */
  async db_migrate(c, direction = "up") {
    await c.run(\`npm run db:migrate:\${direction}\`, { echo: true });
  }

  /** Seed database */
  async db_seed(c) {
    await c.run("npm run db:seed", { echo: true });
  }

  /** Reset database */
  async db_reset(c) {
    console.log("Resetting database...");
    await c.run("npm run db:reset", { echo: true });
    await this.db_migrate(c);
    await this.db_seed(c);
  }

  /** Run API tests */
  async test(c, type = "unit") {
    const testCmd = type === "integration"
      ? "npm run test:integration"
      : "npm run test:unit";
    await c.run(testCmd, { echo: true });
  }

  /** Generate API documentation */
  async docs(c) {
    await c.run("npm run generate:docs", { echo: true });
    console.log("API documentation generated at ./docs/api.html");
  }

  /** Health check */
  async health(c, url = "http://localhost:3000") {
    await c.run(\`curl -f \${url}/health || exit 1\`, { echo: true });
  }
}`
  }
};

// Plugin registry with categories
const PLUGINS = {
  database: [
    {
      id: "todo_mgr",
      name: "Todo Manager",
      description: "SQLite-based todo management system",
      path: "invokej/plugins/todo_mgr.js",
      setup: `
  constructor() {
    this.manager = new ToDoManager();
    this.ui = new TodoUI(this.manager);
  }

  /** Add a new todo */
  async add_todo(c, title, description = "", priority = "3") {
    const id = this.manager.addTodo(title, description, parseInt(priority));
    console.log(\`Added todo #\${id}: \${title}\`);
  }

  /** List all todos */
  async list_todos(c, status = "pending") {
    const todos = this.manager.getTodos(status);
    this.ui.displayTodoList(todos, status);
  }`
    },
    {
      id: "work_mgr",
      name: "Work Manager",
      description: "Project and time tracking system",
      path: "invokej/plugins/work_mgr.js",
      setup: `
  constructor() {
    this.workMgr = new WorkManager();
  }

  /** Start work timer */
  async work_start(c, project, description = "") {
    const id = this.workMgr.startWork(project, description);
    console.log(\`Started work session #\${id} for \${project}\`);
  }

  /** Stop work timer */
  async work_stop(c) {
    this.workMgr.stopWork();
    console.log("Work session stopped");
  }`
    }
  ],

  deployment: [
    {
      id: "aws_deploy",
      name: "AWS Deployment",
      description: "AWS deployment utilities",
      setup: `
  /** Deploy to AWS */
  async aws_deploy(c, service = "lambda", env = "dev") {
    await c.run(\`aws \${service} deploy --stage \${env}\`, { echo: true });
  }

  /** Check AWS status */
  async aws_status(c, service) {
    await c.run(\`aws \${service} describe\`, { echo: true });
  }`
    },
    {
      id: "vercel_deploy",
      name: "Vercel Deployment",
      description: "Vercel deployment utilities",
      setup: `
  /** Deploy to Vercel */
  async vercel_deploy(c, env = "preview") {
    const flag = env === "production" ? "--prod" : "";
    await c.run(\`vercel \${flag}\`, { echo: true });
  }`
    }
  ],

  testing: [
    {
      id: "e2e_testing",
      name: "E2E Testing",
      description: "End-to-end testing with Playwright",
      setup: `
  /** Run E2E tests */
  async e2e(c, browser = "chromium", headed = "false") {
    const headedFlag = headed === "true" ? "--headed" : "";
    await c.run(\`playwright test --browser=\${browser} \${headedFlag}\`, { echo: true });
  }`
    }
  ],

  monitoring: [
    {
      id: "health_check",
      name: "Health Monitoring",
      description: "Service health monitoring",
      setup: `
  /** Check service health */
  async health_check(c, services = "all") {
    // Implementation for health checks
    console.log(\`Checking health for: \${services}\`);
  }`
    }
  ]
};

/**
 * Interactive prompt utility
 */
async function prompt(question, defaultValue = "") {
  process.stdout.write(`${question}${defaultValue ? ` [${defaultValue}]` : ""}: `);

  for await (const line of console) {
    return line.trim() || defaultValue;
  }
}

/**
 * Select from options
 */
async function select(question, options, defaultIndex = 0) {
  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? ">" : " ";
    console.log(`  ${marker} ${i + 1}. ${opt.name || opt}`);
  });

  process.stdout.write(`\nSelect (1-${options.length}) [${defaultIndex + 1}]: `);

  for await (const line of console) {
    const choice = parseInt(line.trim() || (defaultIndex + 1));
    if (choice >= 1 && choice <= options.length) {
      return options[choice - 1];
    }
    console.log("Invalid selection. Please try again.");
    process.stdout.write(`Select (1-${options.length}) [${defaultIndex + 1}]: `);
  }
}

/**
 * Multi-select from options
 */
async function multiSelect(question, options) {
  console.log(`\n${question}`);
  console.log("(Enter numbers separated by commas, or press Enter for none)\n");

  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.name} - ${opt.description}`);
  });

  process.stdout.write(`\nSelect plugins: `);

  for await (const line of console) {
    if (!line.trim()) return [];

    const indices = line.split(",").map(s => parseInt(s.trim()) - 1);
    return indices
      .filter(i => i >= 0 && i < options.length)
      .map(i => options[i]);
  }
}

/**
 * Initialize a new invokej project
 */
export async function initProject(options = {}) {
  console.log("\n🚀 Welcome to invokej project initialization!\n");
  console.log("This utility will help you create a tasks.js file for your project.\n");

  // Check if tasks.js already exists
  if (existsSync("tasks.js") && !options.force) {
    const overwrite = await prompt("tasks.js already exists. Overwrite? (y/n)", "n");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Initialization cancelled.");
      return;
    }
  }

  // Get project information
  const projectName = await prompt("Project name", basename(process.cwd()));
  const projectType = await select(
    "Select project template:",
    Object.entries(TEMPLATES).map(([key, val]) => ({
      key,
      name: val.name,
      description: val.description
    }))
  );

  // Select plugins
  console.log("\n📦 Available Plugins:\n");
  const allPlugins = [];
  Object.entries(PLUGINS).forEach(([category, plugins]) => {
    console.log(`\n${category.toUpperCase()}:`);
    plugins.forEach(plugin => {
      allPlugins.push({ ...plugin, category });
      console.log(`  • ${plugin.name}: ${plugin.description}`);
    });
  });

  const usePlugins = await prompt("\nWould you like to add plugins? (y/n)", "y");
  let selectedPlugins = [];

  if (usePlugins.toLowerCase() === "y") {
    selectedPlugins = await multiSelect("Select plugins to include:", allPlugins);
  }

  // Generate tasks.js content
  let tasksContent = TEMPLATES[projectType.key].template;

  // Replace template variables
  tasksContent = tasksContent.replace(/\${PROJECT_NAME}/g, projectName);

  // Add plugin imports if needed
  if (selectedPlugins.length > 0) {
    const imports = selectedPlugins
      .filter(p => p.path)
      .map(p => `import { ${p.name.replace(/\s+/g, "")} } from "${p.path}";`)
      .join("\n");

    const constructorSetup = selectedPlugins
      .filter(p => p.setup && p.setup.includes("constructor"))
      .map(p => p.setup.match(/constructor\(\) {([^}]+)}/)?.[1] || "")
      .join("\n");

    const pluginMethods = selectedPlugins
      .filter(p => p.setup)
      .map(p => {
        // Extract methods from setup
        const methodsMatch = p.setup.match(/async \w+\(.*?\) {[\s\S]*?}/g);
        return methodsMatch ? methodsMatch.join("\n\n") : "";
      })
      .filter(Boolean)
      .join("\n\n");

    // Rebuild tasks content with plugins
    const classMatch = tasksContent.match(/(export class Tasks {)([\s\S]*)(})/);
    if (classMatch) {
      let classContent = classMatch[2];

      // Add constructor if we have plugin setup
      if (constructorSetup) {
        classContent = `
  constructor() {${constructorSetup}
  }
` + classContent;
      }

      // Add plugin methods
      if (pluginMethods) {
        classContent += "\n\n  // Plugin methods\n" + pluginMethods;
      }

      tasksContent = (imports ? imports + "\n\n" : "") +
                    classMatch[1] + classContent + classMatch[3];
    }
  }

  // Create additional files based on template
  const additionalFiles = {
    basic: [],
    node: [
      {
        path: "package.json",
        content: JSON.stringify({
          name: projectName,
          version: "1.0.0",
          scripts: {
            dev: "echo 'Dev server'",
            test: "echo 'Tests'",
            build: "echo 'Building'",
            lint: "echo 'Linting'"
          }
        }, null, 2)
      }
    ],
    docker: [
      {
        path: "Dockerfile",
        content: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`
      },
      {
        path: "docker-compose.yml",
        content: `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development`
      }
    ],
    fullstack: [
      { path: "backend/package.json", content: '{"name": "backend"}' },
      { path: "frontend/package.json", content: '{"name": "frontend"}' }
    ],
    python: [
      { path: "requirements.txt", content: "# Add your dependencies here" },
      { path: "requirements-dev.txt", content: "pytest\nblack\nisort\nflake8\nmypy" }
    ],
    api: [
      {
        path: ".env.example",
        content: `DATABASE_URL=postgres://localhost:5432/${projectName}
PORT=3000
NODE_ENV=development`
      }
    ]
  };

  // Write tasks.js
  writeFileSync("tasks.js", tasksContent);
  console.log("\n✅ Created tasks.js");

  // Create additional files
  const files = additionalFiles[projectType.key] || [];
  for (const file of files) {
    const dir = file.path.split("/").slice(0, -1).join("/");
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(file.path, file.content);
    console.log(`✅ Created ${file.path}`);
  }

  // Create .invokej config file
  const config = {
    version: "1.0",
    projectName,
    template: projectType.key,
    plugins: selectedPlugins.map(p => p.id),
    created: new Date().toISOString()
  };

  writeFileSync(".invokej.json", JSON.stringify(config, null, 2));
  console.log("✅ Created .invokej.json config file");

  // Show next steps
  console.log("\n🎉 Project initialized successfully!\n");
  console.log("Next steps:");
  console.log("  1. Review your tasks.js file");
  console.log("  2. Run 'invokej --list' to see available tasks");

  if (selectedPlugins.length > 0) {
    console.log("  3. Install plugin dependencies if needed");
  }

  console.log("\nExample commands:");
  console.log("  invokej hello");

  const exampleTask = Object.keys(TEMPLATES[projectType.key].template.match(/async (\w+)/g)?.[0] || {hello: true})[0];
  if (exampleTask && exampleTask !== "hello") {
    console.log(`  invokej ${exampleTask}`);
  }

  console.log("\nHappy task running! 🚀");
}

// Run if called directly
if (import.meta.main) {
  initProject().catch(console.error);
}

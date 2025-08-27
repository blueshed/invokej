/**
 * Basic invokej Example
 *
 * This is a simple starter template showing basic task definitions.
 * Place this as 'tasks.js' in your project root.
 *
 * Usage:
 *   invokej --list        # List all available tasks
 *   invokej hello         # Run the hello task
 *   invokej build         # Run the build task
 */

export class Tasks {
  /** Say hello */
  async hello(c, name = "World") {
    await c.run(`echo 'Hello, ${name}!'`);
  }

  /** Install dependencies */
  async install(c) {
    console.log("Installing dependencies...");
    await c.run("npm install", { echo: true });
  }

  /** Run tests */
  async test(c) {
    console.log("Running tests...");
    await c.run("npm test", { echo: true });
  }

  /** Build the project */
  async build(c, env = "development") {
    console.log(`Building for ${env}...`);
    await c.run(`NODE_ENV=${env} npm run build`, { echo: true });
  }

  /** Clean build artifacts */
  async clean(c) {
    console.log("Cleaning build artifacts...");
    await c.run("rm -rf dist node_modules/.cache coverage", { echo: true });
  }

  /** Start development server */
  async dev(c, port = "3000") {
    console.log(`Starting dev server on port ${port}...`);
    await c.run(`PORT=${port} npm run dev`, { echo: true });
  }

  /** Deploy to production */
  async deploy(c, target = "staging") {
    console.log(`Deploying to ${target}...`);

    // Run tests first
    await this.test(c);

    // Build
    await this.build(c, "production");

    // Deploy
    await c.run(`npm run deploy:${target}`, { echo: true });

    console.log(`✅ Successfully deployed to ${target}!`);
  }
}

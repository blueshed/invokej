/**
 * Simple test fixture for basic task testing
 */
export class Tasks {
  /** Say hello to someone */
  async hello(c, name = "World") {
    await c.run(`echo 'Hello, ${name}!'`, { hide: true });
    return `Hello, ${name}!`;
  }

  /** Build the project */
  async build(c, env = "dev") {
    console.log(`Building for ${env}...`);
    return { env, status: "built" };
  }

  /** Private helper method */
  async _privateHelper(c) {
    return "This should not be callable";
  }
}

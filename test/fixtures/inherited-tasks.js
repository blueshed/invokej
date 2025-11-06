/**
 * Test fixture for testing class inheritance
 */

export class BaseTasks {
  /** Base task that should be inherited */
  async baseTask(c) {
    return "base task executed";
  }

  /** Another base task */
  async sharedTask(c, arg = "default") {
    return `base: ${arg}`;
  }
}

export class Tasks extends BaseTasks {
  /** Override shared task */
  async sharedTask(c, arg = "default") {
    return `child: ${arg}`;
  }

  /** Child-specific task */
  async childTask(c) {
    return "child task executed";
  }
}

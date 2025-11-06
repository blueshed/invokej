/**
 * Test fixture with namespaces
 */

class DbNamespace {
  /** Run migrations */
  async migrate(c, direction = "up") {
    return { action: "migrate", direction };
  }

  /** Seed database */
  async seed(c) {
    return { action: "seed" };
  }

  /** Private method in namespace */
  async _internal(c) {
    return "Should not be accessible";
  }
}

class _PrivateNamespace {
  /** This should not be accessible */
  async method(c) {
    return "Private namespace";
  }
}

export class Tasks {
  constructor() {
    this.db = new DbNamespace();
    this._private = new _PrivateNamespace();
  }

  /** Root level task */
  async build(c) {
    return { action: "build" };
  }

  /** Private root task */
  async _rootPrivate(c) {
    return "Private root";
  }
}

export class Tasks {
  /** Clean the build directory */
  async clean(c) {
    console.log("Cleaning...");
    await c.run("echo 'Cleaning build directories...'");
    await c.run("echo 'Would remove: dist/ build/ *.tmp'");
    console.log("Clean complete!");
  }

  /** Build the project (target: dev|prod) */
  async build(c, target = "dev") {
    console.log(`Building for target: ${target}`);
    await c.run("echo 'Creating build directory...'");
    await c.run(`echo 'Building for ${target} environment'`, { echo: true });

    if (target === "prod") {
      await c.run("echo 'Production build: optimizing assets...'");
    } else {
      await c.run("echo 'Development build: enabling debug mode...'");
    }

    console.log("Build complete!");
  }

  /** Release the project (version, dryRun) */
  async release(c, version = "latest", dryRun = "false") {
    console.log(`Releasing version: ${version}, dryRun=${dryRun}`);

    const isDryRun = dryRun === "true";

    if (isDryRun) {
      await c.run("echo '=== DRY RUN MODE ==='", { echo: true });
    }

    // Run tests first
    await c.run("echo 'Running test suite...'");

    // Build for production
    await this.build(c, "prod");

    // Tag and push if not dry run
    if (!isDryRun) {
      await c.run(`echo 'Tagging release: v${version}'`);
      await c.run("echo 'Pushing to repository...'");
      await c.run("echo 'Publishing to npm...'");
    } else {
      await c.run(`echo '[DRY RUN] Would tag: v${version}'`);
      await c.run("echo '[DRY RUN] Would push and publish'");
    }

    console.log("Release complete!");
  }

  /** Run tests with coverage */
  async test(c, coverage = "false") {
    console.log("Running tests...");

    if (coverage === "true") {
      await c.run("echo 'Running tests with coverage report...'", {
        echo: true,
      });
      await c.run("echo 'Coverage: 85% - All tests passed!'");
    } else {
      await c.run("echo 'Running basic test suite...'");
      await c.run("echo '✓ Unit tests passed'");
      await c.run("echo '✓ Integration tests passed'");
    }
  }

  /** Start development server */
  async dev(c, port = "3000") {
    console.log(`Starting dev server on port ${port}...`);
    await c.run(
      `echo 'Development server would start on http://localhost:${port}'`,
      { echo: true },
    );
    await c.run("echo 'Hot reload enabled'");
    await c.run("echo 'Press Ctrl+C to stop (simulated)'");
  }

  /** Demonstrate context options (mode: hidden|echo|warn) */
  async demo(c, mode = "normal") {
    console.log(`Running context demo in '${mode}' mode...`);

    if (mode === "hidden") {
      console.log("Commands will be hidden:");
      await c.run("echo 'This output is captured but not shown'", {
        hide: true,
      });
      console.log("Hidden command completed!");
    } else if (mode === "echo") {
      console.log("Commands will show their execution:");
      await c.run("echo 'This shows the command being run'", { echo: true });
      await c.run("echo 'Another echoed command'", { echo: true });
    } else if (mode === "warn") {
      console.log("Demonstrating warn mode (failures don't crash):");
      try {
        await c.run("false", { warn: true }); // Command that fails
        console.log("Continued after failed command due to warn=true");
      } catch (err) {
        console.log("This shouldn't print due to warn mode");
      }
    } else {
      console.log("Normal mode - commands run quietly:");
      await c.run("echo 'Normal execution'");
      await c.run("echo 'Commands run without extra output'");
    }

    console.log("Demo complete!");
  }
}

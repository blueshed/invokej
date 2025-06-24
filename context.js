import { spawn } from "child_process";
import { promisify } from "util";
import path from "path";

export class Context {
  constructor(config = {}) {
    this.config = {
      echo: false,
      warn: false,
      hide: false,
      pty: false,
      ...config
    };
    this.cwd = process.cwd();
  }

  /**
   * Execute a shell command
   * @param {string} command - The command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  async run(command, options = {}) {
    const opts = {
      echo: this.config.echo,
      warn: this.config.warn,
      hide: this.config.hide,
      pty: this.config.pty,
      cwd: this.cwd,
      ...options
    };

    if (opts.echo) {
      console.log(`$ ${command}`);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        shell: true,
        cwd: opts.cwd,
        stdio: opts.hide ? 'pipe' : 'inherit'
      });

      let stdout = '';
      let stderr = '';

      if (opts.hide) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        const result = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: code || 0,
          ok: code === 0,
          failed: code !== 0
        };

        if (code !== 0 && !opts.warn) {
          const error = new Error(`Command failed with exit code ${code}: ${command}`);
          error.result = result;
          reject(error);
        } else {
          resolve(result);
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Change directory context manager
   * @param {string} directory - Directory to change to
   */
  cd(directory) {
    const originalCwd = this.cwd;
    this.cwd = path.resolve(this.cwd, directory);

    return {
      [Symbol.asyncIterator]: async function* () {
        try {
          yield;
        } finally {
          this.cwd = originalCwd;
        }
      }.bind(this)
    };
  }

  /**
   * Get current working directory
   */
  get pwd() {
    return this.cwd;
  }

  /**
   * Execute command with sudo
   * @param {string} command - The command to execute with sudo
   * @param {Object} options - Execution options
   */
  async sudo(command, options = {}) {
    return this.run(`sudo ${command}`, options);
  }

  /**
   * Local run - alias for run method
   * @param {string} command - The command to execute
   * @param {Object} options - Execution options
   */
  async local(command, options = {}) {
    return this.run(command, options);
  }
}

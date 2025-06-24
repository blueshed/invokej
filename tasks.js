import { S3Client, sql, version } from "bun";

/** our tasks manager */
export class Tasks {
  /** Show current working directory (sync method test) */
  info(c) {
    console.log(`Current directory: ${process.cwd()}`);
    console.log(`Bun version: ${version}`);
    console.log("This is a synchronous task (no async keyword)");
  }

  /** hello demo */
  async hello(c, name = "") {
    await c.run(`echo 'Hello, ${name}!'`);
    console.log("This is an asynchronous task");
  }

  /** list public table name */
  async tables(c) {
    const response = await sql`SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name`;

    console.log(response.map((row) => row.table_name).join("\n"));
  }

  /** list s3 bucket */
  async bucket(c, bucket, prefix = "") {
    console.log(`${bucket} filtered by ${prefix}`);
    const response = await S3Client.list({ prefix }, { bucket });
    console.log(response);
  }
}

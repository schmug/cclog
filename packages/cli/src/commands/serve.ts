import { Command } from "commander";
import { existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

export const serveCommand = new Command("serve")
  .description("Start the viewer web UI")
  .option("--db <path>", "path to SQLite database", "./timetravel.db")
  .option("--port <n>", "port to listen on", "3000")
  .option("--team-dir <path>", "directory containing team export files")
  .action((options) => {
    const dbPath: string = options.db;
    const port: string = options.port;
    const teamDir: string | undefined = options.teamDir;

    // 1. Check DB file exists
    const resolvedDb = resolve(dbPath);
    if (!existsSync(resolvedDb)) {
      console.error(`Error: database not found at ${resolvedDb}`);
      process.exit(1);
    }

    // 2. Resolve viewer directory relative to this file
    const viewerDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../viewer"
    );

    // 3. Build environment
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TIMETRAVEL_DB: resolvedDb,
      PORT: port,
    };

    if (teamDir) {
      env.TIMETRAVEL_TEAM_DIR = resolve(teamDir);
    }

    console.log(`Starting viewer on port ${port}...`);
    console.log(`Database: ${resolvedDb}`);
    console.log(`Viewer dir: ${viewerDir}`);

    // 4. Spawn next dev
    const child = spawn("npx", ["next", "dev", "--port", port], {
      cwd: viewerDir,
      env,
      stdio: "inherit",
    });

    child.on("error", (err) => {
      console.error(`Failed to start viewer: ${err.message}`);
      process.exit(1);
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  });

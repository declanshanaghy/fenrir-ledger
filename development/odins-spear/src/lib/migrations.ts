import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MigrationScript {
  name: string;
  filename: string;
  path: string;
  desc: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMigrationsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // src/lib/migrations.ts → ../../migrations/
  return join(dirname(thisFile), "..", "..", "migrations");
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function listMigrations(): MigrationScript[] {
  const migrationsDir = getMigrationsDir();
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
      .sort();
  } catch {
    return [];
  }

  return files.map((filename) => {
    const scriptPath = join(migrationsDir, filename);
    let desc = filename;
    try {
      const content = readFileSync(scriptPath, "utf-8");
      const firstLine = content.split("\n")[0] ?? "";
      if (firstLine.startsWith("//")) {
        desc = firstLine.slice(2).trim();
      }
    } catch {
      // ignore — use filename as fallback
    }
    return { name: filename.replace(".mjs", ""), filename, path: scriptPath, desc };
  });
}

// ─── Run ──────────────────────────────────────────────────────────────────────

/**
 * Spawns the migration script as a child process.
 *
 * Detection heuristic: if the last 10 lines of the script contain a bare
 * `main(` call, the script is self-invoking and we spawn it directly.
 * Otherwise we wrap it with an inline ES-module runner so `main()` is called.
 *
 * onLine receives each line of stdout/stderr as it arrives.
 * onDone receives the exit code (0 = success).
 */
export function runMigration(
  script: MigrationScript,
  onLine: (line: string, stream: "stdout" | "stderr") => void,
  onDone: (exitCode: number) => void,
): void {
  let content = "";
  try {
    content = readFileSync(script.path, "utf-8");
  } catch (err) {
    onLine(`Error reading script: ${String(err)}`, "stderr");
    onDone(1);
    return;
  }

  const tail = content.split("\n").slice(-10).join("\n");
  const selfInvokes = /\bmain\s*\(/.test(tail);

  let proc: ChildProcess;

  if (selfInvokes) {
    proc = spawn("node", [script.path], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
  } else {
    // Wrap: import module and call main()
    const fileUrl = "file://" + script.path;
    const wrapper = `import { main } from ${JSON.stringify(fileUrl)};\nawait main();\n`;
    proc = spawn("node", ["--input-type=module"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    if (proc.stdin) {
      proc.stdin.write(wrapper);
      proc.stdin.end();
    }
  }

  const handleChunk =
    (stream: "stdout" | "stderr") =>
    (chunk: Buffer): void => {
      const text = chunk.toString("utf-8");
      for (const line of text.split("\n")) {
        if (line.length > 0) onLine(line, stream);
      }
    };

  proc.stdout?.on("data", handleChunk("stdout"));
  proc.stderr?.on("data", handleChunk("stderr"));

  proc.on("close", (code) => {
    onDone(code ?? 1);
  });

  proc.on("error", (err) => {
    onLine(`Process error: ${String(err)}`, "stderr");
    onDone(1);
  });
}

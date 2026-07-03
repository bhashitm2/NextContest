import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const OUTPUT_CAP_BYTES = 1024 * 1024; // 1MB per stream

export type RunOptions = {
  image: string;
  argv: string[];
  /** HOST path bind-mounted at /box (when nc-judge itself runs in a container,
   * this must also be visible to the host daemon — compose mounts WORK_DIR at
   * the same path inside and out). */
  workDir: string;
  writable: boolean;
  stdin: string;
  memoryMb: number;
  timeoutMs: number;
};

export type RunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  wallMs: number;
  killedByUs: boolean;
  outputCapped: boolean;
};

/** Docker Desktop on Windows wants forward slashes in -v host paths. */
function hostPath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Run one sandboxed process: no network, hard memory (no swap), one CPU,
 * pid-limited, read-only root, unprivileged user, all capabilities dropped.
 * Killed via `docker kill <name>` when the wall clock expires. */
export function dockerRun(opts: RunOptions): Promise<RunResult> {
  const name = `nc-run-${randomUUID()}`;
  const args = [
    "run",
    "--rm",
    "-i",
    "--name",
    name,
    "--network",
    "none",
    "--memory",
    `${opts.memoryMb}m`,
    "--memory-swap",
    `${opts.memoryMb}m`,
    "--cpus",
    "1",
    "--pids-limit",
    "64",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,size=32m",
    "--user",
    "65534:65534",
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    "-v",
    `${hostPath(opts.workDir)}:/box${opts.writable ? "" : ":ro"}`,
    "-w",
    "/box",
    opts.image,
    ...opts.argv,
  ];

  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let killedByUs = false;
    let outputCapped = false;

    const cap = (current: string, chunk: Buffer): string => {
      if (current.length >= OUTPUT_CAP_BYTES) {
        if (!outputCapped) {
          outputCapped = true;
          killContainer();
        }
        return current;
      }
      return current + chunk.toString("utf8").slice(0, OUTPUT_CAP_BYTES - current.length);
    };

    const killContainer = () => {
      spawn("docker", ["kill", name], { stdio: "ignore" }).on("error", () => {});
    };

    const timer = setTimeout(() => {
      killedByUs = true;
      killContainer();
    }, opts.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => (stdout = cap(stdout, chunk)));
    child.stderr.on("data", (chunk: Buffer) => (stderr = cap(stderr, chunk)));

    child.on("error", () => {
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr, wallMs: Date.now() - started, killedByUs, outputCapped });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout,
        stderr,
        wallMs: Date.now() - started,
        killedByUs,
        outputCapped,
      });
    });

    child.stdin.on("error", () => {}); // program may exit without reading stdin
    child.stdin.end(opts.stdin);
  });
}

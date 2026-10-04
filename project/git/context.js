import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getGitContext(root) {
  try {
    const [branch, status, recent] = await Promise.all([
      git(root, ["branch", "--show-current"]),
      git(root, ["status", "--short"]),
      git(root, ["log", "-5", "--pretty=format:%h%x09%cs%x09%s"]),
    ]);
    return {
      isRepository: true,
      branch: branch.trim() || "detached HEAD",
      modifiedFiles: status.trim().split("\n").filter(Boolean).map((line) => ({ status: line.slice(0, 2), path: line.slice(3) })),
      recentCommits: recent.trim().split("\n").filter(Boolean).map((line) => {
        const [hash, date, ...subject] = line.split("\t");
        return { hash, date, subject: subject.join("\t") };
      }),
    };
  } catch {
    return { isRepository: false, branch: null, modifiedFiles: [], recentCommits: [] };
  }
}

async function git(root, args) {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 5_000,
  });
  return stdout;
}

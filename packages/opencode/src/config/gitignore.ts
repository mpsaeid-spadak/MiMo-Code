import { stat, writeFile } from "fs/promises"
import { join } from "path"

export const SPADAKCODE_GITIGNORE_ENTRIES = [
  "node_modules",
  "package.json",
  "package-lock.json",
  "bun.lock",
  ".gitignore",
  ".cron-lock",
  "scheduled_tasks.json",
]

export async function ensureSpadakcodeGitignore(dir: string) {
  const gitignorePath = join(dir, ".gitignore")
  const exists = await stat(gitignorePath).then(
    () => true,
    () => false,
  )
  if (exists) return
  await writeFile(gitignorePath, SPADAKCODE_GITIGNORE_ENTRIES.join("\n")).catch(() => {})
}

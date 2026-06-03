import { Command } from "commander";
import { buildStatus } from "../lib/status.js";
import { withNotices } from "../lib/with-notices.js";

export function statusCommand(): Command {
  return new Command("status")
    .description("Show installed weave-it package and skill version state.")
    .option("--json", "print machine-readable JSON")
    .action(async (options: { json?: boolean }) => {
      await withNotices(
        { commandName: "status", json: options.json ?? false },
        async () => {
          const result = await buildStatus({ cwd: process.cwd() });
          const { message: _message, notices: _notices, ...rest } = result;
          return {
            json: rest,
            text: result.message,
          };
        },
      );
    });
}

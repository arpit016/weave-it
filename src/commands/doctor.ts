import { Command } from "commander";
import { buildDoctor } from "../lib/doctor.js";
import { withNotices } from "../lib/with-notices.js";

interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
}

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Inspect Weave project health and optionally repair missing safe scaffold files.")
    .option("--fix", "create missing safe scaffold files without overwriting existing files")
    .option("--json", "print machine-readable JSON")
    .action(async (options: DoctorOptions) => {
      const json = options.json ?? false;
      await withNotices({ commandName: "doctor", json }, async () => {
        const result = await buildDoctor({
          cwd: process.cwd(),
          fix: options.fix ?? false,
        });
        const { message: _message, ...rest } = result;
        return {
          json: rest,
          text: result.message,
          exitCode: result.status === "error" ? 1 : 0,
        };
      });
    });
}

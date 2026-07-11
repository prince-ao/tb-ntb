import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// Serve the pipeline's metros.json (committed at the repo root, refreshed weekly by the ETL) as
// /metros.json — via middleware in dev, and emitted into dist at build. Falls back to the committed
// sample fixture when the pipeline output isn't present.
function metrosData(): Plugin {
  const root = path.resolve(__dirname, "../../metros.json");
  const sample = path.resolve(__dirname, "../../contract/metros.sample.json");
  const read = () => fs.readFileSync(fs.existsSync(root) ? root : sample);
  return {
    name: "metros-data",
    configureServer(server) {
      // added directly (not as a returned post-hook) so it runs BEFORE Vite's html fallback
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split("?")[0].replace(/\/$/, "").endsWith("/metros.json")) {
          res.setHeader("Content-Type", "application/json");
          res.end(read());
        } else next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "metros.json", source: read() });
    },
  };
}

// The model is a workspace package whose entry is TS source; alias it so Vite
// transpiles it as first-party source rather than treating it as a prebuilt dep.
export default defineConfig(({ command }) => ({
  plugins: [react(), metrosData()],
  base: command === "build" ? "/tb-ntb/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tb-ntb/model": path.resolve(__dirname, "../model/src/index.ts"),
    },
  },
}));

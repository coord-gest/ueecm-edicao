import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const APP_VERSION = new Date().toISOString();

export default defineConfig({
  nitro: true,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [
    {
      name: "app-version",
      config() {
        return { define: { __APP_VERSION__: JSON.stringify(APP_VERSION) } };
      },
    },
    {
      name: "emit-version-json",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ version: APP_VERSION }),
        });
      },
    },
  ],
});

import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  resolve: {
    alias: {
      "@webapp": path.resolve(rootDir, "src"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(rootDir, "..")],
    },
  },
  build: {
    outDir: path.resolve(rootDir, "../dist/webapp"),
    emptyOutDir: false,
  },
})

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
    root: fileURLToPath(new URL("./fixture", import.meta.url)),
    plugins: [react()],
    resolve: {
        dedupe: ["react", "react-dom", "@base-ui/react"],
    },
    server: {
        host: "127.0.0.1",
        port: 4173,
        strictPort: true,
    },
});

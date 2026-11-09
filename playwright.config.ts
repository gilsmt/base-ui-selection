import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
    testDir: "./test/integration",
    fullyParallel: true,
    forbidOnly: !!process.env["CI"],
    retries: process.env["CI"] ? 2 : 0,
    workers: process.env["CI"] ? 1 : undefined,
    reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : "list",
    timeout: 20_000,
    expect: {
        timeout: 5_000,
    },
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
        },
    ],
    webServer: {
        command: "node node_modules/vite/bin/vite.js --config test/integration/vite.config.ts",
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env["CI"],
        timeout: 120_000,
    },
});

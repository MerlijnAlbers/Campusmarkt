import { defineConfig } from "@playwright/test";

// Deze suite draait alleen lokaal tegen de lokale Supabase-instantie (Mailpit voor magic
// links, een echte Postgres-verbinding voor testopzet). Niet bedoeld voor CI zonder die stack.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

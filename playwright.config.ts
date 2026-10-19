import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local" });

const PUERTO = 3200;

export default defineConfig({
  testDir: "./e2e",
  // Las pruebas comparten una base de datos real: una a la vez y en orden.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Celular, con el Chrome instalado (no hace falta descargar navegadores).
      name: "movil",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/api/salud`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});

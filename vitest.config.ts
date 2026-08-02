import { defineConfig } from "vitest/config";

/**
 * Tests unitarios: rápidos, sin base de datos ni credenciales.
 * Los de punta a punta viven en scripts/ y se corren aparte
 * (`npm run test:e2e`), porque escriben en la base de desarrollo.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});

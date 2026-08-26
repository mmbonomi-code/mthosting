import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests de punta a punta contra la base de DESARROLLO. Escriben datos
 * reales, así que se corren a mano y necesitan NEXT_PUBLIC_SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY en el entorno.
 */
export default defineConfig({
  // Igual que en vitest.config.ts: sin esto, cualquier módulo que use `@/`
  // no se puede importar desde un test.
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["scripts/**/*.test.ts"],
    testTimeout: 180000,
    fileParallelism: false,
  },
});

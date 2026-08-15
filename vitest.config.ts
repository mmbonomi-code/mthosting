import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests unitarios: rápidos, sin base de datos ni credenciales.
 * Los de punta a punta viven en scripts/ y se corren aparte
 * (`npm run test:e2e`), porque escriben en la base de desarrollo.
 *
 * El alias `@/` lo entiende TypeScript por el tsconfig y Next por su build,
 * pero vitest no lee ninguno de los dos: hay que repetírselo acá. Sin esto,
 * un archivo con tests que importe con `@/` falla al cargar y el error habla
 * de un paquete que no existe, que despista bastante.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});

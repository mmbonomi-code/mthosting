/**
 * Permisos por rol contra la base DEV.
 *
 * Los tests unitarios de `lib/secciones.ts` prueban la regla con roles
 * escritos a mano. Esto prueba el eslabón que falta: que el rol que sale de
 * la base para una persona real sea el que la regla espera. Si mañana alguien
 * escribe "Gobernanta" con mayúscula en el enum, los unitarios siguen en
 * verde y la puerta queda abierta.
 *
 * No escribe nada.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { inicioDelRol, puedeEntrar, type Rol } from "../lib/secciones";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("permisos por rol (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

  /** Lo mismo que hace el guardián en proxy.ts. */
  async function rolDe(profileId: string): Promise<Rol | null> {
    const { data } = await s
      .from("personas")
      .select("rol, activo")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!data?.activo) return null;
    return data.rol;
  }

  it("los roles de la base son los que conoce la regla", async () => {
    const { data } = await s
      .from("personas")
      .select("rol")
      .not("rol", "is", null);
    const conocidos: Rol[] = [
      "admin",
      "manager",
      "gobernanta",
      "coordinador",
      "limpieza",
      "propietario",
    ];
    for (const p of data ?? []) {
      expect(conocidos, `rol desconocido: ${p.rol}`).toContain(p.rol);
    }
  });

  it("una gobernanta de verdad entra a limpiezas y no a la caja", async () => {
    const { data: personas } = await s
      .from("personas")
      .select("nombre, profile_id")
      .eq("rol", "gobernanta")
      .eq("activo", true)
      .not("profile_id", "is", null);

    // Si no hay ninguna cargada no hay nada que comprobar, pero se avisa:
    // esta prueba existe justamente para las que pueden entrar.
    if ((personas ?? []).length === 0) {
      console.log("no hay gobernanta con usuario: nada que comprobar");
      return;
    }

    for (const p of personas ?? []) {
      const rol = await rolDe(p.profile_id!);
      expect(rol, p.nombre).toBe("gobernanta");

      // Lo suyo.
      expect(puedeEntrar(rol, "/semana"), p.nombre).toBe(true);
      expect(puedeEntrar(rol, "/limpiezas/abc"), p.nombre).toBe(true);
      expect(puedeEntrar(rol, "/departamentos"), p.nombre).toBe(true);

      // Lo que no.
      for (const ruta of ["/", "/dia", "/caja", "/reclamos", "/personas", "/importar"]) {
        expect(puedeEntrar(rol, ruta), `${p.nombre} en ${ruta}`).toBe(false);
      }

      // Y aterriza en algo que puede abrir, o queda rebotando al entrar.
      const inicio = inicioDelRol(rol);
      expect(puedeEntrar(rol, inicio), p.nombre).toBe(true);

      console.log(`${p.nombre}: entra en ${inicio}, sin acceso al resto`);
    }
  });

  it("a los demás no se les cerró nada", async () => {
    const { data: personas } = await s
      .from("personas")
      .select("nombre, rol, profile_id")
      .in("rol", ["admin", "manager", "coordinador"])
      .eq("activo", true)
      .not("profile_id", "is", null);

    for (const p of personas ?? []) {
      const rol = await rolDe(p.profile_id!);
      // El recorte es solo para gobernanta: el resto sigue como estaba y las
      // restricciones finas las pone cada módulo (caja, reclamos, reporte).
      for (const ruta of ["/", "/dia", "/semana", "/departamentos", "/caja"]) {
        expect(puedeEntrar(rol, ruta), `${p.nombre} (${p.rol}) en ${ruta}`).toBe(true);
      }
      expect(inicioDelRol(rol), p.nombre).toBe("/");
    }
  });
});

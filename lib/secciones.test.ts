import { describe, expect, it } from "vitest";
import { inicioDelRol, puedeEntrar, tieneAccesoLimitado } from "./secciones";

describe("gobernanta", () => {
  it("entra a limpiezas y a departamentos", () => {
    for (const ruta of [
      "/semana",
      "/limpiezas",
      "/limpiezas/nueva",
      "/limpiezas/abc-123",
      "/departamentos",
      "/departamentos/abc-123",
    ]) {
      expect(puedeEntrar("gobernanta", ruta), ruta).toBe(true);
    }
  });

  it("no entra a nada más", () => {
    // Check-in/out, reservas, plata y configuración no son su trabajo.
    for (const ruta of [
      "/",
      "/dia",
      "/dia/abc-123",
      "/dashboard",
      "/reporte",
      "/caja",
      "/reclamos",
      "/propietarios",
      "/personas",
      "/tarifas",
      "/puntos-acceso",
      "/parametros",
      "/importar",
      "/exportar",
      "/ical",
      "/bandeja",
      "/reservas/nueva",
    ]) {
      expect(puedeEntrar("gobernanta", ruta), ruta).toBe(false);
    }
  });

  it("consulta la ficha del departamento pero no la edita", () => {
    expect(puedeEntrar("gobernanta", "/departamentos/abc-123")).toBe(true);
    expect(puedeEntrar("gobernanta", "/departamentos/nuevo")).toBe(false);
    expect(puedeEntrar("gobernanta", "/departamentos/abc-123/editar")).toBe(false);
    expect(puedeEntrar("gobernanta", "/departamentos/abc-123/equipamiento")).toBe(false);
  });

  it("puede bajar el PDF de las limpiezas del día, y ningún otro export", () => {
    expect(puedeEntrar("gobernanta", "/api/exportar/limpiezas-pdf")).toBe(true);
    expect(puedeEntrar("gobernanta", "/api/exportar/limpiezas-rango")).toBe(true);
    // Los contactos de los huéspedes no son suyos.
    expect(puedeEntrar("gobernanta", "/api/exportar/contactos")).toBe(false);
    expect(puedeEntrar("gobernanta", "/api/exportar/caja")).toBe(false);
  });

  it("aterriza en limpiezas, no en la pantalla de inicio", () => {
    // Si aterrizara en "/" quedaría rebotando contra su propia restricción.
    expect(inicioDelRol("gobernanta")).toBe("/semana");
    expect(puedeEntrar("gobernanta", inicioDelRol("gobernanta"))).toBe(true);
  });

  it("un prefijo no abre una ruta que solo empieza parecido", () => {
    // "/semanal" no es "/semana".
    expect(puedeEntrar("gobernanta", "/semanal")).toBe(false);
    expect(puedeEntrar("gobernanta", "/departamentos-viejos")).toBe(false);
  });
});

describe("los demás roles", () => {
  it("no tienen recorte: se restringe solo lo que está escrito", () => {
    for (const rol of ["admin", "manager", "coordinador"] as const) {
      expect(puedeEntrar(rol, "/caja"), rol).toBe(true);
      expect(puedeEntrar(rol, "/parametros"), rol).toBe(true);
      expect(inicioDelRol(rol), rol).toBe("/");
      expect(tieneAccesoLimitado(rol), rol).toBe(false);
    }
  });

  it("sin rol tampoco: es el primer uso, hay que poder crear la ficha de admin", () => {
    expect(puedeEntrar(null, "/")).toBe(true);
    expect(puedeEntrar(null, "/personas")).toBe(true);
    expect(inicioDelRol(null)).toBe("/");
  });

  it("gobernanta es el único con el menú recortado, por ahora", () => {
    expect(tieneAccesoLimitado("gobernanta")).toBe(true);
    expect(tieneAccesoLimitado("limpieza")).toBe(false);
  });
});

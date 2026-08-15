import { describe, expect, it } from "vitest";
import {
  CATALOGO,
  FILA_VENCE,
  TONO_LIMPIEZA,
  TONO_RECLAMO,
  TONO_RESERVA,
  TONO_VENCIMIENTO,
} from "./estados";

describe("el mapa de estados", () => {
  it("cubre los tres dominios y la alerta", () => {
    expect(Object.keys(TONO_RESERVA)).toHaveLength(5);
    expect(Object.keys(TONO_LIMPIEZA)).toHaveLength(6);
    expect(Object.keys(TONO_RECLAMO)).toHaveLength(7);
    expect(CATALOGO).toHaveLength(26);
  });

  it("ningún estado se queda sin color", () => {
    for (const { dominio, estado, tono, etiqueta } of CATALOGO) {
      expect(tono.clases, `${dominio}/${estado}`).toBeTruthy();
      expect(etiqueta, `${dominio}/${estado}`).toBeTruthy();
    }
  });

  it("ningún color escrito a mano: todo sale de los tokens", () => {
    // Si alguien pega un #hex o un color de fábrica de Tailwind, se corta acá.
    for (const { dominio, estado, tono } of CATALOGO) {
      expect(tono.clases, `${dominio}/${estado}`).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(tono.clases, `${dominio}/${estado}`).not.toMatch(
        /\b(?:bg|text|border)-(?:slate|gray|zinc|emerald|amber|red|violet|sky|blue|green|orange|yellow|purple)-\d{2,3}\b/,
      );
    }
    expect(FILA_VENCE).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("el relleno sólido está reservado a las alarmas", () => {
    // El fondo tenue es el default. El relleno sólido se lo ganan solo los
    // estados que piden acción: lo que está pasando ahora, lo que salió mal
    // y lo que ya tendría que estar hecho. Si mañana alguien lo reparte a
    // "Coordinado" o "Confirmada", la pantalla vuelve a gritar entera y no
    // se distingue nada. Por eso está escrito acá y no en un comentario.
    const solidos = CATALOGO.filter((c) => c.tono.clases.includes("text-tinta-inversa"));
    expect(solidos.map((c) => `${c.dominio}/${c.estado}`)).toEqual([
      "reserva/cancelada",
      "limpieza/en_curso",
      "reclamo/rechazado",
      "alerta/vencimiento",
      "alerta/sin_asignar",
      "plazo/vencido",
      "plazo/hoy",
    ]);
  });

  it("el ámbar del isotipo no aparece en ningún estado", () => {
    // Vive solo dentro del logo. El único acento de la interfaz es el
    // terracota (docs/IDENTIDAD-VISUAL.md §4).
    for (const { tono } of CATALOGO) {
      expect(tono.clases.toLowerCase()).not.toContain("e8a33d");
      expect(tono.clases).not.toContain("brandAmber");
    }
  });
});

describe("las señales que no son de color", () => {
  it("tentativa lleva borde punteado", () => {
    // Es la que distingue una reserva sin confirmar de una finalizada, y las
    // dos son grises.
    expect(TONO_RESERVA.tentativa.clases).toContain("border-dashed");
  });

  it("vence pronto lleva punto", () => {
    expect(TONO_VENCIMIENTO.punto).toBe(true);
  });

  it("solo las alarmas dependen de una señal extra", () => {
    const conPunto = CATALOGO.filter((c) => c.tono.punto);
    expect(conPunto.map((c) => c.estado)).toEqual([
      "vencimiento",
      "sin_asignar",
      "hoy",
    ]);
  });
});

describe("la lógica de color es la misma en los tres dominios", () => {
  it("lo que espera a otro es azul", () => {
    const azul = TONO_RESERVA.en_curso.clases;
    expect(TONO_LIMPIEZA.asignada.clases).toBe(azul);
    expect(TONO_RECLAMO.presentado.clases).toBe(azul);
  });

  it("lo cerrado bien es verde", () => {
    const verde = TONO_LIMPIEZA.hecha.clases;
    expect(TONO_LIMPIEZA.verificada.clases).toBe(verde);
    expect(TONO_RECLAMO.cobrado.clases).toBe(verde);
  });

  it("lo cerrado mal es rojo", () => {
    expect(TONO_RECLAMO.rechazado.clases).toBe(TONO_RESERVA.cancelada.clases);
  });

  it("lo inerte es gris, y una limpieza cancelada es inerte, no fallida", () => {
    // Cancelarla no es que salió mal: no va a pasar. En rojo se confundiría
    // con un reclamo rechazado.
    expect(TONO_LIMPIEZA.cancelada.clases).toBe(TONO_LIMPIEZA.pendiente.clases);
    expect(TONO_RESERVA.finalizada.clases).toBe(TONO_LIMPIEZA.pendiente.clases);
  });

  it("la excepción es violeta, y hay una sola", () => {
    expect(TONO_RECLAMO.escalado.clases).toContain("excepcion");
    const violetas = CATALOGO.filter((c) => c.tono.clases.includes("excepcion"));
    expect(violetas.map((c) => c.estado)).toEqual(["escalado"]);
  });

  it("lo que pasa ahora es naranja, y no se confunde con lo que vence", () => {
    // "En proceso" y "vence pronto" son los dos anaranjados, pero el de
    // vencimiento va más profundo para que salte en una tabla llena.
    expect(TONO_LIMPIEZA.en_curso.clases).toContain("bg-accent ");
    expect(TONO_VENCIMIENTO.clases).toContain("bg-accent-hover");
    expect(TONO_VENCIMIENTO.clases).not.toBe(TONO_LIMPIEZA.en_curso.clases);
  });
});

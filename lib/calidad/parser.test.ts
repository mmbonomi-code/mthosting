import { describe, expect, it } from "vitest";
import {
  ErrorArchivoResenas,
  normalizarEncabezado,
  parsearEtiquetas,
  parsearFecha,
  parsearPuntaje,
  parsearResenas,
} from "./parser";

// El encabezado tal como viene de Airbnb (resenas_airbnb_jun-oct_2026.xlsx).
const ENCABEZADO = [
  "ID reseña", "ID anuncio", "Anuncio", "Huésped", "Check-in", "Check-out", "Noches",
  "Puntaje general", "Pt. Limpieza", "Pt. Veracidad", "Pt. Check-in", "Pt. Comunicación",
  "Pt. Ubicación", "Pt. Precio-calidad", "Etiquetas Limpieza", "Etiquetas Veracidad",
  "Etiquetas Check-in", "Etiquetas Comunicación", "Etiquetas Ubicación",
  "Etiquetas Precio-calidad", "Reseña pública", "Comentario privado", "Respuesta anfitrión",
  "Idioma",
];

function fila(cambios: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    "ID reseña": "1789108802302064861",
    "ID anuncio": "1019530860935109849",
    Anuncio: "Exclusivo depto en Recoleta 07",
    Huésped: "Oscar",
    "Check-in": "2026-10-02",
    "Check-out": "2026-10-04",
    Noches: "2",
    "Puntaje general": "5",
    "Pt. Limpieza": "5",
    "Pt. Veracidad": "5",
    "Pt. Check-in": "5",
    "Pt. Comunicación": "5",
    "Pt. Ubicación": "5",
    "Pt. Precio-calidad": "5",
    "Reseña pública": "Excelente en todo sentido!",
    Idioma: "es",
  };
  const valores = { ...base, ...cambios };
  return ENCABEZADO.map((h) => valores[h] ?? "");
}

describe("parsearFecha", () => {
  it("acepta la fecha de Excel ya convertida", () => {
    expect(parsearFecha("2026-10-02")).toBe("2026-10-02");
  });

  it("acepta texto dd/mm/aaaa, día primero", () => {
    expect(parsearFecha("02/10/2026")).toBe("2026-10-02");
    expect(parsearFecha("2/3/2026")).toBe("2026-03-02");
  });

  it("acepta el número de serie de Excel", () => {
    expect(parsearFecha("45658")).toBe("2025-01-01");
  });

  it("rechaza fechas imposibles y basura", () => {
    expect(parsearFecha("31/02/2026")).toBeNull();
    expect(parsearFecha("13/13/2026")).toBeNull();
    expect(parsearFecha("ayer")).toBeNull();
    expect(parsearFecha("")).toBeNull();
    expect(parsearFecha("12345")).toBeNull(); // serie fuera de rango
  });
});

describe("parsearPuntaje", () => {
  it("1 a 5, vacío es null", () => {
    expect(parsearPuntaje("4")).toBe(4);
    expect(parsearPuntaje(" 5 ")).toBe(5);
    expect(parsearPuntaje("")).toBeNull();
  });

  it("fuera de rango o no entero es inválido", () => {
    expect(parsearPuntaje("0")).toBeUndefined();
    expect(parsearPuntaje("6")).toBeUndefined();
    expect(parsearPuntaje("4,5")).toBeUndefined();
    expect(parsearPuntaje("muy bueno")).toBeUndefined();
  });
});

describe("parsearEtiquetas", () => {
  it("separa positivas, negativas y otras, sin el punto final", () => {
    const e = parsearEtiquetas(
      "limpieza",
      "(+) Estaba organizado.\n(-) Había manchas.\nOtro: Faltaba papel\n\n",
    );
    expect(e).toEqual([
      { categoria: "limpieza", signo: "positiva", texto: "Estaba organizado" },
      { categoria: "limpieza", signo: "negativa", texto: "Había manchas" },
      { categoria: "limpieza", signo: "otro", texto: "Faltaba papel" },
    ]);
  });

  it("la misma etiqueta con y sin punto cuenta una vez", () => {
    expect(parsearEtiquetas("checkin", "(+) Fue fácil ingresar.\n(+) Fue fácil ingresar")).toHaveLength(1);
  });

  it("celda vacía, sin etiquetas", () => {
    expect(parsearEtiquetas("precio", "")).toEqual([]);
  });
});

describe("normalizarEncabezado", () => {
  it("saca tildes y signos", () => {
    expect(normalizarEncabezado("Pt. Comunicación")).toBe("pt comunicacion");
    expect(normalizarEncabezado("Etiquetas Precio-calidad")).toBe("etiquetas precio calidad");
  });
});

describe("parsearResenas", () => {
  it("lee una fila completa", () => {
    const { resenas, rechazadas } = parsearResenas([
      ENCABEZADO,
      fila({
        "Pt. Limpieza": "3",
        "Etiquetas Limpieza": "(-) El baño estaba sucio",
        "Comentario privado": "Gracias",
      }),
    ]);
    expect(rechazadas).toEqual([]);
    expect(resenas).toHaveLength(1);
    const r = resenas[0];
    expect(r.fila).toBe(2);
    expect(r.airbnb_resena_id).toBe("1789108802302064861");
    expect(r.fecha_checkin).toBe("2026-10-02");
    expect(r.puntaje_general).toBe(5);
    expect(r.puntajes.limpieza).toBe(3);
    expect(r.etiquetas.limpieza).toEqual([
      { categoria: "limpieza", signo: "negativa", texto: "El baño estaba sucio" },
    ]);
    expect(r.comentario_privado).toBe("Gracias");
    expect(r.respuesta_anfitrion).toBeNull();
  });

  it("acepta fechas en los dos formatos dentro del mismo archivo", () => {
    const { resenas } = parsearResenas([
      ENCABEZADO,
      fila({ "ID reseña": "1" }),
      fila({ "ID reseña": "2", "Check-in": "25/08/2026", "Check-out": "27/08/2026" }),
    ]);
    expect(resenas.map((r) => [r.fecha_checkin, r.fecha_checkout])).toEqual([
      ["2026-10-02", "2026-10-04"],
      ["2026-08-25", "2026-08-27"],
    ]);
  });

  it("los vacíos quedan null, no cadena vacía ni cero", () => {
    const { resenas } = parsearResenas([ENCABEZADO, fila({ "Pt. Ubicación": "", Huésped: "  " })]);
    expect(resenas[0].puntajes.ubicacion).toBeNull();
    expect(resenas[0].huesped_nombre).toBeNull();
    expect(resenas[0].comentario_privado).toBeNull();
    expect(resenas[0].etiquetas).toEqual({});
  });

  it("una fila mala se informa y el resto sigue", () => {
    const { resenas, rechazadas } = parsearResenas([
      ENCABEZADO,
      fila({ "ID reseña": "1", "Puntaje general": "7" }),
      fila({ "ID reseña": "2", "Check-in": "ayer" }),
      fila({ "ID reseña": "3", "Check-out": "2026-10-01" }),
      fila({ "ID reseña": "" }),
      fila({ "ID reseña": "5" }),
    ]);
    expect(resenas.map((r) => r.airbnb_resena_id)).toEqual(["5"]);
    expect(rechazadas.map((r) => r.fila)).toEqual([2, 3, 4, 5]);
  });

  it("la misma reseña dos veces en el archivo: queda la primera", () => {
    const { resenas, rechazadas } = parsearResenas([ENCABEZADO, fila(), fila()]);
    expect(resenas).toHaveLength(1);
    expect(rechazadas[0]).toEqual({ fila: 3, motivo: expect.stringContaining("fila 2") });
  });

  it("ignora filas en blanco y encuentra el encabezado aunque no esté arriba", () => {
    const { resenas } = parsearResenas([[], ["", ""], ENCABEZADO, [], fila()]);
    expect(resenas).toHaveLength(1);
    expect(resenas[0].fila).toBe(5);
  });

  it("sin columnas obligatorias no es el archivo de reseñas", () => {
    expect(() => parsearResenas([["FECHA", "DEPTO", "RESP 1"], ["2026-06-01", "X", "Y"]])).toThrow(
      ErrorArchivoResenas,
    );
    expect(() => parsearResenas([])).toThrow(ErrorArchivoResenas);
  });

  it("guarda la fila original por encabezado, sin celdas vacías", () => {
    const { resenas } = parsearResenas([ENCABEZADO, fila()]);
    expect(resenas[0].raw["Huésped"]).toBe("Oscar");
    expect("Comentario privado" in resenas[0].raw).toBe(false);
  });
});

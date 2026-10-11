import { describe, expect, it } from "vitest";
import { aFila, elegirReserva, fusionar, mismoHuesped, type ReservaCandidata } from "./cruce";
import type { ResenaParseada } from "./parser";

const DEPTO = "depto-1";

function resena(cambios: Partial<ResenaParseada> = {}): ResenaParseada {
  return {
    fila: 2,
    airbnb_resena_id: "R1",
    airbnb_listing_id: "L1",
    anuncio_raw: "Anuncio",
    huesped_nombre: "María Emilia",
    fecha_checkin: "2026-09-26",
    fecha_checkout: "2026-09-27",
    puntaje_general: 5,
    puntajes: { limpieza: 5, veracidad: 5, checkin: 5, comunicacion: 5, ubicacion: 5, precio: 5 },
    etiquetas: {},
    resena_publica: "Todo bien",
    comentario_privado: null,
    respuesta_anfitrion: null,
    idioma: "es",
    raw: {},
    ...cambios,
  };
}

function reserva(id: string, nombre: string | null, cambios: Partial<ReservaCandidata> = {}): ReservaCandidata {
  return {
    id,
    depto_id: DEPTO,
    fecha_checkin: "2026-09-26",
    fecha_checkout: "2026-09-27",
    huesped_nombre: nombre,
    ...cambios,
  };
}

describe("mismoHuesped", () => {
  it("nombre de pila contra nombre completo, sin importar tildes", () => {
    expect(mismoHuesped("María Emilia", "Maria Emilia Insausti")).toBe(true);
    expect(mismoHuesped("Juanma", "Juan Manuel Serrano")).toBe(false);
    expect(mismoHuesped("Candela", "Candela Gomez Nobile")).toBe(true);
    expect(mismoHuesped(null, "Candela")).toBe(false);
  });
});

describe("elegirReserva", () => {
  it("mismo departamento y mismas fechas", () => {
    const r = elegirReserva(resena(), DEPTO, [
      reserva("otra-fecha", "X", { fecha_checkin: "2026-09-25" }),
      reserva("buena", null),
      reserva("otro-depto", "X", { depto_id: "depto-2" }),
    ]);
    expect(r?.id).toBe("buena");
  });

  it("dos en las mismas fechas: desempata el nombre", () => {
    const r = elegirReserva(resena(), DEPTO, [
      reserva("valeria", "Valeria"),
      reserva("maria", "María Emilia Insausti"),
    ]);
    expect(r?.id).toBe("maria");
  });

  it("si el nombre no desempata, no elige", () => {
    expect(elegirReserva(resena(), DEPTO, [reserva("a", "Ana"), reserva("b", "Bea")])).toBeNull();
  });

  it("sin departamento o sin candidatas, nada", () => {
    expect(elegirReserva(resena(), null, [reserva("a", "María")])).toBeNull();
    expect(elegirReserva(resena(), DEPTO, [])).toBeNull();
  });
});

describe("fusionar", () => {
  const existente = { ...aFila(resena({ respuesta_anfitrion: "¡Gracias!" }), DEPTO, "res-1") };

  it("nueva: se escribe entera", () => {
    const nueva = aFila(resena(), DEPTO, "res-1");
    expect(fusionar(null, nueva)).toEqual({ fila: nueva, cambia: true });
  });

  it("idempotente: el mismo dato dos veces no cambia nada", () => {
    const igual = aFila(resena({ respuesta_anfitrion: "¡Gracias!" }), DEPTO, "res-1");
    expect(fusionar(existente as never, igual).cambia).toBe(false);
  });

  it("un vacío no pisa lo cargado", () => {
    const sinRespuesta = aFila(resena(), DEPTO, null);
    const { fila, cambia } = fusionar(existente as never, sinRespuesta);
    expect(cambia).toBe(false);
    expect(fila.respuesta_anfitrion).toBe("¡Gracias!");
    expect(fila.reserva_id).toBe("res-1");
  });

  it("lo que aparece después se completa", () => {
    const antes = aFila(resena(), DEPTO, null);
    const despues = aFila(resena({ respuesta_anfitrion: "¡Gracias!" }), DEPTO, "res-1");
    const { fila, cambia } = fusionar(antes as never, despues);
    expect(cambia).toBe(true);
    expect(fila.respuesta_anfitrion).toBe("¡Gracias!");
    expect(fila.reserva_id).toBe("res-1");
  });

  it("un valor distinto sí cambia", () => {
    const otra = aFila(resena({ puntaje_general: 4, respuesta_anfitrion: "¡Gracias!" }), DEPTO, "res-1");
    expect(fusionar(existente as never, otra)).toMatchObject({ cambia: true, fila: { puntaje_general: 4 } });
  });
});

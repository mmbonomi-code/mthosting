import { describe, expect, it } from "vitest";
import {
  consolidarLote,
  decidirUpsert,
  type ReservaExistente,
} from "./lote";
import type { FilaReserva } from "./parser";

const NBSP = " ";

const ENCABEZADO =
  '"Código de confirmación","Estado","Nombre del huésped","Contacto","Número de adultos","Número de niños","Número de bebés","Fecha de inicio","Fecha de finalización","Número de noches","Reservada","Anuncio","Ganancias"';

function csvCon(...filas: string[]): string {
  return [ENCABEZADO, ...filas].join("\n");
}

function filaCSV(codigo: string, estado: string, nombre: string, contacto: string, ganancias: string): string {
  return `"${codigo}","${estado}","${nombre}","${contacto}","2","0","0","5/8/2026","7/8/2026","2","2026-07-01","Un anuncio","${ganancias}"`;
}

function fila(parcial: Partial<FilaReserva>): FilaReserva {
  return {
    codigo_reserva: "HMTEST0001",
    estado_raw: "Confirmada",
    cancelada: false,
    huesped_nombre: "Ana García",
    huesped_contacto: "+54 11 1234-5678",
    adultos: 2,
    ninos: 0,
    bebes: 0,
    noches: 2,
    fecha_checkin: "2026-08-05",
    fecha_checkout: "2026-08-07",
    fecha_reservada: "2026-07-01",
    listing_nombre_raw: "Un anuncio",
    payout_monto: 100,
    payout_moneda: "USD",
    raw: {},
    ...parcial,
  };
}

function existente(parcial: Partial<ReservaExistente>): ReservaExistente {
  return {
    id: "id-1",
    canal: "airbnb",
    origen: "csv",
    cancelada: false,
    descartada: false,
    datos_completos: true,
    depto_id: "depto-1",
    huesped_nombre: "Ana García",
    huesped_contacto: "+54 11 1234-5678",
    adultos: 2,
    ninos: 0,
    bebes: 0,
    noches: 2,
    fecha_checkin: "2026-08-05",
    fecha_checkout: "2026-08-07",
    fecha_reservada: "2026-07-01",
    listing_nombre_raw: "Un anuncio",
    payout_monto: 100,
    ...parcial,
  };
}

describe("consolidarLote", () => {
  it("con el mismo código en varios archivos gana el más reciente", () => {
    const resultado = consolidarLote([
      {
        nombre: "reservations - 2026-08-02T084540.299.csv",
        contenido: csvCon(filaCSV("HMX", "Cancelación por parte del viajero", "Ana", "", `$${NBSP}0,00`)),
      },
      {
        nombre: "reservations - 2026-07-28T070732.662.csv",
        contenido: csvCon(filaCSV("HMX", "Confirmada", "Ana García", "+54 11 1111-1111", `$${NBSP}80,00`)),
      },
    ]);
    // El archivo del 08-02 es posterior al del 07-28, sin importar el orden de entrada.
    expect(resultado.filas).toHaveLength(1);
    expect(resultado.filas[0].cancelada).toBe(true);
    expect(resultado.advertencias).toHaveLength(0);
  });

  it("nombre sin timestamp va al final y genera advertencia", () => {
    const resultado = consolidarLote([
      {
        nombre: "reservations (3).csv",
        contenido: csvCon(filaCSV("HMX", "Confirmada", "Nombre Nuevo", "+54 11 2222-2222", `$${NBSP}90,00`)),
      },
      {
        nombre: "reservations - 2026-08-02T084540.299.csv",
        contenido: csvCon(filaCSV("HMX", "Confirmada", "Nombre Viejo", "+54 11 1111-1111", `$${NBSP}80,00`)),
      },
    ]);
    expect(resultado.filas[0].huesped_nombre).toBe("Nombre Nuevo");
    expect(resultado.advertencias).toHaveLength(1);
  });

  it("un archivo roto tira el lote entero: nada a medio importar", () => {
    expect(() =>
      consolidarLote([
        {
          nombre: "reservations - 2026-08-02T084540.299.csv",
          contenido: csvCon(filaCSV("HMX", "Confirmada", "Ana", "+54 11 1111-1111", `$${NBSP}80,00`)),
        },
        { nombre: "roto.csv", contenido: '"Columnas","Que no son"\n"a","b"' },
      ]),
    ).toThrow();
  });
});

describe("decidirUpsert — reserva nueva", () => {
  it("crea con depto del alias y origen csv", () => {
    const decision = decidirUpsert(fila({}), null, "depto-9");
    expect(decision.tipo).toBe("nueva");
    if (decision.tipo === "nueva") {
      expect(decision.datos.depto_id).toBe("depto-9");
      expect(decision.datos.origen).toBe("csv");
      expect(decision.datos.datos_completos).toBe(true);
      expect(decision.datos.payout_moneda).toBe("USD");
    }
  });

  it("sin alias entra con depto null (bandeja de sin asignar)", () => {
    const decision = decidirUpsert(fila({}), null, null);
    if (decision.tipo === "nueva") expect(decision.datos.depto_id).toBeNull();
  });
});

describe("decidirUpsert — idempotencia", () => {
  it("la misma fila dos veces produce cero cambios", () => {
    const decision = decidirUpsert(fila({}), existente({}), "depto-1");
    expect(decision.tipo).toBe("sin_cambios");
    if (decision.tipo !== "nueva") expect(decision.cambios).toEqual({});
  });
});

describe("decidirUpsert — preservación de vacíos", () => {
  it("un contacto vacío no pisa el contacto guardado", () => {
    const decision = decidirUpsert(
      fila({ huesped_contacto: null, payout_monto: null }),
      existente({}),
      null,
    );
    expect(decision.tipo).toBe("sin_cambios");
  });

  it("una Ganancias vacía no pisa el monto guardado", () => {
    const decision = decidirUpsert(fila({ payout_monto: null }), existente({ payout_monto: 250.5 }), null);
    if (decision.tipo !== "nueva") {
      expect(decision.cambios.payout_monto).toBeUndefined();
    }
  });

  it("un valor real sí actualiza (Airbnb manda sobre sus campos)", () => {
    const decision = decidirUpsert(
      fila({ huesped_contacto: "+54 11 9999-0000", payout_monto: 120 }),
      existente({}),
      null,
    );
    expect(decision.tipo).toBe("actualizada");
    if (decision.tipo !== "nueva") {
      expect(decision.cambios.huesped_contacto).toBe("+54 11 9999-0000");
      expect(decision.cambios.payout_monto).toBe(120);
    }
  });
});

describe("decidirUpsert — cancelaciones", () => {
  it("al cancelar, el nombre recortado y el teléfono borrado NO pisan los guardados", () => {
    // Caso real: "Nicolas Astruc" pasa a "Nicolas" y el contacto queda vacío.
    const decision = decidirUpsert(
      fila({
        cancelada: true,
        estado_raw: "Cancelación por parte del viajero",
        huesped_nombre: "Ana",
        huesped_contacto: null,
        payout_monto: 0,
      }),
      existente({}),
      null,
    );
    expect(decision.tipo).toBe("actualizada");
    if (decision.tipo !== "nueva") {
      expect(decision.cambios.huesped_nombre).toBeUndefined();
      expect(decision.cambios.huesped_contacto).toBeUndefined();
      expect(decision.cambios.cancelada).toBe(true);
      expect(decision.cancelacionDetectada).toBe(true);
      // El payout 0 de la cancelación sí se registra: es un dato, no un vacío.
      expect(decision.cambios.payout_monto).toBe(0);
    }
  });

  it("cancelada es terminal: un archivo posterior sin la marca no la revierte", () => {
    const decision = decidirUpsert(
      fila({ cancelada: false, estado_raw: "Confirmada" }),
      existente({ cancelada: true }),
      null,
    );
    if (decision.tipo !== "nueva") {
      expect(decision.cambios.cancelada).toBeUndefined();
      expect(decision.anomalias).toHaveLength(1);
      expect(decision.anomalias[0]).toMatch(/terminal/);
    }
  });

  it("cancelada con retención (> 0) actualiza el monto sin drama", () => {
    const decision = decidirUpsert(
      fila({ cancelada: true, payout_monto: 31.94 }),
      existente({ cancelada: true, payout_monto: 100 }),
      null,
    );
    if (decision.tipo !== "nueva") expect(decision.cambios.payout_monto).toBe(31.94);
  });
});

describe("decidirUpsert — descartadas y mapeo", () => {
  it("una descartada que reaparece vuelve a la vida y se informa", () => {
    const decision = decidirUpsert(fila({}), existente({ descartada: true }), null);
    if (decision.tipo !== "nueva") {
      expect(decision.cambios.descartada).toBe(false);
      expect(decision.reaparecida).toBe(true);
    }
  });

  it("completa el depto solo si faltaba: el mapeo manual no se pisa", () => {
    const sinDepto = decidirUpsert(fila({}), existente({ depto_id: null }), "depto-7");
    if (sinDepto.tipo !== "nueva") expect(sinDepto.cambios.depto_id).toBe("depto-7");

    const conDepto = decidirUpsert(fila({}), existente({ depto_id: "depto-1" }), "depto-7");
    if (conDepto.tipo !== "nueva") expect(conDepto.cambios.depto_id).toBeUndefined();
  });

  it("una tentativa del iCal queda completa cuando el CSV trae el contacto", () => {
    const decision = decidirUpsert(
      fila({}),
      existente({ datos_completos: false, huesped_contacto: null }),
      null,
    );
    if (decision.tipo !== "nueva") {
      expect(decision.cambios.datos_completos).toBe(true);
    }
  });
});

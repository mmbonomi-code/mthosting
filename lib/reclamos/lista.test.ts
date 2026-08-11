import { describe, expect, it } from "vitest";
import {
  calcularKpis,
  conPlazos,
  filtrar,
  formatearMonto,
  ordenarPorUrgencia,
  type Filtros,
  type ReclamoEnLista,
} from "./lista";

const HOY = "2026-08-11";

function reclamo(p: Partial<ReclamoEnLista> = {}): ReclamoEnLista {
  return {
    id: "r1",
    estado: "borrador",
    categoria: "mobiliario",
    motivo: "Mancha de vino en el sillón",
    monto_reclamado: 180,
    monto_cobrado: null,
    moneda: "USD",
    url_airbnb: null,
    resuelto_at: null,
    codigo_reserva: "HM4KX92PL",
    huesped_nombre: "Julien Moreau",
    // Check-out del 1: vence el 15, faltan 4 días desde el 11.
    fecha_checkout: "2026-08-01",
    depto_id: "d1",
    depto_codigo: "ARENALES 6",
    ...p,
  };
}

const armar = (...partes: Partial<ReclamoEnLista>[]) =>
  conPlazos(partes.map(reclamo), HOY);

const sinFiltros: Filtros = { q: "", estado: "", depto: "", foco: null };

describe("conPlazos", () => {
  it("le pone a cada reclamo su plazo y su color", () => {
    const [r] = armar({});
    expect(r.semaforo).toBe("proximo");
    expect(r.limite).toBe("2026-08-15");
    expect(r.dias).toBe(4);
  });

  it("un reclamo presentado pasa a mirar el plazo de AirCover", () => {
    const [r] = armar({ estado: "presentado" });
    expect(r.limite).toBe("2026-08-31");
  });
});

describe("calcularKpis", () => {
  it("cuenta urgentes, sin presentar y esperando", () => {
    const lista = armar(
      { id: "a", fecha_checkout: "2026-07-29" }, // vence 12/08 → urgente
      { id: "b", estado: "por_presentar" },
      { id: "c", estado: "presentado" },
      { id: "d", estado: "escalado" },
    );
    expect(calcularKpis(lista, HOY)).toMatchObject({
      urgentes: 1,
      sin_presentar: 2,
      esperando: 2,
    });
  });

  it("los vencidos también entran en urgentes", () => {
    const lista = armar({ fecha_checkout: "2026-07-01" });
    expect(calcularKpis(lista, HOY).urgentes).toBe(1);
  });

  it("un reclamo cerrado no aparece como urgente aunque el check-out sea viejo", () => {
    const lista = armar({ estado: "cobrado", fecha_checkout: "2026-06-01" });
    expect(calcularKpis(lista, HOY).urgentes).toBe(0);
  });

  it("suma lo cobrado en el mes corriente", () => {
    const lista = armar(
      { estado: "cobrado", monto_cobrado: 210, resuelto_at: "2026-08-03T14:00:00Z" },
      { estado: "cobrado", monto_cobrado: 95, resuelto_at: "2026-08-10T14:00:00Z" },
      { estado: "cobrado", monto_cobrado: 500, resuelto_at: "2026-07-28T14:00:00Z" },
    );
    expect(calcularKpis(lista, HOY).cobrado_mes).toBe(305);
  });

  it("mira el día de Buenos Aires, no la hora UTC", () => {
    // 01/08 a las 01:00 UTC son todavía las 22:00 del 31/07 en Buenos Aires.
    const lista = armar({
      estado: "cobrado",
      monto_cobrado: 100,
      resuelto_at: "2026-08-01T01:00:00Z",
    });
    expect(calcularKpis(lista, HOY).cobrado_mes).toBe(0);
  });

  it("un rechazado no suma, aunque tenga fecha de resolución", () => {
    const lista = armar({
      estado: "rechazado",
      monto_cobrado: 0,
      resuelto_at: "2026-08-05T14:00:00Z",
    });
    expect(calcularKpis(lista, HOY).cobrado_mes).toBe(0);
  });
});

describe("ordenarPorUrgencia", () => {
  it("primero lo vencido, después lo urgente, y al fondo lo cerrado", () => {
    const lista = armar(
      { id: "tranquilo", fecha_checkout: "2026-08-10" },
      { id: "cerrado", estado: "cobrado" },
      { id: "vencido", fecha_checkout: "2026-07-01" },
      { id: "urgente", fecha_checkout: "2026-07-30" },
    );
    expect(ordenarPorUrgencia(lista).map((r) => r.id)).toEqual([
      "vencido",
      "urgente",
      "tranquilo",
      "cerrado",
    ]);
  });

  it("dentro del mismo color, primero el que vence antes", () => {
    const lista = armar(
      { id: "en3", fecha_checkout: "2026-07-31" },
      { id: "en1", fecha_checkout: "2026-07-29" },
      { id: "en2", fecha_checkout: "2026-07-30" },
    );
    expect(ordenarPorUrgencia(lista).map((r) => r.id)).toEqual(["en1", "en2", "en3"]);
  });
});

describe("filtrar", () => {
  const lista = armar(
    { id: "a", codigo_reserva: "HM111", huesped_nombre: "Ana Ferreira", depto_id: "d1" },
    {
      id: "b",
      codigo_reserva: "HM222",
      huesped_nombre: "Mark Hollis",
      depto_id: "d2",
      depto_codigo: "GORRITI 1",
      estado: "presentado",
    },
    {
      id: "c",
      codigo_reserva: "HM333",
      huesped_nombre: "Tom Baker",
      depto_id: "d2",
      depto_codigo: "GORRITI 1",
      estado: "cobrado",
      monto_cobrado: 130,
    },
  );

  const ids = (f: Partial<Filtros>) =>
    filtrar(lista, { ...sinFiltros, ...f }).map((r) => r.id);

  it("sin filtros trae todo", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });

  it("busca por código, por huésped, por departamento y por motivo", () => {
    expect(ids({ q: "HM222" })).toEqual(["b"]);
    expect(ids({ q: "ferreira" })).toEqual(["a"]);
    expect(ids({ q: "gorriti" })).toEqual(["b", "c"]);
    expect(ids({ q: "vino" })).toEqual(["a", "b", "c"]);
  });

  it("no distingue mayúsculas ni espacios de más", () => {
    expect(ids({ q: "  HoLLiS " })).toEqual(["b"]);
  });

  it("filtra por estado y por departamento", () => {
    expect(ids({ estado: "presentado" })).toEqual(["b"]);
    expect(ids({ depto: "d2" })).toEqual(["b", "c"]);
  });

  it("los KPIs filtran lo mismo que cuentan", () => {
    expect(ids({ foco: "sin_presentar" })).toEqual(["a"]);
    expect(ids({ foco: "esperando" })).toEqual(["b"]);
    expect(ids({ foco: "cobrado" })).toEqual(["c"]);
  });

  it("los filtros se combinan", () => {
    expect(ids({ q: "gorriti", estado: "cobrado" })).toEqual(["c"]);
    expect(ids({ q: "gorriti", depto: "d1" })).toEqual([]);
  });
});

describe("formatearMonto", () => {
  it("escribe los dólares como se leen acá", () => {
    expect(formatearMonto(1420)).toBe("US$ 1.420");
    // Con centavos van los dos decimales: es plata, no una medición.
    expect(formatearMonto(180.5)).toBe("US$ 180,50");
    expect(formatearMonto(null)).toBe("—");
  });

  it("cero es cero, no un guión", () => {
    expect(formatearMonto(0)).toBe("US$ 0");
  });
});

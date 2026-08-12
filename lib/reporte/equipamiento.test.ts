import { describe, expect, it } from "vitest";
import {
  describir,
  enUsoEl,
  filtrarEquipamiento,
  proximos,
  seEntregaEl,
  seRetiraEl,
  type Equipamiento,
  type FiltrosEquipamiento,
} from "./equipamiento";

const HOY = "2026-08-11";

function equipo(p: Partial<Equipamiento> = {}): Equipamiento {
  return {
    id: "e1",
    tipo: "cuna",
    reserva_id: "r1",
    codigo_reserva: "HM4KX92PL",
    huesped_nombre: "Ana Ferreira",
    depto_id: "d1",
    depto_codigo: "R. PEÑA 1",
    fecha_desde: "2026-08-15",
    fecha_hasta: "2026-08-23",
    estado: "pedido",
    notas: null,
    ...p,
  };
}

describe("enUsoEl", () => {
  it("está en el departamento adentro del tramo, extremos incluidos", () => {
    expect(enUsoEl(equipo(), "2026-08-15")).toBe(true);
    expect(enUsoEl(equipo(), "2026-08-19")).toBe(true);
    expect(enUsoEl(equipo(), "2026-08-23")).toBe(true);
  });

  it("no está ni antes ni después", () => {
    expect(enUsoEl(equipo(), "2026-08-14")).toBe(false);
    expect(enUsoEl(equipo(), "2026-08-24")).toBe(false);
  });

  it("lo ya retirado no está en ningún lado", () => {
    expect(enUsoEl(equipo({ estado: "retirado" }), "2026-08-19")).toBe(false);
  });
});

describe("seEntregaEl y seRetiraEl", () => {
  it("se lleva el día que arranca, y solo si todavía no se entregó", () => {
    expect(seEntregaEl(equipo(), "2026-08-15")).toBe(true);
    expect(seEntregaEl(equipo(), "2026-08-16")).toBe(false);
    expect(seEntregaEl(equipo({ estado: "entregado" }), "2026-08-15")).toBe(false);
  });

  it("se retira el último día", () => {
    expect(seRetiraEl(equipo({ estado: "entregado" }), "2026-08-23")).toBe(true);
    expect(seRetiraEl(equipo({ estado: "entregado" }), "2026-08-22")).toBe(false);
    expect(seRetiraEl(equipo({ estado: "retirado" }), "2026-08-23")).toBe(false);
  });

  it("un pedido de un solo día se entrega y se retira el mismo día", () => {
    const unDia = equipo({ fecha_desde: "2026-08-15", fecha_hasta: "2026-08-15" });
    expect(seEntregaEl(unDia, "2026-08-15")).toBe(true);
    expect(seRetiraEl(unDia, "2026-08-15")).toBe(true);
  });
});

describe("proximos", () => {
  it("deja fuera lo ya retirado y lo que terminó antes de hoy", () => {
    const lista = [
      equipo({ id: "vigente" }),
      equipo({ id: "retirado", estado: "retirado" }),
      equipo({ id: "viejo", fecha_desde: "2026-07-01", fecha_hasta: "2026-07-05" }),
    ];
    expect(proximos(lista, HOY).map((e) => e.id)).toEqual(["vigente"]);
  });

  it("uno que está en curso hoy sigue apareciendo", () => {
    const enCurso = equipo({
      id: "enCurso",
      fecha_desde: "2026-08-09",
      fecha_hasta: "2026-08-14",
    });
    expect(proximos([enCurso], HOY).map((e) => e.id)).toEqual(["enCurso"]);
  });

  it("ordena por fecha de entrega", () => {
    const lista = [
      equipo({ id: "tarde", fecha_desde: "2026-09-01", fecha_hasta: "2026-09-05" }),
      equipo({ id: "temprano", fecha_desde: "2026-08-12", fecha_hasta: "2026-08-14" }),
    ];
    expect(proximos(lista, HOY).map((e) => e.id)).toEqual(["temprano", "tarde"]);
  });
});

describe("describir", () => {
  it("dice qué es y dónde", () => {
    expect(describir(equipo())).toBe("Cuna · R. PEÑA 1");
    expect(describir(equipo({ tipo: "banadera", depto_codigo: null }))).toBe(
      "Bañadera · Sin departamento",
    );
  });
});

describe("filtrarEquipamiento", () => {
  const sinFiltros: FiltrosEquipamiento = { tipo: null, verRetirados: false, q: "" };
  const lista = [
    equipo({ id: "a", tipo: "cuna", depto_codigo: "R. PEÑA 1" }),
    equipo({ id: "b", tipo: "silla", depto_codigo: "SOLDADO 1", huesped_nombre: "Mark Hollis" }),
    equipo({ id: "c", tipo: "cuna", estado: "retirado" }),
  ];
  const ids = (f: Partial<FiltrosEquipamiento>) =>
    filtrarEquipamiento(lista, { ...sinFiltros, ...f }).map((e) => e.id);

  it("por defecto no muestra lo retirado", () => {
    expect(ids({})).toEqual(["a", "b"]);
  });

  it("filtra por tipo", () => {
    expect(ids({ tipo: "silla" })).toEqual(["b"]);
    expect(ids({ tipo: "cuna", verRetirados: true })).toEqual(["a", "c"]);
  });

  it("busca por departamento, huésped y código", () => {
    expect(ids({ q: "soldado" })).toEqual(["b"]);
    expect(ids({ q: "hollis" })).toEqual(["b"]);
    expect(ids({ q: "HM4KX92PL" })).toEqual(["a", "b"]);
  });
});

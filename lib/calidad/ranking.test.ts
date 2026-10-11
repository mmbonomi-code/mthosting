import { describe, expect, it } from "vitest";
import { armarRanking, type ResenaRanking } from "./ranking";

const PERSONAS = [
  { id: "p", nombre: "PATRICIA" },
  { id: "v", nombre: "VANE" },
  { id: "n", nombre: "NUEVA" },
];

let id = 0;
const r = (responsable: string | null, limpieza: number | null, quejas: string[] = []): ResenaRanking => ({
  id: String(++id),
  responsable_id: responsable,
  puntaje_limpieza: limpieza,
  quejasLimpieza: quejas,
});

describe("armarRanking", () => {
  it("ordena por promedio de limpieza y cuenta bajas, 5 y quejas", () => {
    const { enOrden } = armarRanking(
      [r("v", 5), r("v", 3, ["Había manchas"]), r("p", 5), r("p", 4)],
      PERSONAS,
      2,
    );
    expect(enOrden.map((f) => f.nombre)).toEqual(["PATRICIA", "VANE"]);
    expect(enOrden[1]).toMatchObject({ resenas: 2, promedio: 4, cinco: 50, bajas: 1, conQueja: 1 });
  });

  it("con menos del mínimo queda aparte, sin posición", () => {
    const { enOrden, pocas } = armarRanking([r("p", 4), r("p", 4), r("n", 5)], PERSONAS, 2);
    expect(enOrden.map((f) => f.nombre)).toEqual(["PATRICIA"]);
    expect(pocas.map((f) => f.nombre)).toEqual(["NUEVA"]);
  });

  it("las reseñas sin responsable se cuentan aparte; sin puntaje de limpieza no suman", () => {
    const { enOrden, sinAtribuir } = armarRanking([r(null, 5), r(null, 2), r("p", null), r("p", 5)], PERSONAS, 1);
    expect(sinAtribuir).toBe(2);
    expect(enOrden[0].resenas).toBe(1);
  });

  it("a igual promedio, primero quien tiene más reseñas", () => {
    const { enOrden } = armarRanking([r("v", 5), r("p", 5), r("p", 5)], PERSONAS, 1);
    expect(enOrden.map((f) => f.nombre)).toEqual(["PATRICIA", "VANE"]);
  });
});

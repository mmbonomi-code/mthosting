import { describe, expect, it } from "vitest";
import { firmaAlerta } from "./alertas";
import { resumirCalidad, type ResenaResumen } from "./resumen";

const CINCO = { limpieza: 5, veracidad: 5, checkin: 5, comunicacion: 5, ubicacion: 5, precio: 5 };
const DEPTOS = [
  { id: "a", codigo: "ARENALES 2" },
  { id: "b", codigo: "BERUTI 2" },
  { id: "c", codigo: "CIUDAD 1" },
];

const resena = (id: string, depto: string | null, general: number, cambios: Partial<ResenaResumen> = {}): ResenaResumen => ({
  id,
  depto_id: depto,
  reserva_id: `res-${id}`,
  puntaje_general: general,
  puntajes: { ...CINCO },
  ...cambios,
});

describe("resumirCalidad", () => {
  it("promedios generales, por categoría y % de 5 estrellas", () => {
    const { total } = resumirCalidad({
      resenas: [
        resena("1", "a", 5),
        resena("2", "a", 3, { puntajes: { ...CINCO, limpieza: 2, precio: null } }),
      ],
      quejas: [],
      revisadas: new Map(),
      estadias: [],
      deptos: DEPTOS,
    });
    expect(total.resenas).toBe(2);
    expect(total.general).toBe(4);
    expect(total.categorias.limpieza).toBe(3.5);
    expect(total.categorias.precio).toBe(5); // la vacía no cuenta
    expect(total.cinco).toBe(50);
  });

  it("departamentos de peor a mejor, con su queja más repetida", () => {
    const { deptos, quejas } = resumirCalidad({
      resenas: [resena("1", "a", 5), resena("2", "b", 4), resena("3", "b", 3)],
      quejas: [
        { resena_id: "2", categoria: "limpieza", texto: "Había manchas" },
        { resena_id: "3", categoria: "limpieza", texto: "Había manchas" },
        { resena_id: "3", categoria: "checkin", texto: "Tuve que esperar" },
      ],
      revisadas: new Map(),
      estadias: [],
      deptos: DEPTOS,
    });
    expect(deptos.map((d) => d.codigo)).toEqual(["BERUTI 2", "ARENALES 2"]);
    expect(deptos[0].quejaMasRepetida).toEqual({ texto: "Había manchas", veces: 2 });
    expect(quejas[0]).toEqual({ categoria: "limpieza", texto: "Había manchas", veces: 2 });
  });

  it("tasa de reseñas: estadías terminadas con reseña, y deptos sin ninguna reseña", () => {
    const { total, deptos } = resumirCalidad({
      resenas: [resena("1", "a", 5)],
      quejas: [],
      revisadas: new Map(),
      estadias: [
        { id: "res-1", depto_id: "a" },
        { id: "res-x", depto_id: "a" },
        { id: "res-y", depto_id: "c" },
      ],
      deptos: DEPTOS,
    });
    expect(total.tasa).toEqual({ conResena: 1, estadias: 3, pct: (1 / 3) * 100 });
    const ciudad = deptos.find((d) => d.codigo === "CIUDAD 1")!;
    expect(ciudad.resenas).toBe(0);
    expect(ciudad.general).toBeNull();
    expect(ciudad.tasa.pct).toBe(0);
    expect(deptos.at(-1)!.codigo).toBe("CIUDAD 1"); // sin reseñas, al final
  });

  it("alertas: cuentan las que cumplen la regla y no se revisaron con la misma firma", () => {
    const baja = resena("1", "a", 2);
    const revisada = resena("2", "a", 3);
    const firma = firmaAlerta({ puntaje_general: 3, puntajes: revisada.puntajes, negativas: [] });
    const { total, deptos } = resumirCalidad({
      resenas: [baja, revisada, resena("3", "a", 5)],
      quejas: [],
      revisadas: new Map([["2", firma]]),
      estadias: [],
      deptos: DEPTOS,
    });
    expect(total.alertas).toBe(1);
    expect(deptos[0].alertas).toBe(1);
  });

  it("una reseña sin departamento cuenta en el total pero no en la tabla", () => {
    const { total, deptos } = resumirCalidad({
      resenas: [resena("1", null, 4)],
      quejas: [],
      revisadas: new Map(),
      estadias: [],
      deptos: DEPTOS,
    });
    expect(total.resenas).toBe(1);
    expect(deptos).toEqual([]);
  });
});

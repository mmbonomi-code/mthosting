import { describe, expect, it } from "vitest";
import {
  claveDe,
  contar,
  enOrden,
  fotosDe,
  fusionar,
  type FotoPendiente,
  type Pendiente,
} from "./pendientes";

const tilde = (filaId: string, hecho: boolean, creadoEn: number): Pendiente => ({
  clase: "checklist",
  clave: claveDe({ clase: "checklist", limpiezaId: "L1", filaId, hecho }),
  limpiezaId: "L1",
  filaId,
  hecho,
  creadoEn,
});

const texto = (
  campo: "observacion_proxima" | "viatico_monto",
  valor: string,
  creadoEn: number,
): Pendiente => ({
  clase: "texto",
  clave: claveDe({ clase: "texto", limpiezaId: "L1", campo, valor }),
  limpiezaId: "L1",
  campo,
  valor,
  creadoEn,
});

describe("claveDe", () => {
  it("dos tildes de la misma fila son la misma operación", () => {
    const a = claveDe({ clase: "checklist", limpiezaId: "L1", filaId: "F1", hecho: true });
    const b = claveDe({ clase: "checklist", limpiezaId: "L1", filaId: "F1", hecho: false });
    expect(a).toBe(b);
  });

  it("filas distintas son operaciones distintas", () => {
    const a = claveDe({ clase: "checklist", limpiezaId: "L1", filaId: "F1", hecho: true });
    const b = claveDe({ clase: "checklist", limpiezaId: "L1", filaId: "F2", hecho: true });
    expect(a).not.toBe(b);
  });

  it("la misma fila en otra limpieza tampoco se pisa", () => {
    const a = claveDe({ clase: "checklist", limpiezaId: "L1", filaId: "F1", hecho: true });
    const b = claveDe({ clase: "checklist", limpiezaId: "L2", filaId: "F1", hecho: true });
    expect(a).not.toBe(b);
  });

  it("campos de texto distintos no se pisan entre sí", () => {
    const a = claveDe({ clase: "texto", limpiezaId: "L1", campo: "observacion_proxima", valor: "x" });
    const b = claveDe({ clase: "texto", limpiezaId: "L1", campo: "viatico_monto", valor: "x" });
    expect(a).not.toBe(b);
  });
});

describe("fusionar", () => {
  it("tildar y destildar la misma fila deja UNA sola operación, la última", () => {
    let cola: Pendiente[] = [];
    cola = fusionar(cola, tilde("F1", true, 1));
    cola = fusionar(cola, tilde("F1", false, 2));
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ hecho: false, creadoEn: 2 });
  });

  it("tildes de filas distintas se acumulan", () => {
    let cola: Pendiente[] = [];
    cola = fusionar(cola, tilde("F1", true, 1));
    cola = fusionar(cola, tilde("F2", true, 2));
    cola = fusionar(cola, tilde("F3", true, 3));
    expect(cola).toHaveLength(3);
  });

  it("editar tres veces el mismo texto sin señal manda uno solo", () => {
    let cola: Pendiente[] = [];
    cola = fusionar(cola, texto("observacion_proxima", "falta", 1));
    cola = fusionar(cola, texto("observacion_proxima", "faltan toallas", 2));
    cola = fusionar(cola, texto("observacion_proxima", "faltan toallas y jabón", 3));
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ valor: "faltan toallas y jabón" });
  });

  it("un texto no pisa un tilde aunque sean de la misma limpieza", () => {
    let cola: Pendiente[] = [];
    cola = fusionar(cola, tilde("F1", true, 1));
    cola = fusionar(cola, texto("observacion_proxima", "algo", 2));
    expect(cola).toHaveLength(2);
  });
});

describe("enOrden", () => {
  it("sale en el orden en que pasó, no en el que quedó guardado", () => {
    const cola = [tilde("F3", true, 30), tilde("F1", true, 10), tilde("F2", true, 20)];
    expect(enOrden(cola).map((p) => p.creadoEn)).toEqual([10, 20, 30]);
  });

  it("no modifica la cola original", () => {
    const cola = [tilde("F2", true, 20), tilde("F1", true, 10)];
    enOrden(cola);
    expect(cola[0].creadoEn).toBe(20);
  });
});

describe("contar", () => {
  it("una cola vacía es cero: se le muestra 'todo guardado'", () => {
    expect(contar([])).toBe(0);
  });

  it("cuenta lo que falta mandar", () => {
    expect(contar([tilde("F1", true, 1), tilde("F2", true, 2)])).toBe(2);
  });
});

describe("fotosDe", () => {
  const foto = (
    id: string,
    tipo: FotoPendiente["tipo"],
    creadoEn: number,
    limpiezaId = "L1",
  ): FotoPendiente => ({
    id,
    limpiezaId,
    tipo,
    archivo: new Blob(["x"], { type: "image/jpeg" }),
    nombre: `${id}.jpg`,
    creadoEn,
  });

  const cola = [
    foto("c", "terminado", 30),
    foto("a", "terminado", 10),
    foto("b", "huesped", 20),
    foto("d", "terminado", 40, "L2"),
  ];

  it("trae solo las de esa limpieza y esa categoría", () => {
    expect(fotosDe(cola, "L1", "terminado").map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("dos fotos de la misma categoría NO se pisan: son dos fotos", () => {
    expect(fotosDe(cola, "L1", "terminado")).toHaveLength(2);
  });

  it("no mezcla limpiezas distintas", () => {
    expect(fotosDe(cola, "L2", "terminado").map((f) => f.id)).toEqual(["d"]);
  });

  it("las devuelve en el orden en que se sacaron", () => {
    expect(fotosDe(cola, "L1", "terminado").map((f) => f.creadoEn)).toEqual([10, 30]);
  });

  it("una categoría sin fotos devuelve vacío", () => {
    expect(fotosDe(cola, "L1", "arreglar")).toEqual([]);
  });
});

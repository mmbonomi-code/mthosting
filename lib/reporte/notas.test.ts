import { describe, expect, it } from "vitest";
import {
  contarUrgentes,
  estadoDePlazo,
  filtrarNotas,
  ordenarPorUrgencia,
  requiereAtencion,
  textoDePlazo,
  vigenteEl,
  type FiltrosNotas,
  type Nota,
} from "./notas";

const HOY = "2026-08-11";

function nota(p: Partial<Nota> = {}): Nota {
  return {
    id: "n1",
    seccion: "pendiente",
    titulo: "Tapicero",
    detalle: "Abonar 5 sillas. Paga Magui hoy.",
    fecha: HOY,
    fecha_hasta: null,
    depto_id: null,
    depto_codigo: null,
    responsable_id: null,
    responsable_nombre: null,
    estado: "pendiente",
    ...p,
  };
}

describe("estadoDePlazo", () => {
  it("la fecha de hoy es hoy", () => {
    expect(estadoDePlazo(nota(), HOY)).toBe("hoy");
  });

  it("una fecha pasada y todavía pendiente está vencida", () => {
    expect(estadoDePlazo(nota({ fecha: "2026-08-08" }), HOY)).toBe("vencido");
  });

  it("tres días o menos es próximo; más, tranquilo", () => {
    expect(estadoDePlazo(nota({ fecha: "2026-08-14" }), HOY)).toBe("proximo");
    expect(estadoDePlazo(nota({ fecha: "2026-08-15" }), HOY)).toBe("tranquilo");
  });

  it("sin fecha no vence nunca", () => {
    expect(estadoDePlazo(nota({ fecha: null }), HOY)).toBe("sin_fecha");
  });

  it("lo hecho no vence, aunque la fecha haya pasado hace meses", () => {
    expect(estadoDePlazo(nota({ fecha: "2026-01-01", estado: "hecho" }), HOY)).toBe(
      "hecho",
    );
  });

  it("un anuncio con tramo vence cuando termina el tramo, no cuando empieza", () => {
    // "Pintan el 28 y 29": el 28 no está vencido aunque empezó antes.
    const anuncio = nota({
      seccion: "anuncio",
      fecha: "2026-08-09",
      fecha_hasta: "2026-08-13",
    });
    expect(estadoDePlazo(anuncio, HOY)).toBe("proximo");
  });
});

describe("requiereAtencion", () => {
  it("solo lo vencido y lo de hoy", () => {
    expect(requiereAtencion("vencido")).toBe(true);
    expect(requiereAtencion("hoy")).toBe(true);
    expect(requiereAtencion("proximo")).toBe(false);
    expect(requiereAtencion("sin_fecha")).toBe(false);
    expect(requiereAtencion("hecho")).toBe(false);
  });
});

describe("textoDePlazo", () => {
  it("dice las cosas como se dicen", () => {
    expect(textoDePlazo(nota(), HOY)).toBe("Hoy");
    expect(textoDePlazo(nota({ fecha: "2026-08-12" }), HOY)).toBe("Mañana");
    expect(textoDePlazo(nota({ fecha: "2026-08-16" }), HOY)).toBe("En 5 días");
    expect(textoDePlazo(nota({ fecha: "2026-08-10" }), HOY)).toBe("Vencido hace 1 día");
    expect(textoDePlazo(nota({ fecha: "2026-08-07" }), HOY)).toBe("Vencido hace 4 días");
    expect(textoDePlazo(nota({ fecha: null }), HOY)).toBe("Sin fecha");
    expect(textoDePlazo(nota({ estado: "hecho" }), HOY)).toBe("Hecho");
  });
});

describe("vigenteEl", () => {
  const anuncio = nota({
    seccion: "anuncio",
    fecha: "2026-08-28",
    fecha_hasta: "2026-08-29",
  });

  it("vale adentro del tramo, con los dos extremos incluidos", () => {
    expect(vigenteEl(anuncio, "2026-08-28")).toBe(true);
    expect(vigenteEl(anuncio, "2026-08-29")).toBe(true);
  });

  it("no vale ni antes ni después", () => {
    expect(vigenteEl(anuncio, "2026-08-27")).toBe(false);
    expect(vigenteEl(anuncio, "2026-08-30")).toBe(false);
  });

  it("sin fin, vale de esa fecha en adelante", () => {
    const abierto = nota({ seccion: "anuncio", fecha: "2026-08-10", fecha_hasta: null });
    expect(vigenteEl(abierto, "2026-08-09")).toBe(false);
    expect(vigenteEl(abierto, "2027-01-01")).toBe(true);
  });

  it("sin fecha, es una advertencia permanente del departamento", () => {
    const permanente = nota({ seccion: "anuncio", fecha: null });
    expect(vigenteEl(permanente, "2020-01-01")).toBe(true);
    expect(vigenteEl(permanente, "2030-01-01")).toBe(true);
  });

  it("lo marcado hecho deja de aparecer", () => {
    expect(vigenteEl({ ...anuncio, estado: "hecho" }, "2026-08-28")).toBe(false);
  });
});

describe("ordenarPorUrgencia", () => {
  it("primero lo vencido, al fondo lo hecho", () => {
    const notas = [
      nota({ id: "tranquilo", fecha: "2026-09-01" }),
      nota({ id: "hecho", fecha: "2026-08-01", estado: "hecho" }),
      nota({ id: "vencido", fecha: "2026-08-05" }),
      nota({ id: "sinFecha", fecha: null }),
      nota({ id: "hoy", fecha: HOY }),
      nota({ id: "proximo", fecha: "2026-08-13" }),
    ];
    expect(ordenarPorUrgencia(notas, HOY).map((n) => n.id)).toEqual([
      "vencido",
      "hoy",
      "proximo",
      "tranquilo",
      "sinFecha",
      "hecho",
    ]);
  });

  it("dentro del mismo grupo, primero la fecha más cercana", () => {
    const notas = [
      nota({ id: "viejo", fecha: "2026-08-01" }),
      nota({ id: "reciente", fecha: "2026-08-09" }),
      nota({ id: "medio", fecha: "2026-08-05" }),
    ];
    expect(ordenarPorUrgencia(notas, HOY).map((n) => n.id)).toEqual([
      "viejo",
      "medio",
      "reciente",
    ]);
  });
});

describe("filtrarNotas", () => {
  const sinFiltros: FiltrosNotas = { responsable: null, verHechos: false, q: "" };
  const notas = [
    nota({
      id: "a",
      responsable_id: "p1",
      responsable_nombre: "Diego",
      titulo: "Llaves",
      detalle: "Copiar juego nuevo",
    }),
    nota({
      id: "b",
      responsable_id: "p2",
      responsable_nombre: "Mili",
      titulo: "Sillas",
      detalle: "Abonar al tapicero",
    }),
    nota({
      id: "c",
      responsable_id: null,
      titulo: "Enchufe del baño",
      detalle: "Prop avisada",
      depto_codigo: "ESMERALDA 1",
    }),
    nota({
      id: "d",
      responsable_id: "p1",
      responsable_nombre: "Diego",
      detalle: null,
      estado: "hecho",
    }),
  ];

  const ids = (f: Partial<FiltrosNotas>) =>
    filtrarNotas(notas, { ...sinFiltros, ...f }).map((n) => n.id);

  it("por defecto lo hecho no se muestra", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });

  it("se puede pedir ver lo hecho", () => {
    expect(ids({ verHechos: true })).toEqual(["a", "b", "c", "d"]);
  });

  it("filtra por responsable, que es lo que antes eran Logística y Diego", () => {
    expect(ids({ responsable: "p1" })).toEqual(["a"]);
    expect(ids({ responsable: "p1", verHechos: true })).toEqual(["a", "d"]);
  });

  it("los que no tienen dueño se pueden aislar", () => {
    expect(ids({ responsable: "sin_asignar" })).toEqual(["c"]);
  });

  it("busca en título, detalle, departamento y responsable", () => {
    expect(ids({ q: "sillas" })).toEqual(["b"]);
    expect(ids({ q: "esmeralda" })).toEqual(["c"]);
    expect(ids({ q: "diego" })).toEqual(["a"]);
    // El detalle también se busca, no solo el título.
    expect(ids({ q: "tapicero" })).toEqual(["b"]);
  });
});

describe("contarUrgentes", () => {
  it("cuenta lo vencido y lo de hoy, nada más", () => {
    const notas = [
      nota({ fecha: "2026-08-01" }),
      nota({ fecha: HOY }),
      nota({ fecha: "2026-08-20" }),
      nota({ fecha: "2026-08-01", estado: "hecho" }),
      nota({ fecha: null }),
    ];
    expect(contarUrgentes(notas, HOY)).toBe(2);
  });
});

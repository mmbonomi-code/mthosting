import { describe, expect, it } from "vitest";
import {
  alertasDeArreglos,
  alertasDeFotos,
  CLASE_ARREGLO,
  firmaFotos,
  reservaAReclamar,
  type FotoCruda,
  type LimpiezaDeFoto,
  type ReservaDelDepto,
} from "./fotos";

const foto = (limpiezaId: string, tipo: string, created: string): FotoCruda => ({
  limpieza_id: limpiezaId,
  tipo,
  created_at: created,
});

const limpieza = (over: Partial<LimpiezaDeFoto> = {}): LimpiezaDeFoto => ({
  id: "L1",
  depto_id: "D1",
  fecha: "2026-09-01",
  tipo: "normal",
  rol_reserva: "salida",
  reserva_id: "R1",
  ...over,
});

describe("firmaFotos", () => {
  it("cambia si aparece una foto nueva: la alerta vuelve sola", () => {
    const antes = [foto("L1", "olvido", "2026-09-01T10:00:00Z")];
    const despues = [...antes, foto("L1", "olvido", "2026-09-01T18:00:00Z")];
    expect(firmaFotos(antes)).not.toBe(firmaFotos(despues));
  });

  it("no depende del orden en que vengan", () => {
    const a = foto("L1", "olvido", "2026-09-01T10:00:00Z");
    const b = foto("L1", "olvido", "2026-09-01T18:00:00Z");
    expect(firmaFotos([a, b])).toBe(firmaFotos([b, a]));
  });

  it("las mismas fotos dan la misma firma: revisado sigue revisado", () => {
    const fotos = [foto("L1", "olvido", "2026-09-01T10:00:00Z")];
    expect(firmaFotos(fotos)).toBe(firmaFotos([...fotos]));
  });
});

describe("alertasDeFotos", () => {
  const limpiezas = [limpieza(), limpieza({ id: "L2", depto_id: "D2", fecha: "2026-08-30" })];

  it("una limpieza con cinco fotos es UNA alerta, no cinco", () => {
    const fotos = ["a", "b", "c", "d", "e"].map((_, i) =>
      foto("L1", "olvido", `2026-09-01T1${i}:00:00Z`),
    );
    const alertas = alertasDeFotos("olvido", fotos, limpiezas, []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].cantidad).toBe(5);
  });

  it("no mezcla categorías: una foto de daño no enciende la de olvidos", () => {
    const fotos = [foto("L1", "huesped", "2026-09-01T10:00:00Z")];
    expect(alertasDeFotos("olvido", fotos, limpiezas, [])).toEqual([]);
    expect(alertasDeFotos("huesped", fotos, limpiezas, [])).toHaveLength(1);
  });

  it("dada por revisada, desaparece", () => {
    const fotos = [foto("L1", "olvido", "2026-09-01T10:00:00Z")];
    const revisadas = [{ clase: "olvido", limpieza_id: "L1", firma: firmaFotos(fotos) }];
    expect(alertasDeFotos("olvido", fotos, limpiezas, revisadas)).toEqual([]);
  });

  it("revisada y DESPUÉS suma otra foto: la alerta vuelve", () => {
    const antes = [foto("L1", "olvido", "2026-09-01T10:00:00Z")];
    const revisadas = [{ clase: "olvido", limpieza_id: "L1", firma: firmaFotos(antes) }];
    const despues = [...antes, foto("L1", "olvido", "2026-09-02T09:00:00Z")];
    expect(alertasDeFotos("olvido", despues, limpiezas, revisadas)).toHaveLength(1);
  });

  it("revisar los olvidos no apaga los daños de la misma limpieza", () => {
    const fotos = [
      foto("L1", "olvido", "2026-09-01T10:00:00Z"),
      foto("L1", "huesped", "2026-09-01T11:00:00Z"),
    ];
    const revisadas = [
      { clase: "olvido", limpieza_id: "L1", firma: firmaFotos([fotos[0]]) },
    ];
    expect(alertasDeFotos("olvido", fotos, limpiezas, revisadas)).toEqual([]);
    expect(alertasDeFotos("huesped", fotos, limpiezas, revisadas)).toHaveLength(1);
  });

  it("la más vieja primero", () => {
    const fotos = [
      foto("L1", "olvido", "2026-09-01T10:00:00Z"),
      foto("L2", "olvido", "2026-08-30T10:00:00Z"),
    ];
    expect(alertasDeFotos("olvido", fotos, limpiezas, []).map((a) => a.limpieza_id)).toEqual([
      "L2",
      "L1",
    ]);
  });

  it("una foto de una limpieza que no vino en el lote no rompe nada", () => {
    const fotos = [foto("L99", "olvido", "2026-09-01T10:00:00Z")];
    expect(alertasDeFotos("olvido", fotos, limpiezas, [])).toEqual([]);
  });

  it("sin fotos no hay alertas", () => {
    expect(alertasDeFotos("olvido", [], limpiezas, [])).toEqual([]);
  });
});

describe("reservaAReclamar", () => {
  const sale: ReservaDelDepto = {
    id: "R1",
    codigo_reserva: "HMABC",
    depto_id: "D1",
    fecha_checkin: "2026-08-28",
    fecha_checkout: "2026-09-01",
  };
  const entra: ReservaDelDepto = {
    id: "R2",
    codigo_reserva: "HMXYZ",
    depto_id: "D1",
    fecha_checkin: "2026-09-01",
    fecha_checkout: "2026-09-05",
  };
  const otroDepto: ReservaDelDepto = { ...sale, id: "R3", codigo_reserva: "HMOTR", depto_id: "D2" };

  it("el daño es del que se fue, no del que llega", () => {
    const r = reservaAReclamar(limpieza(), [sale, entra]);
    expect(r?.codigo_reserva).toBe("HMABC");
  });

  it("aunque la limpieza esté atada a la reserva que ENTRA, se reclama a la que salió", () => {
    const r = reservaAReclamar(
      limpieza({ rol_reserva: "entrada", reserva_id: "R2" }),
      [sale, entra],
    );
    expect(r?.codigo_reserva).toBe("HMABC");
  });

  it("con huéspedes: el daño es del que TODAVÍA está adentro", () => {
    const larga: ReservaDelDepto = {
      id: "R9",
      codigo_reserva: "HMLARGA",
      depto_id: "D1",
      fecha_checkin: "2026-08-20",
      fecha_checkout: "2026-09-20",
    };
    const r = reservaAReclamar(
      limpieza({ tipo: "con_huespedes", fecha: "2026-09-01", rol_reserva: "durante", reserva_id: null }),
      [larga, sale],
    );
    expect(r?.codigo_reserva).toBe("HMLARGA");
  });

  it("con huéspedes y vínculo explícito: usa el vínculo", () => {
    const larga: ReservaDelDepto = {
      id: "R9",
      codigo_reserva: "HMLARGA",
      depto_id: "D1",
      fecha_checkin: "2026-08-20",
      fecha_checkout: "2026-09-20",
    };
    const r = reservaAReclamar(
      limpieza({ tipo: "con_huespedes", rol_reserva: "durante", reserva_id: "R9" }),
      [larga, sale],
    );
    expect(r?.id).toBe("R9");
  });

  it("sin vínculo, la encuentra por la fecha de salida", () => {
    const r = reservaAReclamar(limpieza({ rol_reserva: null, reserva_id: null }), [sale, entra]);
    expect(r?.codigo_reserva).toBe("HMABC");
  });

  it("nunca se cruza de departamento", () => {
    const r = reservaAReclamar(
      limpieza({ rol_reserva: null, reserva_id: null, depto_id: "D9" }),
      [sale, entra, otroDepto],
    );
    expect(r).toBeNull();
  });

  it("si no hay a quién reclamarle, devuelve null y no inventa", () => {
    const r = reservaAReclamar(
      limpieza({ fecha: "2026-09-10", rol_reserva: null, reserva_id: null }),
      [sale, entra],
    );
    expect(r).toBeNull();
  });
});

describe("alertasDeArreglos", () => {
  const arreglo = (
    id: string,
    limpiezaId: string,
    descripcion: string,
    created = "2026-09-01T10:00:00Z",
  ) => ({ id, depto_id: "D1", limpieza_id: limpiezaId, descripcion, created_at: created });

  const limpiezas = [limpieza(), limpieza({ id: "L2", depto_id: "D2", fecha: "2026-08-30" })];

  it("tres cosas rotas en el mismo depto son UNA alerta", () => {
    const arreglos = [
      arreglo("A1", "L1", "la luz del baño"),
      arreglo("A2", "L1", "la canilla gotea", "2026-09-01T11:00:00Z"),
      arreglo("A3", "L1", "la persiana", "2026-09-01T12:00:00Z"),
    ];
    const alertas = alertasDeArreglos(arreglos, [], limpiezas, []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].descripciones).toEqual([
      "la luz del baño",
      "la canilla gotea",
      "la persiana",
    ]);
    expect(alertas[0].arreglo_ids).toEqual(["A1", "A2", "A3"]);
  });

  it("la FOTO sola enciende la alerta, sin que nadie escriba nada", () => {
    const fotos = [foto("L1", "arreglar", "2026-09-01T10:00:00Z")];
    const alertas = alertasDeArreglos([], fotos, limpiezas, []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].fotos).toBe(1);
    expect(alertas[0].descripciones).toEqual([]);
  });

  it("el TEXTO solo también, sin foto", () => {
    const alertas = alertasDeArreglos([arreglo("A1", "L1", "la luz")], [], limpiezas, []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].firma).toBeNull();
  });

  it("foto y texto de la misma limpieza son una sola alerta", () => {
    const alertas = alertasDeArreglos(
      [arreglo("A1", "L1", "la luz")],
      [foto("L1", "arreglar", "2026-09-01T10:00:00Z")],
      limpiezas,
      [],
    );
    expect(alertas).toHaveLength(1);
  });

  it("resueltos los arreglos pero con la foto sin mirar, la alerta sigue", () => {
    const fotos = [foto("L1", "arreglar", "2026-09-01T10:00:00Z")];
    expect(alertasDeArreglos([], fotos, limpiezas, [])).toHaveLength(1);
  });

  it("resueltos los arreglos y vistas las fotos, se apaga", () => {
    const fotos = [foto("L1", "arreglar", "2026-09-01T10:00:00Z")];
    const revisadas = [
      { clase: CLASE_ARREGLO, limpieza_id: "L1", firma: firmaFotos(fotos) },
    ];
    expect(alertasDeArreglos([], fotos, limpiezas, revisadas)).toEqual([]);
  });

  it("con las fotos vistas pero un arreglo abierto, no se apaga", () => {
    const fotos = [foto("L1", "arreglar", "2026-09-01T10:00:00Z")];
    const revisadas = [
      { clase: CLASE_ARREGLO, limpieza_id: "L1", firma: firmaFotos(fotos) },
    ];
    expect(alertasDeArreglos([arreglo("A1", "L1", "la luz")], fotos, limpiezas, revisadas)).toHaveLength(1);
  });

  it("dada por revisada y DESPUÉS otra foto: la alerta vuelve", () => {
    const antes = [foto("L1", "arreglar", "2026-09-01T10:00:00Z")];
    const revisadas = [{ clase: CLASE_ARREGLO, limpieza_id: "L1", firma: firmaFotos(antes) }];
    const despues = [...antes, foto("L1", "arreglar", "2026-09-03T10:00:00Z")];
    expect(alertasDeArreglos([], despues, limpiezas, revisadas)).toHaveLength(1);
  });

  it("no se cruza con el revisado de olvidos de la misma limpieza", () => {
    const fotos = [foto("L1", "arreglar", "2026-09-01T10:00:00Z")];
    const revisadas = [{ clase: "olvido", limpieza_id: "L1", firma: firmaFotos(fotos) }];
    expect(alertasDeArreglos([], fotos, limpiezas, revisadas)).toHaveLength(1);
  });

  it("un arreglo viejo, de una limpieza fuera de la ventana de fotos, sigue apareciendo", () => {
    const viejo = arreglo("A9", "L99", "el termotanque", "2026-05-10T10:00:00Z");
    const alertas = alertasDeArreglos([viejo], [], limpiezas, []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].fecha).toBe("2026-05-10");
    expect(alertas[0].depto_id).toBe("D1");
  });

  it("el más viejo primero", () => {
    const alertas = alertasDeArreglos(
      [arreglo("A1", "L1", "x"), { ...arreglo("A2", "L2", "y"), depto_id: "D2" }],
      [],
      limpiezas,
      [],
    );
    expect(alertas.map((a) => a.limpieza_id)).toEqual(["L2", "L1"]);
  });

  it("sin nada reportado no hay alertas", () => {
    expect(alertasDeArreglos([], [], limpiezas, [])).toEqual([]);
  });
});

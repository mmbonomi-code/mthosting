import { describe, expect, it } from "vitest";
import {
  cambioPendiente,
  firmaCambio,
  planificarCambios,
  type MarcaExistente,
  type ReservaComparable,
  type VistoEnCalendario,
} from "./cambios";

function reserva(
  codigo: string,
  depto: string,
  checkin: string,
  checkout: string,
): ReservaComparable {
  return {
    id: `id-${codigo}`,
    codigo_reserva: codigo,
    depto_id: depto,
    fecha_checkin: checkin,
    fecha_checkout: checkout,
  };
}

/** Lo que muestra el calendario para esa reserva, tal cual está en la base. */
function igual(r: ReservaComparable): VistoEnCalendario {
  return { codigo: r.codigo_reserva, depto_id: r.depto_id, desde: r.fecha_checkin, hasta: r.fecha_checkout };
}

function marca(
  r: ReservaComparable,
  tipo: MarcaExistente["tipo"],
  estado: MarcaExistente["estado"],
  firma: string,
  activo = true,
): MarcaExistente {
  return { id: `m-${r.codigo_reserva}-${tipo}-${estado}`, reserva_id: r.id, tipo, estado, firma, activo };
}

/** Un departamento con varias reservas que siguen todas en su calendario. */
function relleno(depto: string, cantidad: number): ReservaComparable[] {
  return Array.from({ length: cantidad }, (_, i) =>
    reserva(`HM${depto}${String(i).padStart(4, "0")}`, depto, `2026-10-${String(i + 1).padStart(2, "0")}`, `2026-10-${String(i + 2).padStart(2, "0")}`),
  );
}

describe("cambioPendiente", () => {
  it("sin marcas pendientes no muestra nada", () => {
    expect(cambioPendiente(null)).toBeNull();
    expect(cambioPendiente([{ tipo: "posible_cancelacion", estado: "descartado" }])).toBeNull();
  });

  it("la cancelación tapa a las otras", () => {
    expect(
      cambioPendiente([
        { tipo: "cambio_fechas", estado: "pendiente" },
        { tipo: "posible_cancelacion", estado: "pendiente" },
      ]),
    ).toBe("posible_cancelacion");
  });
});

describe("planificarCambios", () => {
  it("si todo coincide con el calendario no marca nada", () => {
    const reservas = relleno("A", 3);
    const plan = planificarCambios({ reservas, vistos: reservas.map(igual), marcas: [] });
    expect(plan.nuevas).toEqual([]);
    expect(plan.retenidas).toEqual([]);
  });

  it("una reserva que no está en ningún calendario es una posible cancelación", () => {
    const quedan = relleno("A", 3);
    const falta = reserva("HMFALTA0001", "A", "2026-10-20", "2026-10-23");
    const plan = planificarCambios({
      reservas: [...quedan, falta],
      vistos: quedan.map(igual),
      marcas: [],
    });
    expect(plan.nuevas).toHaveLength(1);
    expect(plan.nuevas[0]).toMatchObject({
      reserva_id: falta.id,
      tipo: "posible_cancelacion",
      calendario_checkin: null,
      reserva_checkin: "2026-10-20",
    });
  });

  it("una reserva que está en el calendario de otro depto es un cambio de depto, no una cancelación", () => {
    const movida = reserva("HMMOVIDA001", "A", "2026-10-20", "2026-10-23");
    const plan = planificarCambios({
      reservas: [movida, ...relleno("A", 2)],
      vistos: [...relleno("A", 2).map(igual), { ...igual(movida), depto_id: "B" }],
      marcas: [],
    });
    expect(plan.nuevas.map((m) => m.tipo)).toEqual(["cambio_depto"]);
    expect(plan.nuevas[0].calendario_depto_id).toBe("B");
  });

  it("detecta el cambio de fechas y guarda las fechas nuevas", () => {
    const r = reserva("HMFECHAS001", "A", "2026-10-03", "2026-10-06");
    const plan = planificarCambios({
      reservas: [r],
      vistos: [{ ...igual(r), hasta: "2026-10-05" }],
      marcas: [],
    });
    expect(plan.nuevas).toHaveLength(1);
    expect(plan.nuevas[0]).toMatchObject({
      tipo: "cambio_fechas",
      calendario_checkin: "2026-10-03",
      calendario_checkout: "2026-10-05",
      reserva_checkout: "2026-10-06",
    });
  });

  it("otro depto Y otras fechas son dos marcas", () => {
    const r = reserva("HMDOBLE0001", "A", "2026-10-03", "2026-10-06");
    const plan = planificarCambios({
      reservas: [r],
      vistos: [{ codigo: r.codigo_reserva, depto_id: "B", desde: "2026-10-04", hasta: "2026-10-06" }],
      marcas: [],
    });
    expect(plan.nuevas.map((m) => m.tipo).sort()).toEqual(["cambio_depto", "cambio_fechas"]);
  });

  it("con el mismo código en dos calendarios, prefiere el de su propio depto", () => {
    const r = reserva("HMDOSCAL001", "A", "2026-10-03", "2026-10-06");
    const plan = planificarCambios({
      reservas: [r],
      vistos: [{ ...igual(r), depto_id: "B" }, igual(r)],
      marcas: [],
    });
    expect(plan.nuevas).toEqual([]);
  });

  describe("marcas que ya existen", () => {
    const r = reserva("HMEXISTE001", "A", "2026-10-03", "2026-10-06");
    const resto = relleno("A", 3);

    it("no duplica una marca pendiente con la misma situación", () => {
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      const plan = planificarCambios({
        reservas: [r, ...resto],
        vistos: resto.map(igual),
        marcas: [marca(r, "posible_cancelacion", "pendiente", firma)],
      });
      expect(plan.nuevas).toEqual([]);
      expect(plan.actualizar).toEqual([]);
    });

    it("actualiza la pendiente si las fechas cambiaron otra vez", () => {
      const vieja = firmaCambio("cambio_fechas", r, { ...igual(r), hasta: "2026-10-05" });
      const plan = planificarCambios({
        reservas: [r],
        vistos: [{ ...igual(r), hasta: "2026-10-08" }],
        marcas: [marca(r, "cambio_fechas", "pendiente", vieja)],
      });
      expect(plan.nuevas).toEqual([]);
      expect(plan.actualizar).toHaveLength(1);
      expect(plan.actualizar[0]).toMatchObject({ calendario_checkout: "2026-10-08" });
    });

    it("cierra sola la pendiente si la reserva vuelve a aparecer igual", () => {
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      const m = marca(r, "posible_cancelacion", "pendiente", firma);
      const plan = planificarCambios({ reservas: [r], vistos: [igual(r)], marcas: [m] });
      expect(plan.resueltasSolas).toEqual([m.id]);
      expect(plan.nuevas).toEqual([]);
    });

    it("una pendiente de cancelación que reaparece con otras fechas se cierra y nace un cambio de fechas", () => {
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      const m = marca(r, "posible_cancelacion", "pendiente", firma);
      const plan = planificarCambios({
        reservas: [r],
        vistos: [{ ...igual(r), desde: "2026-10-04" }],
        marcas: [m],
      });
      expect(plan.resueltasSolas).toEqual([m.id]);
      expect(plan.nuevas.map((n) => n.tipo)).toEqual(["cambio_fechas"]);
    });

    it("un descarte ('sigue en pie') no deja que la misma situación vuelva a marcarse", () => {
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      const plan = planificarCambios({
        reservas: [r, ...resto],
        vistos: resto.map(igual),
        marcas: [marca(r, "posible_cancelacion", "descartado", firma)],
      });
      expect(plan.nuevas).toEqual([]);
    });

    it("un descarte de fechas no tapa un cambio a fechas distintas", () => {
      const descartada = firmaCambio("cambio_fechas", r, { ...igual(r), hasta: "2026-10-05" });
      const plan = planificarCambios({
        reservas: [r],
        vistos: [{ ...igual(r), hasta: "2026-10-09" }],
        marcas: [marca(r, "cambio_fechas", "descartado", descartada)],
      });
      expect(plan.nuevas.map((n) => n.calendario_checkout)).toEqual(["2026-10-09"]);
    });

    it("el descarte vence cuando la reserva vuelve a coincidir, para que una segunda desaparición avise", () => {
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      const d = marca(r, "posible_cancelacion", "descartado", firma);
      const plan = planificarCambios({ reservas: [r], vistos: [igual(r)], marcas: [d] });
      expect(plan.descartesVencidos).toEqual([d.id]);
    });

    it("un descarte ya vencido no tapa nada", () => {
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      const plan = planificarCambios({
        reservas: [r, ...resto],
        vistos: resto.map(igual),
        marcas: [marca(r, "posible_cancelacion", "descartado", firma, false)],
      });
      expect(plan.nuevas.map((n) => n.tipo)).toEqual(["posible_cancelacion"]);
    });
  });

  describe("freno por calendario vacío", () => {
    it("si desaparecen TODAS las reservas de un depto (2 o más), no marca ninguna y las retiene", () => {
      const vaciado = relleno("A", 3);
      const sano = relleno("B", 10);
      const plan = planificarCambios({
        reservas: [...vaciado, ...sano],
        vistos: sano.map(igual),
        marcas: [],
      });
      expect(plan.nuevas).toEqual([]);
      expect(plan.retenidas).toEqual([
        { depto_id: "A", motivo: "calendario_vacio", reserva_ids: vaciado.map((r) => r.id).sort() },
      ]);
    });

    it("un depto con una sola reserva que desaparece se marca normal", () => {
      const sola = relleno("A", 1);
      const sano = relleno("B", 10);
      const plan = planificarCambios({
        reservas: [...sola, ...sano],
        vistos: sano.map(igual),
        marcas: [],
      });
      expect(plan.nuevas.map((n) => n.reserva_id)).toEqual([sola[0].id]);
      expect(plan.retenidas).toEqual([]);
    });

    it("si queda al menos una en el calendario, las otras se marcan", () => {
      const depto = relleno("A", 3);
      const plan = planificarCambios({
        reservas: [...depto, ...relleno("B", 10)],
        vistos: [igual(depto[0]), ...relleno("B", 10).map(igual)],
        marcas: [],
      });
      expect(plan.nuevas).toHaveLength(2);
      expect(plan.retenidas).toEqual([]);
    });

    it("el freno no pisa lo que ya tiene marca pendiente, y no la cierra", () => {
      const vaciado = relleno("A", 2);
      const m = marca(vaciado[0], "posible_cancelacion", "pendiente", firmaCambio("posible_cancelacion", vaciado[0], undefined));
      const plan = planificarCambios({
        reservas: [...vaciado, ...relleno("B", 10)],
        vistos: relleno("B", 10).map(igual),
        marcas: [m],
      });
      expect(plan.resueltasSolas).toEqual([]);
      expect(plan.retenidas).toEqual([
        { depto_id: "A", motivo: "calendario_vacio", reserva_ids: [vaciado[1].id] },
      ]);
    });

    it("los cambios de fecha no se frenan: la reserva está en el calendario", () => {
      const r = reserva("HMFECHAS002", "A", "2026-10-03", "2026-10-06");
      const plan = planificarCambios({
        reservas: [r, ...relleno("B", 1)],
        vistos: [{ ...igual(r), hasta: "2026-10-07" }, ...relleno("B", 1).map(igual)],
        marcas: [],
      });
      expect(plan.nuevas.map((n) => n.tipo)).toEqual(["cambio_fechas"]);
    });
  });

  describe("freno global", () => {
    it("si desaparece más del 20% del total (y son 5 o más), no marca ninguna", () => {
      // 6 deptos pierden 1 de 2 reservas: ninguno queda vacío, pero en total
      // desaparece el 30%.
      const reservas: ReservaComparable[] = [];
      const vistos: VistoEnCalendario[] = [];
      for (const d of ["A", "B", "C", "D", "E", "F"]) {
        const [queda, falta] = relleno(d, 2);
        reservas.push(queda, falta);
        vistos.push(igual(queda));
      }
      reservas.push(...relleno("G", 8));
      vistos.push(...relleno("G", 8).map(igual));

      const plan = planificarCambios({ reservas, vistos, marcas: [] });
      expect(plan.nuevas).toEqual([]);
      expect(plan.retenidas).toHaveLength(6);
      expect(plan.retenidas.every((r) => r.motivo === "freno_global")).toBe(true);
    });

    it("con menos de 5 desaparecidas no frena aunque sean muchas en proporción", () => {
      const reservas = [...relleno("A", 2), ...relleno("B", 2)];
      const plan = planificarCambios({
        reservas,
        vistos: [igual(reservas[0]), igual(reservas[2])],
        marcas: [],
      });
      expect(plan.nuevas).toHaveLength(2);
    });

    it("el caso real del 13/09/2026 (15 de 595) no frena", () => {
      const reservas: ReservaComparable[] = [];
      const vistos: VistoEnCalendario[] = [];
      for (let d = 0; d < 50; d++) {
        const delDepto = relleno(`D${d}`, 12);
        reservas.push(...delDepto);
        // Los primeros 15 deptos pierden una reserva cada uno.
        vistos.push(...delDepto.slice(d < 15 ? 1 : 0).map(igual));
      }
      const plan = planificarCambios({ reservas, vistos, marcas: [] });
      expect(plan.nuevas).toHaveLength(15);
      expect(plan.retenidas).toEqual([]);
    });
  });
});

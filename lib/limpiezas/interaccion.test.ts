import { describe, expect, it } from "vitest";
import { claveOrden, resumirInteraccion, SIN_HORARIO } from "./interaccion";

const LIMPIEZA = { metodo: "presencial", recibe_limpieza: true };
const VALIJAS_EN_DEPTO = { metodo: "valijas", recibe_limpieza: true };
const CANDADO = { metodo: "candado", recibe_limpieza: false };

describe("resumirInteraccion — salida", () => {
  it("muestra la hora coordinada del check-out", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: { fecha: "2026-09-16", hora: "11:00:00", puntoDevolucion: CANDADO },
      entrada: null,
    });
    expect(r.salida).toEqual({ otroDia: null, hora: "11:00", dejaLlaves: false });
  });

  it("sin hora dice que no está informada", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: { fecha: "2026-09-16", hora: null, puntoDevolucion: null },
      entrada: null,
    });
    expect(r.salida?.hora).toBe(SIN_HORARIO);
  });

  it("devolución a Limpieza: el huésped le deja las llaves", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: { fecha: "2026-09-16", hora: "10:00:00", puntoDevolucion: LIMPIEZA },
      entrada: null,
    });
    expect(r.salida?.dejaLlaves).toBe(true);
  });

  it("'valijas – En depto' no es una devolución de llaves", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: { fecha: "2026-09-16", hora: "10:00:00", puntoDevolucion: VALIJAS_EN_DEPTO },
      entrada: null,
    });
    expect(r.salida?.dejaLlaves).toBe(false);
  });

  it("si salió otro día lo dice, y las llaves ya no son asunto de hoy", () => {
    // KENNEDY 1: salió el 15 con late checkout y la limpieza se pasó al 16.
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: { fecha: "2026-09-15", hora: "12:30:00", puntoDevolucion: LIMPIEZA },
      entrada: null,
    });
    expect(r.salida).toEqual({ otroDia: "2026-09-15", hora: "12:30", dejaLlaves: false });
  });
});

describe("resumirInteraccion — entrada", () => {
  it("valijas en el depto", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: null,
      entrada: { hora: "10:30:00", punto: VALIJAS_EN_DEPTO },
    });
    expect(r.entrada).toEqual({ hora: "10:30", aviso: "valijas" });
  });

  it("presencial con Limpieza: lo recibe en persona", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: null,
      entrada: { hora: null, punto: LIMPIEZA },
    });
    expect(r.entrada).toEqual({ hora: SIN_HORARIO, aviso: "en_persona" });
  });

  it("un punto que no atiende la limpieza no avisa nada", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: null,
      entrada: { hora: "15:00:00", punto: CANDADO },
    });
    expect(r.entrada?.aviso).toBeNull();
  });

  it("sin punto cargado todavía, tampoco", () => {
    const r = resumirInteraccion({
      fechaLimpieza: "2026-09-16",
      salida: null,
      entrada: { hora: "15:00:00", punto: null },
    });
    expect(r.entrada?.aviso).toBeNull();
  });
});

describe("claveOrden", () => {
  it("primero las que tienen entrada, por hora; las sin hora después; sin entrada al final", () => {
    const con = (hora: string | null) =>
      resumirInteraccion({ fechaLimpieza: "2026-09-16", salida: null, entrada: { hora, punto: null } });
    const sin = resumirInteraccion({ fechaLimpieza: "2026-09-16", salida: null, entrada: null });
    const ordenadas = [sin, con(null), con("15:00:00"), con("10:30:00")]
      .map((i) => ({ i, k: claveOrden(i) }))
      .sort((a, b) => a.k.localeCompare(b.k))
      .map(({ i }) => i.entrada?.hora ?? "nadie");
    expect(ordenadas).toEqual(["10:30", "15:00", SIN_HORARIO, "nadie"]);
  });
});

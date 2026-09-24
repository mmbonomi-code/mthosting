import { describe, expect, it } from "vitest";
import { ordenarEventos, patronBusqueda, posicionEnDia, type EventoDelDia } from "./dia";

function evento(
  id: string,
  tipo: "checkin" | "checkout",
  hora: string | null,
  codigo: string,
  fechaCoordinada: string | null = null,
): EventoDelDia {
  return {
    id,
    tipo,
    fecha_coordinada: fechaCoordinada,
    hora_coordinada: hora,
    reserva: {
      fecha_checkin: "2026-09-24",
      fecha_checkout: "2026-09-24",
      descartada: false,
      depto: { codigo },
    },
  };
}

describe("ordenarEventos", () => {
  it("separa llegadas y salidas y ordena por hora", () => {
    const { llegadas, salidas } = ordenarEventos([
      evento("b", "checkin", "16:00", "B"),
      evento("s", "checkout", "10:00", "S"),
      evento("a", "checkin", "14:00", "A"),
    ]);
    expect(llegadas.map((e) => e.id)).toEqual(["a", "b"]);
    expect(salidas.map((e) => e.id)).toEqual(["s"]);
  });

  it("las 02:00 del día siguiente van al fondo, y sin hora va último", () => {
    const { llegadas } = ordenarEventos([
      evento("sinHora", "checkin", null, "Z"),
      evento("madrugada", "checkin", "02:00", "M", "2026-09-25"),
      evento("tarde", "checkin", "21:30", "T"),
    ]);
    expect(llegadas.map((e) => e.id)).toEqual(["tarde", "sinHora", "madrugada"]);
  });

  it("a igual hora, desempata por código de depto", () => {
    const { llegadas } = ordenarEventos([
      evento("2", "checkin", "15:00", "JUNCAL 2"),
      evento("1", "checkin", "15:00", "ARENALES"),
    ]);
    expect(llegadas.map((e) => e.id)).toEqual(["1", "2"]);
  });
});

describe("posicionEnDia", () => {
  const secuencia = [
    { id: "l1", tipo: "checkin" as const },
    { id: "l2", tipo: "checkin" as const },
    { id: "s1", tipo: "checkout" as const },
  ];

  it("la primera no tiene anterior", () => {
    expect(posicionEnDia(secuencia, "l1")).toEqual({
      anterior: null,
      siguiente: "l2",
      numero: 1,
      total: 2,
    });
  });

  it("la última llegada sigue con la primera salida", () => {
    expect(posicionEnDia(secuencia, "l2")?.siguiente).toBe("s1");
  });

  it("la última no tiene siguiente y cuenta dentro de su tipo", () => {
    expect(posicionEnDia(secuencia, "s1")).toEqual({
      anterior: "l2",
      siguiente: null,
      numero: 1,
      total: 1,
    });
  });

  it("si no figura en el día, no hay posición", () => {
    expect(posicionEnDia(secuencia, "otra")).toBeNull();
  });
});

describe("patronBusqueda", () => {
  it("va entre comillas para que la coma no parta el filtro", () => {
    expect(patronBusqueda("Pérez, Juan")).toBe('"%Pérez, Juan%"');
  });

  it("escapa comillas y barras", () => {
    expect(patronBusqueda('a"b\\c')).toBe('"%a\\"b\\\\c%"');
  });
});

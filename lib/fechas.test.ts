import { describe, expect, it } from "vitest";
import { horaARDe } from "./fechas";

describe("horaARDe", () => {
  it("da la hora de Buenos Aires, no la de UTC", () => {
    // 13:42 UTC son las 10:42 en Buenos Aires.
    expect(horaARDe("2026-10-02T13:42:00+00:00")).toBe("10:42");
  });

  it("de madrugada no se corre de día ni muestra 24", () => {
    expect(horaARDe("2026-10-02T03:05:00+00:00")).toBe("00:05");
  });

  it("sin instante, o con uno inválido, nada", () => {
    expect(horaARDe(null)).toBeNull();
    expect(horaARDe("no es una fecha")).toBeNull();
  });
});

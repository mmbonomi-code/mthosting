import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { desdoblar, parsearICal } from "./parser";

/** El .ics real de producción que viene en ejemplos/ (spec §2.12). */
const REAL = readFileSync("ejemplos/ejemplo-airbnb.ics", "utf8");

describe("desdoblar", () => {
  it("une las líneas partidas con CRLF + espacio", () => {
    expect(desdoblar("abc\r\n def")).toBe("abcdef");
  });

  it("también con LF solo, por si el archivo perdió los CR", () => {
    expect(desdoblar("abc\n def")).toBe("abcdef");
  });

  it("no toca los saltos de línea normales", () => {
    expect(desdoblar("abc\r\ndef")).toBe("abc\r\ndef");
  });

  it("reconstruye el código de reserva partido al medio", () => {
    const partido =
      "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de\r\n tails/HMWHAKBNE2\\nPhone Number (Last 4 Digits): 5778";
    expect(desdoblar(partido)).toContain("details/HMWHAKBNE2");
  });
});

describe("parsearICal contra el archivo real de Airbnb", () => {
  const resultado = parsearICal(REAL);

  it("encuentra las 37 reservas con código válido", () => {
    expect(resultado.reservas).toHaveLength(37);
    for (const r of resultado.reservas) {
      expect(r.codigo).toMatch(/^HM[A-Z0-9]{8}$/);
    }
  });

  it("separa los 3 bloqueos, que no son reservas", () => {
    expect(resultado.bloqueos).toHaveLength(3);
    for (const b of resultado.bloqueos) {
      expect(b.codigo).toBeNull();
      expect(b.resumen).toMatch(/not available/i);
    }
  });

  it("saca los últimos 4 dígitos del teléfono de cada reserva", () => {
    const conTelefono = resultado.reservas.filter((r) => r.telefono4);
    expect(conTelefono.length).toBe(37);
    for (const r of conTelefono) expect(r.telefono4).toMatch(/^\d{4}$/);
  });

  it("las fechas salen como fechas de negocio, no instantes", () => {
    for (const r of [...resultado.reservas, ...resultado.bloqueos]) {
      expect(r.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.hasta >= r.desde).toBe(true);
    }
  });

  it("no saltea nada del archivo real", () => {
    expect(resultado.salteados).toEqual([]);
  });

  it("el primer evento coincide con lo que dice el archivo", () => {
    // Los códigos y los teléfonos del archivo son inventados desde el
    // 13/08/2026: eran de reservas y huéspedes reales, y la prueba de punta a
    // punta los cargaba en la base como si fueran del departamento al que le
    // prestaba el calendario.
    expect(resultado.reservas[0]).toMatchObject({
      codigo: "HMZZD6XQHB",
      telefono4: "1137",
      desde: "2026-07-26",
      hasta: "2026-07-28",
    });
  });
});

describe("parsearICal — casos que no pueden pasar inadvertidos", () => {
  it("SIN desdoblar no encontraría ningún código: por eso se desdobla primero", () => {
    // Esta es la falla silenciosa que advierte la spec: el mismo archivo,
    // buscado sin unir las líneas, da cero.
    const sinDesdoblar = (REAL.match(/details\/([A-Z0-9]{8,12})/g) ?? []).length;
    expect(sinDesdoblar).toBe(0);
    // Y con el parser real, 37.
    expect(parsearICal(REAL).reservas).toHaveLength(37);
  });

  it("una reserva sin código se saltea e informa, nunca se crea a medias", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260801",
      "DTEND;VALUE=DATE:20260803",
      "SUMMARY:Reserved",
      "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const r = parsearICal(ics);
    expect(r.reservas).toHaveLength(0);
    expect(r.salteados).toHaveLength(1);
    expect(r.salteados[0]).toMatch(/sin código/i);
  });

  it("un evento sin fechas se saltea e informa", () => {
    const ics = "BEGIN:VEVENT\r\nSUMMARY:Reserved\r\nEND:VEVENT";
    const r = parsearICal(ics);
    expect(r.reservas).toHaveLength(0);
    expect(r.salteados[0]).toMatch(/sin fechas/i);
  });

  it("un archivo vacío no explota", () => {
    expect(parsearICal("")).toEqual({ reservas: [], bloqueos: [], salteados: [] });
  });

  it("acepta el teléfono con o sin espacio después de los dos puntos", () => {
    const armar = (desc: string) =>
      [
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20260801",
        "DTEND;VALUE=DATE:20260803",
        "SUMMARY:Reserved",
        `DESCRIPTION:${desc}`,
        "END:VEVENT",
      ].join("\r\n");

    expect(
      parsearICal(armar("details/HMABC12345\\nPhone Number (Last 4 Digits): 1234"))
        .reservas[0].telefono4,
    ).toBe("1234");
    expect(
      parsearICal(armar("details/HMABC12345\\nPhone Number (Last 4 Digits):5678"))
        .reservas[0].telefono4,
    ).toBe("5678");
  });
});

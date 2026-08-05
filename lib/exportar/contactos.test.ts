import { describe, expect, it } from "vitest";
import {
  armarCSV,
  ENCABEZADOS_COMUNICACION,
  ENCABEZADOS_GOOGLE,
  fechaCorta,
  filaComunicacion,
  filaGoogle,
  normalizarTelefono,
  paisDesdeTelefono,
  type ReservaContacto,
} from "./contactos";

function reserva(parcial: Partial<ReservaContacto> = {}): ReservaContacto {
  return {
    codigo_reserva: "HMCNXQKHP5",
    huesped_nombre: "Gerardo Pérez",
    huesped_contacto: "+598 99 362 008",
    fecha_checkin: "2026-07-31",
    fecha_checkout: "2026-08-03",
    depto: { nombre_interno: "JUNCAL 2" },
    ...parcial,
  };
}

describe("normalizarTelefono", () => {
  it("deja solo dígitos", () => {
    // El ejemplo de la spec (§3.5) escribe el resultado con un 9 de menos:
    // el teléfono tiene 13 dígitos, no 12. Vale el original, no la errata.
    expect(normalizarTelefono("+55 38 99940-9246")).toBe("5538999409246");
    expect(normalizarTelefono("+54 9 11 3683-5235")).toBe("5491136835235");
  });

  it("sin teléfono devuelve null", () => {
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono("")).toBeNull();
    expect(normalizarTelefono("   ")).toBeNull();
  });
});

describe("paisDesdeTelefono", () => {
  it("reconoce los códigos de la spec", () => {
    const casos: [string, string][] = [
      ["5491139309785", "AR"],
      ["5511965770979", "BR"],
      ["56966578987", "CL"],
      ["34622023460", "ES"],
      ["526622227888", "MX"],
      ["51987847648", "PE"],
      ["59899362008", "UY"],
      ["595981282599", "PY"],
      ["59171234567", "BO"],
      ["573125503158", "CO"],
      ["33658866272", "FR"],
      ["393331234567", "IT"],
      ["447496112319", "GB"],
      ["4915776213667", "DE"],
      ["351912345678", "PT"],
      ["31612345678", "NL"],
      ["61487222212", "AU"],
      ["972501234567", "IL"],
    ];
    for (const [telefono, pais] of casos) {
      expect(paisDesdeTelefono(telefono), telefono).toBe(pais);
    }
  });

  it("los códigos largos ganan: 598 es Uruguay, no un 59 suelto", () => {
    expect(paisDesdeTelefono("59899362008")).toBe("UY");
    expect(paisDesdeTelefono("59171234567")).toBe("BO");
    expect(paisDesdeTelefono("595981282599")).toBe("PY");
    expect(paisDesdeTelefono("51987847648")).toBe("PE");
  });

  it("+1 queda vacío: es Estados Unidos y Canadá a la vez", () => {
    expect(paisDesdeTelefono("16268401900")).toBe("");
    expect(paisDesdeTelefono("14144581874")).toBe("");
  });

  it("un código desconocido queda vacío", () => {
    expect(paisDesdeTelefono("407487620000")).toBe("");
    expect(paisDesdeTelefono("5025403 1043".replace(/\D/g, ""))).toBe("");
    expect(paisDesdeTelefono(null)).toBe("");
  });
});

describe("fechaCorta", () => {
  it("pasa de ISO a dd/mm/aaaa", () => {
    expect(fechaCorta("2026-08-03")).toBe("03/08/2026");
  });

  it("sin fecha devuelve vacío", () => {
    expect(fechaCorta(null)).toBe("");
  });
});

describe("filaComunicacion", () => {
  it("arma la fila con las columnas en el orden de la spec", () => {
    const fila = filaComunicacion(reserva());
    expect(fila).toHaveLength(ENCABEZADOS_COMUNICACION.length);
    expect(fila).toEqual([
      "Gerardo Pérez",
      "59899362008",
      "",
      "",
      "",
      "HMCNXQKHP5", // Ciudad = código de reserva
      "UY",
      "JUNCAL 2", // Apellidos = nombre del depto
      "",
      "",
      "",
      "",
      "31/07/2026",
      "03/08/2026",
    ]);
  });

  it("sin teléfono deja celular y país vacíos", () => {
    const fila = filaComunicacion(reserva({ huesped_contacto: null }));
    expect(fila[1]).toBe("");
    expect(fila[6]).toBe("");
  });
});

describe("filaGoogle", () => {
  it("junta huésped y departamento en el nombre, y el teléfono lleva +", () => {
    expect(filaGoogle(reserva())).toEqual([
      "Gerardo Pérez JUNCAL 2",
      "Gerardo Pérez",
      "JUNCAL 2",
      "Mobile",
      "+59899362008",
      "HMCNXQKHP5 · 31/07/2026 a 03/08/2026",
    ]);
  });

  it("tiene las seis columnas del formato de Google", () => {
    expect(filaGoogle(reserva())).toHaveLength(ENCABEZADOS_GOOGLE.length);
  });
});

describe("armarCSV", () => {
  it("entrecomilla lo que lleva comas y duplica las comillas internas", () => {
    const csv = armarCSV(["a", "b"], [["con, coma", 'con "comillas"']]);
    expect(csv).toContain('"con, coma","con ""comillas"""');
  });

  it("arranca con BOM para que Excel respete los acentos", () => {
    expect(armarCSV(["a"], [["á"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("separa las filas con CRLF", () => {
    const csv = armarCSV(["a"], [["1"], ["2"]]);
    expect(csv).toBe("﻿a\r\n1\r\n2\r\n");
  });
});

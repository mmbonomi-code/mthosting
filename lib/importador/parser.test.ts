import { describe, expect, it } from "vitest";
import {
  ErrorImportacion,
  esCancelada,
  parsearArchivoReservas,
  parsearCSV,
  parsearFechaDMA,
  parsearFechaISO,
  parsearGanancias,
  timestampDeNombre,
} from "./parser";

//   = espacio duro que usa Airbnb después del $
const NBSP = " ";

describe("parsearGanancias", () => {
  it("coma decimal con espacio duro (formato actual)", () => {
    expect(parsearGanancias(`$${NBSP}93,53`)).toBe(93.53);
  });

  it("coma decimal sin espacio (formato viejo, validado en archivos reales)", () => {
    expect(parsearGanancias("$102,25")).toBe(102.25);
  });

  it("punto decimal cuando no hay coma (caso de la spec)", () => {
    expect(parsearGanancias(`$${NBSP}0.00`)).toBe(0);
  });

  it("mayor a 1000: el punto es de miles, la coma el decimal", () => {
    // El caso donde un parser invertido convierte 1.234 dólares en 1,234.
    expect(parsearGanancias(`$${NBSP}1.234,56`)).toBe(1234.56);
    expect(parsearGanancias("$1.639,30")).toBe(1639.3);
    expect(parsearGanancias(`$${NBSP}5.587,00`)).toBe(5587);
    expect(parsearGanancias(`$${NBSP}4.070,32`)).toBe(4070.32);
  });

  it("montos negativos: penalidad por cancelación del anfitrión", () => {
    expect(parsearGanancias(`-$${NBSP}50,00`)).toBe(-50);
    expect(parsearGanancias("-$50,00")).toBe(-50);
    expect(parsearGanancias(`-$${NBSP}74,15`)).toBe(-74.15);
  });

  it("vacío es null, nunca cero: un vacío no es un dato", () => {
    expect(parsearGanancias("")).toBeNull();
    expect(parsearGanancias("   ")).toBeNull();
  });

  it("basura se rechaza con error claro", () => {
    expect(() => parsearGanancias("N/A")).toThrow(ErrorImportacion);
    expect(() => parsearGanancias("$")).toThrow(ErrorImportacion);
  });
});

describe("parsearFechaDMA", () => {
  it("día primero SIEMPRE: 5/7/2026 es 5 de julio, no 7 de mayo", () => {
    expect(parsearFechaDMA("5/7/2026")).toBe("2026-07-05");
  });

  it("sin ceros a la izquierda, día y mes de una o dos cifras", () => {
    expect(parsearFechaDMA("15/7/2026")).toBe("2026-07-15");
    expect(parsearFechaDMA("31/7/2026")).toBe("2026-07-31");
    expect(parsearFechaDMA("16/11/2025")).toBe("2025-11-16");
    expect(parsearFechaDMA("9/1/2027")).toBe("2027-01-09");
  });

  it("rechaza fechas inexistentes", () => {
    expect(() => parsearFechaDMA("31/2/2026")).toThrow(ErrorImportacion);
    expect(() => parsearFechaDMA("0/5/2026")).toThrow(ErrorImportacion);
  });

  it("rechaza otros formatos en vez de adivinar", () => {
    expect(() => parsearFechaDMA("2026-07-15")).toThrow(ErrorImportacion);
    expect(() => parsearFechaDMA("")).toThrow(ErrorImportacion);
    expect(() => parsearFechaDMA("15/7/26")).toThrow(ErrorImportacion);
  });
});

describe("parsearFechaISO", () => {
  it("acepta aaaa-mm-dd (columna Reservada)", () => {
    expect(parsearFechaISO("2026-06-06")).toBe("2026-06-06");
  });

  it("vacía es null (pasa en exports viejos)", () => {
    expect(parsearFechaISO("")).toBeNull();
  });

  it("rechaza d/m/aaaa donde se espera ISO", () => {
    expect(() => parsearFechaISO("6/6/2026")).toThrow(ErrorImportacion);
  });
});

describe("esCancelada", () => {
  it("detecta las tres variantes reales de cancelación", () => {
    expect(esCancelada("Cancelación por parte del viajero")).toBe(true);
    expect(esCancelada("Cancelada por Airbnb")).toBe(true);
    expect(esCancelada("Cancelada por vos")).toBe(true);
  });

  it("no confunde los demás estados observados", () => {
    for (const estado of [
      "Confirmada",
      "Estadía en curso",
      "Se va hoy",
      "Evaluá al huésped",
      "Evaluá al huésped: vence pronto",
      "Huésped anterior",
      "Viaje solicitado",
      "El huésped solicitó un cambio en el viaje",
      "Solicitud de cambio de viaje enviada",
      "Pago pendiente",
    ]) {
      expect(esCancelada(estado)).toBe(false);
    }
  });
});

describe("parsearCSV", () => {
  it("respeta comas dentro de comillas", () => {
    const filas = parsearCSV('"a","b,c","d"\n"1","2","3"');
    expect(filas).toEqual([
      ["a", "b,c", "d"],
      ["1", "2", "3"],
    ]);
  });

  it("respeta comillas escapadas y saltos CRLF", () => {
    const filas = parsearCSV('"dice ""hola""","x"\r\n"y","z"');
    expect(filas).toEqual([
      ['dice "hola"', "x"],
      ["y", "z"],
    ]);
  });

  it("ignora la línea vacía final y el BOM", () => {
    const filas = parsearCSV('﻿"a","b"\n"1","2"\n');
    expect(filas).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

// Arma un CSV de reservas válido a partir de filas de 13 columnas.
const ENCABEZADO =
  '"Código de confirmación","Estado","Nombre del huésped","Contacto","Número de adultos","Número de niños","Número de bebés","Fecha de inicio","Fecha de finalización","Número de noches","Reservada","Anuncio","Ganancias"';

function armarCSV(...filas: string[][]): string {
  return [
    ENCABEZADO,
    ...filas.map((f) => f.map((v) => `"${v}"`).join(",")),
  ].join("\r\n");
}

describe("parsearArchivoReservas", () => {
  it("parsea una fila completa con todos los campos", () => {
    const csv = armarCSV([
      "HMCNXQKHP5",
      "Estadía en curso",
      "Gerardo Pérez",
      "+598 99 362 008",
      "4",
      "0",
      "0",
      "31/7/2026",
      "3/8/2026",
      "3",
      "2026-06-06",
      "Tranquilo y familiar en recoleta",
      `$${NBSP}206,61`,
    ]);
    const [fila] = parsearArchivoReservas(csv);
    expect(fila).toMatchObject({
      codigo_reserva: "HMCNXQKHP5",
      estado_raw: "Estadía en curso",
      cancelada: false,
      huesped_nombre: "Gerardo Pérez",
      huesped_contacto: "+598 99 362 008",
      adultos: 4,
      ninos: 0,
      bebes: 0,
      noches: 3,
      fecha_checkin: "2026-07-31",
      fecha_checkout: "2026-08-03",
      fecha_reservada: "2026-06-06",
      listing_nombre_raw: "Tranquilo y familiar en recoleta",
      payout_monto: 206.61,
      payout_moneda: "USD",
    });
    expect(fila.raw["Ganancias"]).toBe(`$${NBSP}206,61`);
  });

  it("al teléfono argentino le agrega el 9 que Airbnb no manda", () => {
    const csv = armarCSV([
      "HMCNXQKHP5",
      "Estadía en curso",
      "Camila Arguello",
      "+54 11 4428-2700",
      "2",
      "0",
      "0",
      "31/7/2026",
      "3/8/2026",
      "3",
      "2026-06-06",
      "Tranquilo y familiar en recoleta",
      `$${NBSP}206,61`,
    ]);
    const [fila] = parsearArchivoReservas(csv);
    expect(fila.huesped_contacto).toBe("+54 9 11 4428-2700");
    // El crudo se guarda tal como vino: la corrección es nuestra, no de Airbnb.
    expect(fila.raw["Contacto"]).toBe("+54 11 4428-2700");
  });

  it("cancelada con contacto vacío: cancelada=true, contacto null", () => {
    const csv = armarCSV([
      "HMKJ3MSHCN",
      "Cancelación por parte del viajero",
      "Bárbara",
      "",
      "2",
      "0",
      "0",
      "31/7/2026",
      "3/8/2026",
      "3",
      "2026-06-02",
      "Exclusivo depto en Recoleta 05",
      `$${NBSP}0,00`,
    ]);
    const [fila] = parsearArchivoReservas(csv);
    expect(fila.cancelada).toBe(true);
    expect(fila.huesped_contacto).toBeNull();
    expect(fila.payout_monto).toBe(0);
  });

  it("cancelada puede tener Ganancias > 0 (retención por política)", () => {
    const csv = armarCSV([
      "HMCSASMPM8",
      "Cancelación por parte del viajero",
      "Pablo",
      "",
      "3",
      "0",
      "0",
      "7/8/2026",
      "9/8/2026",
      "2",
      "2026-06-13",
      "Luminoso, amplio y confortable en Recoleta",
      `$${NBSP}31,94`,
    ]);
    const [fila] = parsearArchivoReservas(csv);
    expect(fila.cancelada).toBe(true);
    expect(fila.payout_monto).toBe(31.94);
  });

  it("anuncio con coma en el nombre no rompe las columnas", () => {
    const csv = armarCSV([
      "HMEDTY34YY",
      "Confirmada",
      "Maíra Pita",
      "+55 21 98811-3838",
      "3",
      "0",
      "0",
      "5/8/2026",
      "7/8/2026",
      "2",
      "2026-06-10",
      "Luminoso, amplio y confortable en Recoleta",
      `$${NBSP}61,17`,
    ]);
    const [fila] = parsearArchivoReservas(csv);
    expect(fila.listing_nombre_raw).toBe(
      "Luminoso, amplio y confortable en Recoleta",
    );
  });

  it("Ganancias y Reservada vacías quedan null (exports viejos)", () => {
    const csv = armarCSV([
      "HMVIEJO001",
      "Huésped anterior",
      "Alguien",
      "+54 11 0000-0000",
      "2",
      "0",
      "0",
      "1/2/2026",
      "3/2/2026",
      "2",
      "",
      "Algún anuncio",
      "",
    ]);
    const [fila] = parsearArchivoReservas(csv);
    expect(fila.payout_monto).toBeNull();
    expect(fila.fecha_reservada).toBeNull();
  });

  it("parsear dos veces da exactamente lo mismo (determinismo)", () => {
    const csv = armarCSV([
      "HMCNXQKHP5",
      "Confirmada",
      "Alguien",
      "+54 11 1111-1111",
      "2",
      "0",
      "0",
      "5/8/2026",
      "7/8/2026",
      "2",
      "2026-07-01",
      "Anuncio",
      `$${NBSP}100,00`,
    ]);
    expect(parsearArchivoReservas(csv)).toEqual(parsearArchivoReservas(csv));
  });

  it("rechaza el archivo ENTERO si el encabezado no coincide", () => {
    const csv = '"Codigo","Estado"\n"HM123","Confirmada"';
    expect(() => parsearArchivoReservas(csv)).toThrow(ErrorImportacion);
    expect(() => parsearArchivoReservas(csv)).toThrow(/encabezado/i);
  });

  it("rechaza filas sin código de confirmación", () => {
    const csv = armarCSV([
      "",
      "Confirmada",
      "Alguien",
      "+54 11 1111-1111",
      "2",
      "0",
      "0",
      "5/8/2026",
      "7/8/2026",
      "2",
      "2026-07-01",
      "Anuncio",
      `$${NBSP}100,00`,
    ]);
    expect(() => parsearArchivoReservas(csv)).toThrow(ErrorImportacion);
  });
});

describe("timestampDeNombre", () => {
  it("acepta el estilo con espacios y punto (exports actuales)", () => {
    expect(timestampDeNombre("reservations - 2026-08-02T084540.299.csv")).toBe(
      "2026-08-02T084540.299000",
    );
  });

  it("acepta el estilo con guiones bajos (ejemplo de la spec)", () => {
    expect(timestampDeNombre("reservations_-_2026-07-18T080825_717.csv")).toBe(
      "2026-07-18T080825.717000",
    );
  });

  it("ordena bien entre los dos estilos", () => {
    const a = timestampDeNombre("reservations - 2026-08-02T084519.336.csv")!;
    const b = timestampDeNombre("reservations - 2026-08-02T084540.299.csv")!;
    const c = timestampDeNombre("reservations_-_2026-07-18T080825_717.csv")!;
    expect([b, c, a].sort()).toEqual([c, a, b]);
  });

  it("nombre irreconocible devuelve null (va al final, con warning)", () => {
    expect(timestampDeNombre("reservas-de-julio.csv")).toBeNull();
  });
});

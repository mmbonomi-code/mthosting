import { describe, expect, it } from "vitest";
import {
  cotizacionesDelArchivo,
  ErrorCaja,
  parsearCajaNinox,
  parsearCSV,
  parsearFechaNinox,
  parsearMontoNinox,
  parsearSiNo,
  saldoDelArchivo,
} from "./ninox";

const CABECERA =
  "FECHA;MOVIMIENTO;TIPO DE GASTO;DETALLE;MONTO;SALDO ACUMULADO INGRESOS;" +
  "REEMBOLSO?;OBSERVACION;NOMBRE;VALOR USD;REEMBOLSO PAGADO?;FORMA DE PAGO;FECHA PAGO";

const archivo = (...filas: string[]) => [CABECERA, ...filas].join("\r\n");

describe("parsearCSV", () => {
  it("respeta los saltos de línea adentro de un campo entrecomillado", () => {
    // Es el caso real: una observación de dos renglones parte la fila.
    const filas = parsearCSV('a;b;"linea uno\nlinea dos";d');
    expect(filas).toHaveLength(1);
    expect(filas[0][2]).toBe("linea uno\nlinea dos");
  });

  it("una comilla escapada adentro del campo", () => {
    expect(parsearCSV('a;"dijo ""hola""";c')[0][1]).toBe('dijo "hola"');
  });

  it("descarta el BOM del principio", () => {
    expect(parsearCSV("﻿FECHA;MOVIMIENTO")[0][0]).toBe("FECHA");
  });
});

describe("parsearFechaNinox", () => {
  it("lee el formato castellano abreviado", () => {
    expect(parsearFechaNinox("4 feb. 2026")).toBe("2026-02-04");
    expect(parsearFechaNinox("17 abr. 2026")).toBe("2026-04-17");
    expect(parsearFechaNinox("10 ago. 2026")).toBe("2026-08-10");
  });

  it("tolera que falte el punto", () => {
    expect(parsearFechaNinox("5 feb 2026")).toBe("2026-02-05");
  });

  it("vacío es null, no una fecha inventada", () => {
    expect(parsearFechaNinox("")).toBeNull();
    expect(parsearFechaNinox("   ")).toBeNull();
  });

  it("rechaza lo que no entiende en vez de adivinar", () => {
    expect(() => parsearFechaNinox("4/2/2026")).toThrow(ErrorCaja);
    expect(() => parsearFechaNinox("4 xxx. 2026")).toThrow(ErrorCaja);
  });

  it("rechaza una fecha que no existe", () => {
    expect(() => parsearFechaNinox("31 feb. 2026")).toThrow(/inexistente/i);
  });
});

describe("parsearMontoNinox", () => {
  it("punto de miles y coma decimal", () => {
    expect(parsearMontoNinox("1.716.000")).toBe(1_716_000);
    expect(parsearMontoNinox("1187,543253")).toBeCloseTo(1187.543253, 6);
    expect(parsearMontoNinox("367600")).toBe(367_600);
  });

  it("Infinity no es un dato: es una división por cero del archivo viejo", () => {
    expect(parsearMontoNinox("Infinity")).toBeNull();
    expect(parsearMontoNinox("-Infinity")).toBeNull();
  });

  it("vacío es null", () => {
    expect(parsearMontoNinox("")).toBeNull();
  });

  it("rechaza texto en la columna de monto", () => {
    expect(() => parsearMontoNinox("CUENTA CORRIENTE")).toThrow(ErrorCaja);
  });
});

describe("parsearSiNo", () => {
  it("solo Sí es verdadero", () => {
    expect(parsearSiNo("Sí")).toBe(true);
    expect(parsearSiNo("si")).toBe(true);
    expect(parsearSiNo("No")).toBe(false);
    expect(parsearSiNo("")).toBe(false);
  });
});

describe("parsearCajaNinox", () => {
  it("parsea una fila real completa", () => {
    const csv = archivo(
      "4 feb. 2026;EGRESO;ARREGLO;TERMOTANQUE;367600;1148900;Sí;" +
        "Descontar de la cuenta corriente;MARCELO T 3;254,3944637;Sí;" +
        "CUENTA CORRIENTE;17 abr. 2026",
    );
    expect(parsearCajaNinox(csv)[0]).toEqual({
      fecha: "2026-02-04",
      tipo: "egreso",
      categoria: "ARREGLO",
      descripcion: "TERMOTANQUE",
      monto: 367_600,
      depto: "MARCELO T 3",
      reembolsable: true,
      cobrado: true,
      forma_cobro: "CUENTA CORRIENTE",
      fecha_cobro: "2026-04-17",
      observacion: "Descontar de la cuenta corriente",
      tc: 1445,
    });
  });

  it("un ingreso queda como ingreso", () => {
    const csv = archivo(
      "4 feb. 2026;INGRESO;CAMBIO URVA;1430 X 1200;1716000;1148900;;;;1187,543253;;;",
    );
    const [fila] = parsearCajaNinox(csv);
    expect(fila.tipo).toBe("ingreso");
    expect(fila.monto).toBe(1_716_000);
    expect(fila.tc).toBe(1445);
  });

  it("saltea las filas separadoras vacías del export", () => {
    const csv = archivo(
      ";;;;;;;;;;;;",
      "4 feb. 2026;EGRESO;OFICINA;CAFE;10000;100;;;;;;;",
      ";;;;;;;;;;;;",
    );
    expect(parsearCajaNinox(csv)).toHaveLength(1);
  });

  it("sin valor en dólares utilizable, la cotización queda en null", () => {
    const csv = archivo(
      "19 may. 2026;EGRESO;SUELDO;HORAS EXTRAS ANTO;29000;157816;;;;Infinity;;;",
    );
    expect(parsearCajaNinox(csv)[0].tc).toBeNull();
  });

  it("normaliza el doble espacio de «GASTOS  SERVICIOS»", () => {
    const csv = archivo("4 feb. 2026;EGRESO;GASTOS  SERVICIOS;LUZ;5000;100;;;;;;;");
    expect(parsearCajaNinox(csv)[0].categoria).toBe("GASTOS SERVICIOS");
  });

  it("rechaza el archivo entero si el encabezado no es el esperado", () => {
    expect(() => parsearCajaNinox("OTRA;COSA\n1;2")).toThrow(/columnas/i);
  });

  it("rechaza un movimiento que no sea INGRESO ni EGRESO", () => {
    const csv = archivo("4 feb. 2026;ED TALC 05;OFICINA;X;100;0;;;;;;;");
    expect(() => parsearCajaNinox(csv)).toThrow(/INGRESO o EGRESO/);
  });

  it("rechaza un monto vacío o en cero: no hay movimiento sin plata", () => {
    expect(() => parsearCajaNinox(archivo("4 feb. 2026;EGRESO;OFICINA;X;;0;;;;;;;"))).toThrow(
      /monto/i,
    );
    expect(() => parsearCajaNinox(archivo("4 feb. 2026;EGRESO;OFICINA;X;0;0;;;;;;;"))).toThrow(
      /monto/i,
    );
  });

  it("rechaza una fila sin categoría", () => {
    expect(() => parsearCajaNinox(archivo("4 feb. 2026;EGRESO;;X;100;0;;;;;;;"))).toThrow(
      /tipo de gasto/i,
    );
  });
});

describe("cotizacionesDelArchivo", () => {
  it("saca una cotización por fecha", () => {
    const csv = archivo(
      "4 feb. 2026;INGRESO;CAMBIO URVA;X;1716000;0;;;;1187,543253;;;",
      "5 feb. 2026;EGRESO;OFICINA;Y;100000;0;;;;69,6864111;;;",
    );
    const { cotizaciones, conflictos } = cotizacionesDelArchivo(parsearCajaNinox(csv));
    expect(cotizaciones).toEqual([
      { fecha: "2026-02-04", tc: 1445 },
      { fecha: "2026-02-05", tc: 1435 },
    ]);
    expect(conflictos).toEqual([]);
  });

  it("avisa si una fecha trae dos cotizaciones distintas, no elige en silencio", () => {
    const csv = archivo(
      "4 feb. 2026;EGRESO;OFICINA;X;100000;0;;;;69,20415225;;;",
      "4 feb. 2026;EGRESO;OFICINA;Y;100000;0;;;;66,66666667;;;",
    );
    const { conflictos } = cotizacionesDelArchivo(parsearCajaNinox(csv));
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0]).toMatch(/2026-02-04/);
  });

  it("las fechas sin cotización no aparecen", () => {
    const csv = archivo("4 feb. 2026;EGRESO;OFICINA;X;100000;0;;;;Infinity;;;");
    expect(cotizacionesDelArchivo(parsearCajaNinox(csv)).cotizaciones).toEqual([]);
  });
});

describe("saldoDelArchivo", () => {
  it("ingresos menos egresos", () => {
    const csv = archivo(
      "4 feb. 2026;INGRESO;CAMBIO URVA;X;1716000;0;;;;;;;",
      "4 feb. 2026;EGRESO;ARREGLO;Y;367600;0;;;;;;;",
    );
    expect(saldoDelArchivo(parsearCajaNinox(csv))).toBe(1_348_400);
  });
});

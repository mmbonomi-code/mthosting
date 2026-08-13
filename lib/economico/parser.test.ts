import { describe, expect, it } from "vitest";
import {
  categorizar,
  ErrorArchivoEconomico,
  normalizarTexto,
  parsearCuenta,
  parsearFechaAirbnb,
  parsearNumero,
  parsearTransacciones,
  repararMojibake,
} from "./parser";

const ENCABEZADO_21 =
  "Fecha,Fecha de llegada estimada,Tipo,Código de confirmación,Fecha de la reserva," +
  "Fecha de inicio,Fecha de finalización,Noches,Huésped,Anuncio,Detalles," +
  "Código de referencia,Moneda,Monto,Cobrado,Tarifa por servicio," +
  "Tarifa por Pago rápido,Tarifa de limpieza,Ingresos brutos," +
  "Impuestos liquidados por Airbnb,Año de ingresos";

/** Arma una fila de 21 columnas a partir de lo que importa del caso. */
function fila(campos: Partial<Record<string, string>>): string {
  const orden = [
    "Fecha", "Fecha de llegada estimada", "Tipo", "Código de confirmación",
    "Fecha de la reserva", "Fecha de inicio", "Fecha de finalización", "Noches",
    "Huésped", "Anuncio", "Detalles", "Código de referencia", "Moneda", "Monto",
    "Cobrado", "Tarifa por servicio", "Tarifa por Pago rápido",
    "Tarifa de limpieza", "Ingresos brutos", "Impuestos liquidados por Airbnb",
    "Año de ingresos",
  ];
  return orden
    .map((c) => {
      const v = campos[c] ?? "";
      return v.includes(",") ? `"${v}"` : v;
    })
    .join(",");
}

describe("repararMojibake", () => {
  it("arregla los acentos que quedaron rotos en archivos viejos", () => {
    expect(repararMojibake("CÃ³modo y luminoso departamento")).toBe(
      "Cómodo y luminoso departamento",
    );
    expect(repararMojibake("Excelente ubicaciÃ³n en Recoleta")).toBe(
      "Excelente ubicación en Recoleta",
    );
  });

  it("arregla también los que pasaron por Windows-1252", () => {
    // La 'š' no existe en Latin-1: sin la tabla de CP1252 este caso no sale.
    expect(repararMojibake("Ãšnico en el centro de Palermo!")).toBe(
      "Único en el centro de Palermo!",
    );
    expect(repararMojibake("SoÃ±ado departamento en Palermo")).toBe(
      "Soñado departamento en Palermo",
    );
  });

  it("no toca el texto que está bien", () => {
    expect(repararMojibake("Cómodo y luminoso departamento")).toBe(
      "Cómodo y luminoso departamento",
    );
    expect(repararMojibake("Único en el centro de Palermo!")).toBe(
      "Único en el centro de Palermo!",
    );
  });

  it("un anuncio roto y uno sano terminan siendo el mismo", () => {
    expect(normalizarTexto("CÃ³modo y luminoso departamento")).toBe(
      normalizarTexto("Cómodo y luminoso departamento"),
    );
  });
});

describe("parsearFechaAirbnb", () => {
  it("lee el formato de Estados Unidos, que es el que exporta Airbnb", () => {
    // 05/16 es 16 de MAYO, no 5 de junio: leerlo al revés corre los meses.
    expect(parsearFechaAirbnb("05/16/2026")).toBe("2026-05-16");
    expect(parsearFechaAirbnb("12/01/2025")).toBe("2025-12-01");
    expect(parsearFechaAirbnb("1/3/2026")).toBe("2026-01-03");
  });

  it("acepta también el formato ISO", () => {
    expect(parsearFechaAirbnb("2026-05-16")).toBe("2026-05-16");
  });

  it("devuelve null cuando no hay fecha", () => {
    expect(parsearFechaAirbnb("")).toBeNull();
    expect(parsearFechaAirbnb(null)).toBeNull();
    expect(parsearFechaAirbnb("cualquier cosa")).toBeNull();
  });
});

describe("parsearNumero", () => {
  it("lee coma y punto decimal, que conviven en el mismo archivo", () => {
    expect(parsearNumero("126.39")).toBe(126.39);
    expect(parsearNumero("3,91")).toBe(3.91);
    expect(parsearNumero("2,07")).toBe(2.07);
  });

  it("lee negativos: las líneas de coanfitrión vienen así", () => {
    expect(parsearNumero("-135.98")).toBe(-135.98);
    expect(parsearNumero("-88,36")).toBe(-88.36);
  });

  it("lee montos grandes con separador de miles", () => {
    expect(parsearNumero("404.499,72")).toBe(404499.72);
    expect(parsearNumero("1,234.56")).toBe(1234.56);
    expect(parsearNumero("46784.75")).toBe(46784.75);
  });

  it("con tres dígitos y un solo separador, es miles", () => {
    // Un importe de Airbnb con tres decimales no existe.
    expect(parsearNumero("1,234")).toBe(1234);
    expect(parsearNumero("1.234")).toBe(1234);
  });

  it("distingue el cero del vacío", () => {
    expect(parsearNumero("0.00")).toBe(0);
    expect(parsearNumero("")).toBeNull();
    expect(parsearNumero(null)).toBeNull();
  });
});

describe("categorizar", () => {
  it("reconoce los tipos de Airbnb", () => {
    expect(categorizar("Reserva", null)).toBe("reserva");
    expect(categorizar("Cobro como coanfitrión", null)).toBe("coanfitrion");
    expect(categorizar("Payout", null)).toBe("payout");
    expect(categorizar("Cobro de la resolución", "Cobro de la resolución CLA-X")).toBe(
      "resolucion",
    );
    expect(categorizar("Ajuste", null)).toBe("ajuste");
    expect(categorizar("Ajuste de la resolución", null)).toBe("ajuste_resolucion");
    expect(categorizar("Tarifa de cancelación", null)).toBe("tarifa_cancelacion");
  });

  it("separa el AirCover del resto de las resoluciones", () => {
    // Llega como cobro de resolución pero es una indemnización por daños:
    // comisionarla sola sería cobrarle comisión al propietario sobre la
    // reparación de su propio departamento.
    expect(
      categorizar(
        "Cobro de la resolución",
        "Reembolso de AirCover por daños para la resolución CLSF-05854607",
      ),
    ).toBe("aircover");
  });

  it("un tipo desconocido no se pierde: cae en 'otro'", () => {
    expect(categorizar("Algo que Airbnb invente mañana", null)).toBe("otro");
  });
});

describe("parsearCuenta", () => {
  it("agrupa por número: la 4343 aparece con siete grafías y es una sola", () => {
    const grafias = [
      "Transferir a MTHOSTING, Checking 4343 (USD)",
      "Transferir a MTHosting LLC, Checking 4343 (USD)",
      "Transferir a MT HOSTING, Savings 4343 (USD)",
      "Transferir a Tomas CRESSALL, Checking 4343 (USD)",
    ];
    const claves = new Set(grafias.map((g) => parsearCuenta(g)!.clave));
    expect(claves.size).toBe(1);
    expect([...claves][0]).toBe("num:4343");
  });

  it("saca titular, tipo, número y moneda", () => {
    const c = parsearCuenta("Transferir a MTHosting LLC, Checking 4343 (USD)")!;
    expect(c.titular).toBe("MTHosting LLC");
    expect(c.tipo).toBe("checking");
    expect(c.numero).toBe("4343");
    expect(c.moneda).toBe("USD");
  });

  it("lee una cuenta sin tipo declarado", () => {
    const c = parsearCuenta("Transferir a Emmanuel De Saizieu, 0665 (ARS)")!;
    expect(c.titular).toBe("Emmanuel De Saizieu");
    expect(c.numero).toBe("0665");
    expect(c.moneda).toBe("ARS");
    expect(c.clave).toBe("num:0665");
  });

  it("lee los destinos sin número", () => {
    const payoneer = parsearCuenta("Transferir a Tarjeta de débito: Payoneer (USD)")!;
    expect(payoneer.tipo).toBe("payoneer");
    expect(payoneer.numero).toBeNull();
    expect(payoneer.clave).toBe("txt:transferir a tarjeta de debito: payoneer (usd)");

    expect(parsearCuenta("Transferir a PayPal b••••n@gmail.com")!.tipo).toBe("paypal");
  });

  it("la misma cuenta escrita distinto cae en la misma clave", () => {
    expect(parsearCuenta("Transferir a Tarjeta de débito: Payoneer (USD)")!.clave).toBe(
      parsearCuenta("Transferir a TARJETA DE DEBITO: Payoneer (USD)")!.clave,
    );
  });
});

describe("parsearTransacciones", () => {
  it("rechaza un archivo que no es un historial de transacciones", () => {
    expect(() => parsearTransacciones("Nombre,Apellido\nJuan,Perez")).toThrow(
      ErrorArchivoEconomico,
    );
  });

  it("busca las columnas por nombre, no por posición", () => {
    // La variante de 18 columnas no trae `Cobrado` ni `Fecha de llegada
    // estimada`: todo lo demás corre de lugar.
    const csv = [
      "Fecha,Tipo,Código de confirmación,Anuncio,Moneda,Monto,Tarifa de limpieza",
      "05/16/2026,Reserva,HMFHESYFNB,Depto lindo,USD,611.88,17.00",
    ].join("\n");
    const { filas, pareceProgramado } = parsearTransacciones(csv);
    expect(filas).toHaveLength(1);
    expect(filas[0].monto).toBe(611.88);
    expect(filas[0].tarifa_limpieza).toBe(17);
    expect(filas[0].codigo_confirmacion).toBe("HMFHESYFNB");
    // Sin columna Cobrado: son los programados.
    expect(pareceProgramado).toBe(true);
  });

  it("en los payouts el importe sale de Cobrado, no de Monto", () => {
    // El Monto viene vacío en los Payout. Tomarlo de ahí daría cero.
    const csv = [
      ENCABEZADO_21,
      fila({
        Fecha: "05/17/2026",
        Tipo: "Payout",
        Detalles: "Transferir a Emmanuel De Saizieu, 0665 (ARS)",
        Moneda: "ARS",
        Cobrado: "46784.75",
      }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas[0].monto).toBeNull();
    expect(filas[0].cobrado).toBe(46784.75);
    expect(filas[0].importe).toBe(46784.75);
    expect(filas[0].es_payout).toBe(true);
    expect(filas[0].cuenta!.clave).toBe("num:0665");
  });

  it("conserva el signo negativo del coanfitrión", () => {
    const csv = [
      ENCABEZADO_21,
      fila({ Fecha: "05/17/2026", Tipo: "Payout", Moneda: "ARS", Cobrado: "100.00" }),
      fila({
        Fecha: "05/17/2026",
        Tipo: "Cobro como coanfitrión",
        "Código de confirmación": "HMQDFREHR3",
        Anuncio: "Único en el centro de Palermo!",
        Moneda: "USD",
        Monto: "-33.39",
      }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas[1].monto).toBe(-33.39);
    expect(filas[1].importe).toBe(-33.39);
  });

  it("agrupa cada payout con las filas que le siguen", () => {
    const csv = [
      ENCABEZADO_21,
      fila({ Fecha: "06/20/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "45.00" }),
      fila({ Fecha: "06/20/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "20.00" }),
      fila({ Fecha: "06/20/2026", Tipo: "Reserva", Anuncio: "B", Moneda: "USD", Monto: "25.00" }),
      fila({ Fecha: "06/21/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "10.00" }),
      fila({ Fecha: "06/21/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "10.00" }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas.map((f) => f.grupo_payout)).toEqual([1, 1, 1, 2, 2]);
    // Un archivo puede traer varios departamentos: la imputación es fila por
    // fila, por el anuncio, nunca "un archivo = un departamento".
    expect(filas.filter((f) => f.grupo_payout === 1 && f.anuncio).map((f) => f.anuncio))
      .toEqual(["A", "B"]);
  });

  it("marca los grupos que traen línea de coanfitrión", () => {
    // Es lo que después distingue la plata propia de la del propietario en
    // tránsito: si la comisión ya se cobró como coanfitrión, el payout es
    // custodia y no vuelve a contarse.
    const csv = [
      ENCABEZADO_21,
      fila({ Fecha: "07/17/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "327.49" }),
      fila({ Fecha: "07/17/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "415.06" }),
      fila({
        Fecha: "07/17/2026",
        Tipo: "Cobro como coanfitrión",
        Anuncio: "A",
        Moneda: "USD",
        Monto: "-87.57",
      }),
      fila({ Fecha: "07/18/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "50.00" }),
      fila({ Fecha: "07/18/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "50.00" }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas.filter((f) => f.grupo_payout === 1).every((f) => f.grupo_con_coanfitrion))
      .toBe(true);
    expect(filas.filter((f) => f.grupo_payout === 2).some((f) => f.grupo_con_coanfitrion))
      .toBe(false);
  });

  it("avisa cuando un payout se quedó sin sus filas de detalle", () => {
    const csv = [
      ENCABEZADO_21,
      fila({ Fecha: "07/17/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "80.00" }),
      fila({ Fecha: "07/18/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "50.00" }),
      fila({ Fecha: "07/18/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "50.00" }),
    ].join("\n");
    const { avisos } = parsearTransacciones(csv);
    expect(avisos.some((a) => a.includes("sin filas de detalle"))).toBe(true);
  });

  it("avisa cuando el archivo arranca con filas sueltas antes del primer payout", () => {
    const csv = [
      ENCABEZADO_21,
      fila({ Fecha: "07/17/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "50.00" }),
      fila({ Fecha: "07/18/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "50.00" }),
    ].join("\n");
    const { filas, avisos } = parsearTransacciones(csv);
    expect(filas[0].grupo_payout).toBeNull();
    expect(avisos.some((a) => a.includes("antes del primer Payout"))).toBe(true);
  });

  it("numera las filas idénticas del mismo archivo para no perder ninguna", () => {
    // Dos payouts de 0,00 el mismo día a la misma cuenta existen de verdad.
    // Sin el contador, el segundo se tomaría como copia del primero.
    const payout = fila({
      Fecha: "07/17/2026",
      Tipo: "Payout",
      Detalles: "Transferir a MTHOSTING, Checking 4343 (USD)",
      Moneda: "USD",
      Cobrado: "0.00",
    });
    const { filas } = parsearTransacciones([ENCABEZADO_21, payout, payout].join("\n"));
    expect(filas.map((f) => f.ocurrencia)).toEqual([1, 2]);
    expect(filas[0].huella).not.toBe(filas[1].huella);
  });

  it("dos payouts del mismo día a la misma cuenta por distinto importe son dos", () => {
    // Verificado sobre datos reales: sin `Cobrado` en la clave, estos dos
    // colapsaban en uno y se perdían 48.723,99.
    const csv = [
      ENCABEZADO_21,
      fila({
        Fecha: "05/14/2026",
        Tipo: "Payout",
        Detalles: "Transferir a MTHOSTING, Checking 4343 (USD)",
        Moneda: "ARS",
        Cobrado: "41944.39",
      }),
      fila({
        Fecha: "05/14/2026",
        Tipo: "Payout",
        Detalles: "Transferir a MTHOSTING, Checking 4343 (USD)",
        Moneda: "ARS",
        Cobrado: "48723.99",
      }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas[0].huella).not.toBe(filas[1].huella);
    expect(filas.map((f) => f.ocurrencia)).toEqual([1, 1]);
  });

  it("la misma reserva cobrada en dos meses son dos filas, no un duplicado", () => {
    const base = {
      Tipo: "Reserva",
      "Código de confirmación": "HMFHESYFNB",
      Anuncio: "Exclusivo depto en Recoleta 07",
      Moneda: "USD",
    };
    const csv = [
      ENCABEZADO_21,
      fila({ ...base, Fecha: "05/16/2026", Monto: "611.88" }),
      fila({ ...base, Fecha: "06/16/2026", Monto: "300.00" }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas[0].huella).not.toBe(filas[1].huella);
  });

  it("la huella no depende del archivo ni del orden de importación", () => {
    // Es lo que hace que importar 40 archivos que se solapan dé el mismo
    // resultado en cualquier orden.
    const linea = fila({
      Fecha: "05/16/2026",
      Tipo: "Reserva",
      "Código de confirmación": "HMFHESYFNB",
      Anuncio: "Exclusivo depto en Recoleta 07",
      Moneda: "USD",
      Monto: "611.88",
      "Tarifa de limpieza": "17.00",
    });
    const otra = fila({ Fecha: "01/02/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "1.00" });

    const a = parsearTransacciones([ENCABEZADO_21, linea].join("\n"));
    const b = parsearTransacciones([ENCABEZADO_21, otra, linea].join("\n"));
    expect(a.filas[0].huella).toBe(b.filas[1].huella);
  });

  it("guarda la línea del archivo para poder auditar el número", () => {
    const csv = [
      ENCABEZADO_21,
      fila({ Fecha: "05/16/2026", Tipo: "Payout", Moneda: "USD", Cobrado: "1.00" }),
      fila({ Fecha: "05/16/2026", Tipo: "Reserva", Anuncio: "A", Moneda: "USD", Monto: "1.00" }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    // El encabezado es el renglón 1: la primera fila de datos es la 2.
    expect(filas.map((f) => f.linea)).toEqual([2, 3]);
    expect(filas.map((f) => f.orden_en_archivo)).toEqual([0, 1]);
  });

  it("guarda la fila entera, tal como vino", () => {
    const csv = [
      ENCABEZADO_21,
      fila({
        Fecha: "05/16/2026",
        Tipo: "Reserva",
        Anuncio: "A",
        Moneda: "USD",
        Monto: "611.88",
        "Tarifa por servicio": "18,92",
      }),
    ].join("\n");
    const { filas } = parsearTransacciones(csv);
    expect(filas[0].raw["Tarifa por servicio"]).toBe("18,92");
    expect(filas[0].raw["Anuncio"]).toBe("A");
  });
});

import { describe, expect, it } from "vitest";
import {
  chequeos,
  contarGrupos,
  revisarGrupos,
  tcFueraDeLinea,
  type FilaDeGrupo,
} from "./validar";

const fila = (f: Partial<FilaDeGrupo>): FilaDeGrupo => ({
  archivo: "a.csv",
  linea: 1,
  grupo_payout: 1,
  es_payout: false,
  monto: null,
  cobrado: null,
  moneda: "USD",
  depto_id: null,
  ...f,
});

const payout = (cobrado: number, m: Partial<FilaDeGrupo> = {}) =>
  fila({ es_payout: true, cobrado, ...m });

describe("la identidad payout = suma del detalle", () => {
  it("cierra cuando la suma da", () => {
    // El caso real de la spec: 126,39 − 45,28 = 81,11.
    const g = revisarGrupos([
      payout(81.11),
      fila({ monto: 126.39, linea: 2 }),
      fila({ monto: -45.28, linea: 3 }),
    ]);
    expect(g[0].estado).toBe("cierra");
    expect(g[0].diferencia).toBeCloseTo(0, 6);
  });

  it("tolera medio centavo de redondeo", () => {
    const g = revisarGrupos([payout(100), fila({ monto: 100.004, linea: 2 })]);
    expect(g[0].estado).toBe("cierra");
  });

  it("no tolera un centavo entero", () => {
    const g = revisarGrupos([payout(100), fila({ monto: 100.01, linea: 2 })]);
    expect(g[0].estado).toBe("no_cierra");
    expect(g[0].diferencia).toBeCloseTo(-0.01, 6);
  });

  it("respeta los signos: un coanfitrión positivo resta del payout", () => {
    // Devolución de comisión al ajustar una reserva.
    const g = revisarGrupos([
      payout(105.89),
      fila({ monto: 100, linea: 2 }),
      fila({ monto: 5.89, linea: 3 }),
    ]);
    expect(g[0].estado).toBe("cierra");
  });

  it("un payout con detalle de varios departamentos cierra igual", () => {
    // 06/20: payout 45,00 → DARREGUEYRA 20,00 + BORGES 25,00.
    const g = revisarGrupos([
      payout(45),
      fila({ monto: 20, depto_id: "D", linea: 2 }),
      fila({ monto: 25, depto_id: "B", linea: 3 }),
    ]);
    expect(g[0].estado).toBe("cierra");
    expect(g[0].departamentos).toBe(2);
  });
});

describe("los casos que no son un cierre normal", () => {
  it("detecta el payout sin filas debajo", () => {
    const g = revisarGrupos([payout(50)]);
    expect(g[0].estado).toBe("sin_detalle");
  });

  it("detecta las filas sueltas sin su payout", () => {
    // Pasa cuando el corte del export deja el payout afuera del archivo.
    const g = revisarGrupos([fila({ monto: 10, linea: 2 }), fila({ monto: 20, linea: 3 })]);
    expect(g[0].estado).toBe("sin_payout");
    expect(g[0].sumaDetalle).toBeCloseTo(30, 6);
  });

  it("las filas fuera de todo grupo se ignoran, no rompen", () => {
    const g = revisarGrupos([fila({ grupo_payout: null, monto: 99 })]);
    expect(g).toHaveLength(0);
  });

  it("separa grupos del mismo número en archivos distintos", () => {
    const g = revisarGrupos([
      payout(10, { archivo: "a.csv" }),
      fila({ monto: 10, archivo: "a.csv", linea: 2 }),
      payout(20, { archivo: "b.csv" }),
      fila({ monto: 20, archivo: "b.csv", linea: 2 }),
    ]);
    expect(g).toHaveLength(2);
    expect(g.every((x) => x.estado === "cierra")).toBe(true);
  });
});

describe("el payout en otra moneda", () => {
  it("no lo marca como error: despeja el tipo de cambio", () => {
    const g = revisarGrupos([
      payout(143593, { moneda: "ARS" }),
      fila({ monto: 100, linea: 2 }),
    ]);
    expect(g[0].estado).toBe("otra_moneda");
    expect(g[0].tcDeducido).toBeCloseTo(1435.93, 2);
    expect(g[0].diferencia).toBeNull();
  });

  it("con detalle en cero no inventa un tipo de cambio", () => {
    const g = revisarGrupos([
      payout(1000, { moneda: "ARS" }),
      fila({ monto: 0, linea: 2 }),
    ]);
    expect(g[0].tcDeducido).toBeNull();
  });
});

describe("los tipos de cambio fuera de línea", () => {
  const conTc = (tcs: number[]) =>
    tcs.flatMap((tc, i) => [
      payout(100 * tc, { moneda: "ARS", grupo_payout: i, archivo: "a.csv" }),
      fila({ monto: 100, grupo_payout: i, archivo: "a.csv", linea: i * 2 + 2 }),
    ]);

  it("no marca nada cuando todos son parecidos", () => {
    expect(tcFueraDeLinea(revisarGrupos(conTc([1430, 1435, 1440, 1445])))).toHaveLength(0);
  });

  it("marca el que se dispara", () => {
    // Un grupo mal armado: al payout le emparejaron filas que no son suyas.
    const raros = tcFueraDeLinea(revisarGrupos(conTc([1430, 1435, 1440, 12000])));
    expect(raros).toHaveLength(1);
    expect(raros[0].tcDeducido).toBeCloseTo(12000, 0);
  });

  it("usa la mediana, así un roto no tapa a los demás", () => {
    // Con promedio, el 90.000 subiría el centro y los normales quedarían
    // "fuera de línea" mientras el roto pasaría por bueno.
    const raros = tcFueraDeLinea(revisarGrupos(conTc([1430, 1435, 1440, 1445, 90000])));
    expect(raros.map((g) => Math.round(g.tcDeducido!))).toEqual([90000]);
  });

  it("con menos de tres no opina", () => {
    expect(tcFueraDeLinea(revisarGrupos(conTc([1430, 99999])))).toHaveLength(0);
  });
});

describe("el semáforo", () => {
  const grupos = contarGrupos(
    revisarGrupos([
      payout(30),
      fila({ monto: 30, linea: 2 }),
      payout(50, { grupo_payout: 2 }),
      fila({ monto: 40, grupo_payout: 2, linea: 4 }),
    ]),
  );

  it("cuenta cada estado", () => {
    expect(grupos.total).toBe(2);
    expect(grupos.cierra).toBe(1);
    expect(grupos.no_cierra).toBe(1);
  });

  it("falla el chequeo de la identidad cuando algo no cierra", () => {
    const c = chequeos({
      grupos,
      anunciosSinMapear: 0,
      cuentasSinClasificar: 0,
      filasSinConvertir: 0,
      tcRaros: 0,
    });
    const identidad = c.find((x) => x.nombre.startsWith("Cada payout"))!;
    expect(identidad.ok).toBe(false);
    expect(identidad.detalle).toContain("1 grupos no cierran");
  });

  it("dice cuánto miró, no solo que está bien", () => {
    const c = chequeos({
      grupos: { total: 147, cierra: 147, no_cierra: 0, otra_moneda: 0, sin_payout: 0, sin_detalle: 0 },
      anunciosSinMapear: 0,
      cuentasSinClasificar: 0,
      filasSinConvertir: 0,
      tcRaros: 0,
    });
    expect(c.every((x) => x.ok)).toBe(true);
    expect(c[0].detalle).toContain("147");
  });

  it("avisa que una cuenta sin clasificar deja plata afuera", () => {
    const c = chequeos({
      grupos,
      anunciosSinMapear: 0,
      cuentasSinClasificar: 1,
      filasSinConvertir: 0,
      tcRaros: 0,
    });
    const cuenta = c.find((x) => x.nombre.startsWith("Todas las cuentas"))!;
    expect(cuenta.ok).toBe(false);
    expect(cuenta.detalle).toContain("no suman a percibido");
  });
});

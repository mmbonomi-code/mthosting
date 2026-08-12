import { describe, expect, it } from "vitest";
import {
  acumular,
  deudaPorDepartamento,
  dolares,
  enDolares,
  estaPendienteDeCobro,
  filtrar,
  pesos,
  resultado,
  signo,
  totalPorTipo,
  type FiltrosCaja,
  type Movimiento,
} from "./saldo";

function mov(p: Partial<Movimiento> = {}): Movimiento {
  return {
    id: "m1",
    fecha: "2026-02-04",
    tipo: "egreso",
    monto: 10_000,
    moneda: "ARS",
    tc: 1445,
    descripcion: "TERMOTANQUE",
    categoria_id: "c1",
    categoria_nombre: "ARREGLO",
    depto_id: null,
    depto_codigo: null,
    reembolsable: false,
    fecha_cobro: null,
    forma_cobro: null,
    ...p,
  };
}

describe("signo", () => {
  it("el ingreso suma y el egreso resta; el monto siempre es positivo", () => {
    expect(signo({ tipo: "ingreso", monto: 500 })).toBe(500);
    expect(signo({ tipo: "egreso", monto: 500 })).toBe(-500);
  });
});

describe("acumular", () => {
  it("arranca del saldo anterior y acumula movimiento a movimiento", () => {
    const filas = acumular(
      [
        mov({ id: "a", tipo: "ingreso", monto: 1_716_000 }),
        mov({ id: "b", tipo: "egreso", monto: 367_600 }),
        mov({ id: "c", tipo: "egreso", monto: 30_000 }),
      ],
      0,
    );
    expect(filas.map((f) => f.saldo)).toEqual([1_716_000, 1_348_400, 1_318_400]);
  });

  it("el saldo inicial es lo que había antes del período", () => {
    const filas = acumular([mov({ tipo: "egreso", monto: 1_000 })], 226_417);
    expect(filas[0].saldo).toBe(225_417);
  });

  it("una caja vacía deja el saldo como estaba", () => {
    expect(acumular([], 226_417)).toEqual([]);
  });

  it("el saldo puede quedar negativo y se muestra igual", () => {
    const filas = acumular([mov({ tipo: "egreso", monto: 5_000 })], 1_000);
    expect(filas[0].saldo).toBe(-4_000);
  });

  it("no toca los movimientos originales", () => {
    const original = mov();
    acumular([original], 0);
    expect(original).not.toHaveProperty("saldo");
  });
});

describe("resultado y totales", () => {
  const lista = [
    mov({ tipo: "ingreso", monto: 1_000_000 }),
    mov({ tipo: "egreso", monto: 300_000 }),
    mov({ tipo: "egreso", monto: 200_000 }),
  ];

  it("el resultado del período es ingresos menos egresos", () => {
    expect(resultado(lista)).toBe(500_000);
  });

  it("los totales por tipo suman montos, siempre positivos", () => {
    expect(totalPorTipo(lista, "ingreso")).toBe(1_000_000);
    expect(totalPorTipo(lista, "egreso")).toBe(500_000);
  });
});

describe("enDolares", () => {
  it("divide por la cotización congelada del día", () => {
    // Del archivo real: $1.716.000 a 1445 son US$ 1.187,54.
    expect(enDolares({ monto: 1_716_000, tc: 1445 })).toBe(1187.54);
  });

  it("sin cotización devuelve null, no un número inventado", () => {
    expect(enDolares({ monto: 100_000, tc: null })).toBeNull();
  });

  it("una cotización en cero no divide: es el bug del archivo viejo", () => {
    // En el CSV de Ninox esto daba "Infinity" en 240 filas.
    expect(enDolares({ monto: 100_000, tc: 0 })).toBeNull();
  });
});

describe("reembolsos", () => {
  it("un reembolsable sin fecha de cobro está pendiente", () => {
    expect(estaPendienteDeCobro(mov({ reembolsable: true, depto_id: "d1" }))).toBe(true);
  });

  it("con fecha de cobro deja de estarlo", () => {
    expect(
      estaPendienteDeCobro(
        mov({ reembolsable: true, depto_id: "d1", fecha_cobro: "2026-04-17" }),
      ),
    ).toBe(false);
  });

  it("un gasto que no es reembolsable nunca está pendiente", () => {
    expect(estaPendienteDeCobro(mov({ reembolsable: false }))).toBe(false);
  });
});

describe("deudaPorDepartamento", () => {
  const lista = [
    mov({
      id: "a",
      reembolsable: true,
      depto_id: "d1",
      depto_codigo: "JUNCAL 2",
      monto: 100_000,
      fecha: "2026-03-10",
    }),
    mov({
      id: "b",
      reembolsable: true,
      depto_id: "d1",
      depto_codigo: "JUNCAL 2",
      monto: 50_000,
      fecha: "2026-02-01",
    }),
    mov({
      id: "c",
      reembolsable: true,
      depto_id: "d2",
      depto_codigo: "LAPRIDA 3",
      monto: 900_000,
      fecha: "2026-05-05",
    }),
    // Ya cobrado: no cuenta.
    mov({
      id: "d",
      reembolsable: true,
      depto_id: "d2",
      depto_codigo: "LAPRIDA 3",
      monto: 700_000,
      fecha_cobro: "2026-06-01",
    }),
    // No reembolsable.
    mov({ id: "e", depto_id: "d1", depto_codigo: "JUNCAL 2", monto: 999_999 }),
  ];

  it("agrupa lo pendiente por departamento, del que más debe al que menos", () => {
    expect(deudaPorDepartamento(lista)).toEqual([
      {
        depto_id: "d2",
        depto_codigo: "LAPRIDA 3",
        cantidad: 1,
        total: 900_000,
        desde: "2026-05-05",
      },
      {
        depto_id: "d1",
        depto_codigo: "JUNCAL 2",
        cantidad: 2,
        total: 150_000,
        desde: "2026-02-01",
      },
    ]);
  });

  it("«desde» es el más viejo sin cobrar: es la antigüedad de la deuda", () => {
    expect(deudaPorDepartamento(lista)[1].desde).toBe("2026-02-01");
  });

  it("sin nada pendiente, la lista es vacía", () => {
    expect(deudaPorDepartamento([mov()])).toEqual([]);
  });
});

describe("filtrar", () => {
  const sinFiltros: FiltrosCaja = {
    q: "",
    tipo: null,
    categoria: "",
    depto: "",
    soloPorCobrar: false,
  };
  const lista = [
    mov({ id: "a", tipo: "ingreso", categoria_id: "c9", categoria_nombre: "CAMBIO URVA" }),
    mov({ id: "b", tipo: "egreso", categoria_id: "c1", categoria_nombre: "ARREGLO", depto_id: "d1", depto_codigo: "JUNCAL 2", reembolsable: true }),
    mov({ id: "c", tipo: "egreso", categoria_id: "c2", categoria_nombre: "SUELDO", descripcion: "MAGUI" }),
  ];
  const ids = (f: Partial<FiltrosCaja>) =>
    filtrar(lista, { ...sinFiltros, ...f }).map((m) => m.id);

  it("sin filtros trae todo", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });

  it("filtra por tipo, categoría y departamento", () => {
    expect(ids({ tipo: "ingreso" })).toEqual(["a"]);
    expect(ids({ categoria: "c2" })).toEqual(["c"]);
    expect(ids({ depto: "d1" })).toEqual(["b"]);
  });

  it("«solo por cobrar» deja los reembolsables sin cobrar", () => {
    expect(ids({ soloPorCobrar: true })).toEqual(["b"]);
  });

  it("busca en detalle, categoría y departamento", () => {
    expect(ids({ q: "magui" })).toEqual(["c"]);
    expect(ids({ q: "urva" })).toEqual(["a"]);
    expect(ids({ q: "juncal" })).toEqual(["b"]);
  });

  it("los filtros se combinan", () => {
    expect(ids({ tipo: "egreso", q: "juncal" })).toEqual(["b"]);
    expect(ids({ tipo: "ingreso", q: "juncal" })).toEqual([]);
  });
});

describe("presentación", () => {
  it("los pesos van sin centavos", () => {
    expect(pesos(1_716_000)).toBe("$ 1.716.000");
    expect(pesos(226_417)).toBe("$ 226.417");
  });

  it("un saldo negativo se lee como negativo", () => {
    expect(pesos(-4_000)).toBe("-$ 4.000");
  });

  it("los dólares van con centavos, y sin cotización un guión", () => {
    expect(dolares(1187.54)).toBe("US$ 1.187,54");
    expect(dolares(null)).toBe("—");
  });
});

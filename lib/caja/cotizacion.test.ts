import { describe, expect, it } from "vitest";
import {
  referenciaCercana,
  revisarCotizacion,
  textoDelDesvio,
  type Cotizacion,
} from "./cotizacion";

/** Junio real, recortado: es el mes donde apareció el problema. */
const junio: Cotizacion[] = [
  { fecha: "2026-06-02", tc: 1425 },
  { fecha: "2026-06-04", tc: 1420 },
  { fecha: "2026-06-05", tc: 1420 },
  { fecha: "2026-06-10", tc: 1440 },
  { fecha: "2026-06-11", tc: 1440 },
  { fecha: "2026-06-12", tc: 1450 },
];

describe("referenciaCercana", () => {
  it("sin nada con qué comparar no opina", () => {
    expect(referenciaCercana([], "2026-06-09")).toBeNull();
  });

  it("no se compara consigo misma", () => {
    expect(referenciaCercana([{ fecha: "2026-06-09", tc: 144 }], "2026-06-09")).toBeNull();
  });

  it("toma las más cercanas, antes y después, y saca la mediana", () => {
    const r = referenciaCercana(junio, "2026-06-09");
    // Las cinco más cercanas al 09: 10, 11, 05, 12, 04 → 1420 1420 1440 1440 1450.
    expect(r).toEqual({ tc: 1440, vecinas: 5 });
  });

  it("una vecina mal cargada no arrastra la referencia", () => {
    // El 09 quedó en 144: la mediana de las cinco vecinas del 10 sigue siendo
    // un número sano, y por eso cargar el 10 bien no dispara ningún aviso.
    const conRota = [...junio, { fecha: "2026-06-09", tc: 144 }];
    expect(referenciaCercana(conRota, "2026-06-10")?.tc).toBe(1420);
    expect(revisarCotizacion(1440, "2026-06-10", conRota)).toBeNull();
  });

  it("con pocas vecinas igual opina, y dice cuántas eran", () => {
    expect(referenciaCercana([{ fecha: "2026-06-04", tc: 1420 }], "2026-06-09")).toEqual({
      tc: 1420,
      vecinas: 1,
    });
  });

  it("mira días lejanos si no hay nada cerca: es mejor que no comparar", () => {
    expect(referenciaCercana([{ fecha: "2026-01-15", tc: 1200 }], "2026-06-09")?.tc).toBe(1200);
  });
});

describe("revisarCotizacion", () => {
  it("el caso real: 144 en vez de 1440 se avisa", () => {
    const d = revisarCotizacion(144, "2026-06-09", junio);
    expect(d).not.toBeNull();
    expect(d!.referencia).toBe(1440);
    expect(d!.proporcion).toBeCloseTo(-0.9);
  });

  it("un dígito de más también", () => {
    expect(revisarCotizacion(14400, "2026-06-09", junio)?.proporcion).toBeCloseTo(9);
  });

  it("una cotización normal no molesta a nadie", () => {
    expect(revisarCotizacion(1445, "2026-06-09", junio)).toBeNull();
  });

  it("justo en el límite del 10% todavía pasa", () => {
    expect(revisarCotizacion(1584, "2026-06-09", junio)).toBeNull();
    expect(revisarCotizacion(1296, "2026-06-09", junio)).toBeNull();
  });

  it("pasado el límite avisa, para arriba y para abajo", () => {
    expect(revisarCotizacion(1600, "2026-06-09", junio)).not.toBeNull();
    expect(revisarCotizacion(1280, "2026-06-09", junio)).not.toBeNull();
  });

  it("la primera cotización de la historia no tiene contra qué medirse", () => {
    expect(revisarCotizacion(1440, "2026-06-09", [])).toBeNull();
  });

  it("corregir una cotización se mide contra las vecinas, no contra la vieja", () => {
    // El 09 ya estaba cargado en 144 y se lo corrige a 1440: no debe avisar.
    const conRota = [...junio, { fecha: "2026-06-09", tc: 144 }];
    expect(revisarCotizacion(1440, "2026-06-09", conRota)).toBeNull();
  });
});

describe("textoDelDesvio", () => {
  it("dice el porcentaje, para qué lado y cuál era el valor esperable", () => {
    const d = revisarCotizacion(144, "2026-06-09", junio)!;
    const texto = textoDelDesvio(144, d);
    expect(texto).toContain("90%");
    expect(texto).toContain("abajo");
    expect(texto).toContain("1.440");
  });

  it("un valor alto avisa para arriba", () => {
    const d = revisarCotizacion(14400, "2026-06-09", junio)!;
    expect(textoDelDesvio(14400, d)).toContain("arriba");
  });
});

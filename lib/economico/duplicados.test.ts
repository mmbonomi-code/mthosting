import { describe, expect, it } from "vitest";
import {
  clavePlata,
  detectarRepetidas,
  textoDelAviso,
  type FilaComparable,
} from "./duplicados";

const fila = (f: Partial<FilaComparable>): FilaComparable => ({
  codigo_confirmacion: "HMQBEYXE4W",
  categoria: "reserva",
  fecha: "2026-05-16",
  importe: 80.51,
  anuncio: "Premium depto en Recoleta 09",
  ...f,
});

describe("clavePlata", () => {
  it("una fila sin código no se compara: los payout repiten de verdad", () => {
    expect(clavePlata(fila({ codigo_confirmacion: null }))).toBeNull();
    expect(clavePlata(fila({ codigo_confirmacion: "   " }))).toBeNull();
  });

  it("el nombre del anuncio no entra en la clave", () => {
    const a = clavePlata(fila({ anuncio: "Premium depto en Recoleta 09" }));
    const b = clavePlata(fila({ anuncio: "Premium depto. en Recoleta 09" }));
    expect(a).toBe(b);
  });

  it("distinto importe es otra plata", () => {
    expect(clavePlata(fila({ importe: 80.51 }))).not.toBe(clavePlata(fila({ importe: 90 })));
  });
});

describe("detectarRepetidas", () => {
  it("encuentra la misma plata cargada con otro nombre de anuncio", () => {
    const vieja = fila({ anuncio: "Premium depto en Recoleta 09" });
    const nueva = fila({ anuncio: "Premium depto. en Recoleta 09" });
    const r = detectarRepetidas([nueva], [vieja]);
    expect(r).toHaveLength(1);
    expect(r[0].codigo).toBe("HMQBEYXE4W");
    expect(r[0].anuncios).toEqual([
      "Premium depto en Recoleta 09",
      "Premium depto. en Recoleta 09",
    ]);
  });

  it("no avisa de lo que es distinto", () => {
    const vieja = fila({ fecha: "2026-05-16" });
    const nueva = fila({ fecha: "2026-06-16" });
    expect(detectarRepetidas([nueva], [vieja])).toEqual([]);
  });

  it("la misma reserva cobrada en cuotas no es un duplicado", () => {
    // Estadía larga: mismo código, fechas distintas, importes distintos.
    const previas = [
      fila({ fecha: "2026-05-16", importe: 611.88 }),
      fila({ fecha: "2026-06-16", importe: 611.88 }),
    ];
    const nueva = fila({ fecha: "2026-07-16", importe: 611.88 });
    expect(detectarRepetidas([nueva], previas)).toEqual([]);
  });

  it("la reserva y su línea de coanfitrión son dos filas distintas", () => {
    const reserva = fila({ categoria: "reserva", importe: 80.51 });
    const coanfitrion = fila({ categoria: "coanfitrion", importe: -29.7 });
    expect(detectarRepetidas([coanfitrion], [reserva])).toEqual([]);
  });

  it("los payout no se comparan: dos iguales el mismo día existen", () => {
    const payout = fila({ codigo_confirmacion: null, categoria: "payout", anuncio: null });
    expect(detectarRepetidas([payout], [payout])).toEqual([]);
  });

  it("una fila repetida dos veces se informa una sola vez", () => {
    const vieja = fila({});
    const nueva = fila({ anuncio: "otro nombre" });
    expect(detectarRepetidas([nueva, nueva], [vieja])).toHaveLength(1);
  });
});

describe("textoDelAviso", () => {
  it("sin repetidas no dice nada", () => {
    expect(textoDelAviso([])).toBeNull();
  });

  it("cuenta las filas y nombra el cambio de anuncio cuando lo hay", () => {
    const r = detectarRepetidas(
      [fila({ anuncio: "Premium depto. en Recoleta 09" })],
      [fila({ anuncio: "Premium depto en Recoleta 09" })],
    );
    const texto = textoDelAviso(r)!;
    expect(texto).toContain("1 fila repite");
    expect(texto).toContain("HMQBEYXE4W");
    expect(texto).toContain("cambió el nombre del anuncio");
  });

  it("si el anuncio es el mismo, no inventa esa explicación", () => {
    const r = detectarRepetidas([fila({})], [fila({})]);
    const texto = textoDelAviso(r)!;
    expect(texto).not.toContain("cambió el nombre del anuncio");
  });
});

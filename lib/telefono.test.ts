import { describe, expect, it } from "vitest";
import { agregarNueveAR, corregirContactoAR, faltaNueveAR, soloDigitos } from "./telefono";

describe("soloDigitos", () => {
  it("descarta todo lo que no sea número", () => {
    expect(soloDigitos("+54 11 4428-2700")).toBe("541144282700");
  });

  it("un contacto vacío o sin dígitos es null", () => {
    expect(soloDigitos(null)).toBeNull();
    expect(soloDigitos("sin teléfono")).toBeNull();
  });
});

describe("agregarNueveAR", () => {
  it("agrega el 9 a un argentino de 12 dígitos", () => {
    expect(agregarNueveAR("541144282700")).toBe("5491144282700");
    expect(agregarNueveAR("543512139073")).toBe("5493512139073");
  });

  it("no lo duplica si ya lo tiene", () => {
    expect(agregarNueveAR("5491144282700")).toBe("5491144282700");
  });

  it("no toca los de otros países", () => {
    expect(agregarNueveAR("553899409246")).toBe("553899409246");
    expect(agregarNueveAR("59899362008")).toBe("59899362008");
  });

  it("no toca un +54 con una cantidad de dígitos que no reconoce", () => {
    // Un argentino siempre tiene 10 dígitos nacionales. Si no cierra, se deja
    // como está: preferimos un número intacto a uno mal arreglado.
    expect(agregarNueveAR("5411442827")).toBe("5411442827");
    expect(agregarNueveAR("54114428270012")).toBe("54114428270012");
  });

  it("aplicarlo dos veces da lo mismo", () => {
    expect(agregarNueveAR(agregarNueveAR("541144282700"))).toBe("5491144282700");
  });
});

describe("faltaNueveAR", () => {
  it("ningún código de área argentino empieza con 9, así que 549 ya está bien", () => {
    expect(faltaNueveAR("549" + "1144282700".slice(0, 10))).toBe(false);
  });
});

describe("corregirContactoAR", () => {
  it("conserva el formato legible", () => {
    expect(corregirContactoAR("+54 11 4428-2700")).toBe("+54 9 11 4428-2700");
    expect(corregirContactoAR("+54 351 213-9073")).toBe("+54 9 351 213-9073");
  });

  it("funciona sin el signo +", () => {
    expect(corregirContactoAR("54 2954 61-2442")).toBe("54 9 2954 61-2442");
  });

  it("deja intacto lo que ya está bien y lo extranjero", () => {
    expect(corregirContactoAR("+54 9 11 4428-2700")).toBe("+54 9 11 4428-2700");
    expect(corregirContactoAR("+55 38 99940-9246")).toBe("+55 38 99940-9246");
  });

  it("no rompe un contacto vacío", () => {
    expect(corregirContactoAR(null)).toBeNull();
    expect(corregirContactoAR("")).toBe("");
  });
});

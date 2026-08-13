import { afterEach, describe, expect, it } from "vitest";
import { codigoConfigurado, codigoEsCorrecto } from "./codigo";

const original = process.env.CAJA_CODIGO;

afterEach(() => {
  if (original === undefined) delete process.env.CAJA_CODIGO;
  else process.env.CAJA_CODIGO = original;
});

describe("codigoConfigurado", () => {
  it("sin la variable cargada, la caja no pide nada", () => {
    delete process.env.CAJA_CODIGO;
    expect(codigoConfigurado()).toBe(false);
  });

  it("una variable vacía o con espacios es como no tenerla", () => {
    process.env.CAJA_CODIGO = "";
    expect(codigoConfigurado()).toBe(false);
    process.env.CAJA_CODIGO = "   ";
    expect(codigoConfigurado()).toBe(false);
  });

  it("con la variable cargada, pide el código", () => {
    process.env.CAJA_CODIGO = "1324";
    expect(codigoConfigurado()).toBe(true);
  });
});

describe("codigoEsCorrecto", () => {
  it("acepta el código exacto", () => {
    process.env.CAJA_CODIGO = "1324";
    expect(codigoEsCorrecto("1324")).toBe(true);
  });

  it("tolera los espacios de sobra al escribirlo", () => {
    process.env.CAJA_CODIGO = "1324";
    expect(codigoEsCorrecto(" 1324 ")).toBe(true);
  });

  it("rechaza cualquier otro", () => {
    process.env.CAJA_CODIGO = "1324";
    expect(codigoEsCorrecto("1234")).toBe(false);
    expect(codigoEsCorrecto("132")).toBe(false);
    expect(codigoEsCorrecto("")).toBe(false);
  });

  it("sin variable cargada no acepta NADA, ni siquiera el vacío", () => {
    // La puerta se abre por `codigoConfigurado`, no por acertarle a un vacío.
    delete process.env.CAJA_CODIGO;
    expect(codigoEsCorrecto("")).toBe(false);
    expect(codigoEsCorrecto("1324")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { convieneComprimido, dimensionesDestino, nombreJpg, MAX_LADO } from "./comprimir";

describe("dimensionesDestino", () => {
  it("achica una foto apaisada al lado más largo", () => {
    // 4032x3024 es lo que sale de la cámara de un teléfono común.
    expect(dimensionesDestino(4032, 3024)).toEqual({ ancho: 1200, alto: 900 });
  });

  it("achica una foto vertical por el alto, que es su lado más largo", () => {
    expect(dimensionesDestino(3024, 4032)).toEqual({ ancho: 900, alto: 1200 });
  });

  it("NO agranda una foto que ya es chica", () => {
    // Agrandar suma peso sin sumar información.
    expect(dimensionesDestino(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });

  it("deja igual la que mide justo el máximo", () => {
    expect(dimensionesDestino(MAX_LADO, 400)).toEqual({ ancho: MAX_LADO, alto: 400 });
  });

  it("mantiene la proporción", () => {
    const { ancho, alto } = dimensionesDestino(3000, 2000);
    expect(ancho / alto).toBeCloseTo(3000 / 2000, 2);
  });

  it("una foto muy alargada no colapsa a cero", () => {
    const { ancho, alto } = dimensionesDestino(6000, 10);
    expect(ancho).toBe(1200);
    expect(alto).toBeGreaterThanOrEqual(1);
  });

  it("no rompe con dimensiones en cero", () => {
    expect(dimensionesDestino(0, 0)).toEqual({ ancho: 0, alto: 0 });
  });
});

describe("nombreJpg", () => {
  it("cambia la extensión del iPhone por jpg", () => {
    expect(nombreJpg("IMG_0123.HEIC")).toBe("IMG_0123.jpg");
  });

  it("un nombre sin extensión igual sale con jpg", () => {
    expect(nombreJpg("foto")).toBe("foto.jpg");
  });

  it("respeta los puntos que son parte del nombre", () => {
    expect(nombreJpg("depto.3.b.png")).toBe("depto.3.b.jpg");
  });
});

describe("convieneComprimido", () => {
  it("conviene si pesa menos", () => {
    expect(convieneComprimido(4_000_000, 180_000)).toBe(true);
  });

  it("no conviene si el comprimido pesa igual o más", () => {
    // Pasa de verdad con PNG chicos o fotos ya optimizadas.
    expect(convieneComprimido(50_000, 80_000)).toBe(false);
    expect(convieneComprimido(50_000, 50_000)).toBe(false);
  });

  it("un comprimido vacío no sirve", () => {
    expect(convieneComprimido(4_000_000, 0)).toBe(false);
  });
});

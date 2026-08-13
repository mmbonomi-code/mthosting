import { describe, expect, it } from "vitest";
import { armarMapa } from "./mapeo";

describe("armarMapa", () => {
  it("resuelve por coincidencia exacta", () => {
    const { resolver } = armarMapa([
      { nombre_listing: "Único en el centro de Palermo!", depto_id: "kennedy" },
    ]);
    expect(resolver("Único en el centro de Palermo!")).toBe("kennedy");
  });

  it("resuelve el mismo anuncio con los acentos rotos", () => {
    // El export de reservas los trae limpios y el de ganancias, roto. Es el
    // mismo departamento y no puede caer en la bandeja por eso.
    const { resolver } = armarMapa([
      { nombre_listing: "Único en el centro de Palermo!", depto_id: "kennedy" },
    ]);
    expect(resolver("Ãšnico en el centro de Palermo!")).toBe("kennedy");
  });

  it("no se traba con mayúsculas ni espacios de más", () => {
    const { resolver } = armarMapa([
      { nombre_listing: "Amplio y cómodo departamento", depto_id: "araoz" },
    ]);
    expect(resolver("AMPLIO  Y  COMODO DEPARTAMENTO")).toBe("araoz");
  });

  it("varios anuncios pueden apuntar al mismo departamento", () => {
    // Renombres, anuncios ocultos y variantes: es N a 1.
    const { resolver } = armarMapa([
      { nombre_listing: "Amplio y cómodo departamento", depto_id: "araoz" },
      { nombre_listing: "Espacio cómodo y tranquilo (oculto)", depto_id: "araoz" },
      { nombre_listing: "Amplio y cómodo departamento (oculto)", depto_id: "araoz" },
    ]);
    expect(resolver("Espacio cómodo y tranquilo (oculto)")).toBe("araoz");
    expect(resolver("Amplio y cómodo departamento (oculto)")).toBe("araoz");
  });

  it("un anuncio desconocido no se inventa un departamento", () => {
    const { resolver } = armarMapa([
      { nombre_listing: "Único en el centro de Palermo!", depto_id: "kennedy" },
    ]);
    expect(resolver("Un anuncio que nadie cargó")).toBeNull();
    expect(resolver(null)).toBeNull();
    expect(resolver("")).toBeNull();
  });

  it("ante dos anuncios que se parecen y no son el mismo depto, exige exactitud", () => {
    // Imputarle la plata al departamento equivocado es peor que dejarla en la
    // bandeja: en la bandeja se ve, mal imputada no se ve nunca.
    const { resolver, ambiguos } = armarMapa([
      { nombre_listing: "Depto en Recoleta", depto_id: "uno" },
      { nombre_listing: "DEPTO EN RECOLETA", depto_id: "dos" },
    ]);
    expect(ambiguos).toHaveLength(1);
    expect(resolver("Depto en Recoleta")).toBe("uno");
    expect(resolver("DEPTO EN RECOLETA")).toBe("dos");
    expect(resolver("depto  en  recoleta")).toBeNull();
  });
});

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { celdaATexto, leerHojaXlsx } from "./xlsx";

describe("celdaATexto", () => {
  it("un teléfono que Excel guardó como número sale entero, sin notación científica", () => {
    expect(celdaATexto(5491155551234)).toBe("5491155551234");
  });

  it("un link sale con su texto", () => {
    expect(celdaATexto({ text: "Abrir en Airbnb", hyperlink: "https://airbnb.com" })).toBe("Abrir en Airbnb");
  });

  it("texto con formato sale como texto plano", () => {
    expect(celdaATexto({ richText: [{ text: "Sabina " }, { text: "Blanco" }] })).toBe("Sabina Blanco");
  });

  it("una fórmula sale con su resultado", () => {
    expect(celdaATexto({ formula: "1+1", result: 2 })).toBe("2");
  });

  it("vacío es texto vacío", () => {
    expect(celdaATexto(null)).toBe("");
  });
});

describe("leerHojaXlsx", () => {
  it("lee la primera hoja como filas de texto", async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Tentativas");
    hoja.addRow(["Código", "Teléfono", "Adultos"]);
    hoja.addRow(["HMZK28S3CA", 5491155551234, 2]);
    const bytes = await libro.xlsx.writeBuffer();

    expect(await leerHojaXlsx(bytes as ArrayBuffer)).toEqual([
      ["Código", "Teléfono", "Adultos"],
      ["HMZK28S3CA", "5491155551234", "2"],
    ]);
  });

  it("un archivo que no es Excel se rechaza con un mensaje claro", async () => {
    await expect(leerHojaXlsx(new TextEncoder().encode("a,b,c").buffer as ArrayBuffer)).rejects.toThrow(
      "no es un Excel",
    );
  });
});

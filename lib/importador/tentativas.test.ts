import { describe, expect, it } from "vitest";
import { ENCABEZADOS_TENTATIVAS } from "../exportar/tentativas";
import { ErrorImportacion } from "./parser";
import {
  decidirFilaExcel,
  leerExcelTentativas,
  normalizarContactoExcel,
  type FilaExcel,
  type ReservaParaExcel,
} from "./tentativas";

/** Una fila del Excel tal como la exporta el sistema, con lo editable a mano. */
function filaCruda(editable: Partial<Record<(typeof ENCABEZADOS_TENTATIVAS)[number], string>> = {}): string[] {
  const base: Record<string, string> = {
    Código: "HMZK28S3CA",
    "Link Airbnb": "Abrir en Airbnb",
    Departamento: "CABELLO 2",
    "Check-in": "03/10/2026",
    "Check-out": "06/10/2026",
    Noches: "3",
    Cuándo: "Futura",
    "Últimos 4 del teléfono": "0137",
    "Aviso del calendario": "",
    "Estado en Airbnb": "",
    "Nombre del huésped": "",
    Teléfono: "",
    Adultos: "",
    Niños: "",
    Bebés: "",
    ...editable,
  };
  return ENCABEZADOS_TENTATIVAS.map((e) => base[e]);
}

function leer(...filas: string[][]) {
  return leerExcelTentativas([[...ENCABEZADOS_TENTATIVAS], ...filas]);
}

function errorDe(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorImportacion);
    return (e as Error).message;
  }
  throw new Error("se esperaba un error");
}

describe("leerExcelTentativas", () => {
  it("lee lo editable y deja lo vacío en null", () => {
    const [fila] = leer(filaCruda({ "Estado en Airbnb": "Confirmada", "Nombre del huésped": " Sabina ", Adultos: "2" }));
    expect(fila).toEqual({
      fila: 2,
      codigo: "HMZK28S3CA",
      estado: "confirmada",
      huesped_nombre: "Sabina",
      huesped_contacto: null,
      adultos: 2,
      ninos: null,
      bebes: null,
    });
  });

  it("el estado no distingue mayúsculas", () => {
    expect(leer(filaCruda({ "Estado en Airbnb": "CANCELADA" }))[0].estado).toBe("cancelada");
  });

  it("ignora las filas vacías que deja Excel al final", () => {
    expect(leer(filaCruda(), ENCABEZADOS_TENTATIVAS.map(() => ""), [])).toHaveLength(1);
  });

  it("encuentra las columnas por nombre, aunque estén en otro orden", () => {
    const encabezados = [...ENCABEZADOS_TENTATIVAS].reverse();
    const fila = [...filaCruda({ Niños: "1" })].reverse();
    expect(leerExcelTentativas([encabezados, fila])[0].ninos).toBe(1);
  });

  it("un archivo que no es este Excel no se lee", () => {
    const mensaje = errorDe(() => leerExcelTentativas([["Código de confirmación", "Estado"], ["HM1", "x"]]));
    expect(mensaje).toContain("no es el Excel de tentativas");
  });

  it("junta TODOS los errores, con la fila de cada uno", () => {
    const mensaje = errorDe(() =>
      leer(
        filaCruda({ Código: "hola" }),
        filaCruda({ Código: "HMAAAAAAA1", "Estado en Airbnb": "Tal vez" }),
        filaCruda({ Código: "HMAAAAAAA2", Adultos: "dos" }),
        filaCruda({ Código: "HMAAAAAAA3", Niños: "-1" }),
      ),
    );
    expect(mensaje).toContain("Fila 2");
    expect(mensaje).toContain("Fila 3 (HMAAAAAAA1)");
    expect(mensaje).toContain("Fila 4 (HMAAAAAAA2)");
    expect(mensaje).toContain("Fila 5 (HMAAAAAAA3)");
  });

  it("un código repetido es un error: no se sabe cuál fila vale", () => {
    expect(errorDe(() => leer(filaCruda(), filaCruda()))).toContain("ya aparece en la fila 2");
  });

  it("una fila con datos pero sin código es un error", () => {
    expect(errorDe(() => leer(filaCruda({ Código: "", "Nombre del huésped": "Ana" })))).toContain("Fila 2");
  });
});

describe("normalizarContactoExcel", () => {
  it("deja un teléfono con formato como está", () => {
    expect(normalizarContactoExcel("+598 99 362 008")).toBe("+598 99 362 008");
  });

  it("le agrega el 9 a un argentino que no lo tiene", () => {
    expect(normalizarContactoExcel("+54 11 4428-2700")).toBe("+54 9 11 4428-2700");
  });

  it("un número que Excel dejó sin el + lo recupera", () => {
    expect(normalizarContactoExcel("5491155551234")).toBe("+5491155551234");
  });
});

function reserva(parcial: Partial<ReservaParaExcel> = {}): ReservaParaExcel {
  return {
    id: "r1",
    codigo_reserva: "HMZK28S3CA",
    cancelada: false,
    descartada: false,
    datos_completos: false,
    huesped_nombre: null,
    huesped_contacto: null,
    adultos: null,
    ninos: null,
    bebes: null,
    ...parcial,
  };
}

function fila(parcial: Partial<FilaExcel> = {}): FilaExcel {
  return {
    fila: 2,
    codigo: "HMZK28S3CA",
    estado: null,
    huesped_nombre: null,
    huesped_contacto: null,
    adultos: null,
    ninos: null,
    bebes: null,
    ...parcial,
  };
}

describe("decidirFilaExcel: datos", () => {
  it("completa los datos y, con teléfono, deja de ser tentativa", () => {
    const d = decidirFilaExcel(
      fila({ huesped_nombre: "Sabina", huesped_contacto: "+54 9 11 5555-1234", adultos: 2 }),
      reserva(),
      undefined,
    );
    expect(d.cambios).toEqual({
      huesped_nombre: "Sabina",
      huesped_contacto: "+54 9 11 5555-1234",
      adultos: 2,
      datos_completos: true,
    });
    expect(d.accion).toBeNull();
  });

  it("sin teléfono sigue siendo tentativa", () => {
    expect(decidirFilaExcel(fila({ huesped_nombre: "Sabina" }), reserva(), undefined).cambios).toEqual({
      huesped_nombre: "Sabina",
    });
  });

  it("manda el Excel: un dato distinto reemplaza al guardado", () => {
    const d = decidirFilaExcel(
      fila({ huesped_nombre: "Sabina Blanco" }),
      reserva({ huesped_nombre: "Sabina", datos_completos: true, huesped_contacto: "+1 555" }),
      undefined,
    );
    expect(d.cambios).toEqual({ huesped_nombre: "Sabina Blanco" });
  });

  it("una celda vacía nunca borra lo que había", () => {
    const d = decidirFilaExcel(fila(), reserva({ huesped_nombre: "Sabina", adultos: 2 }), undefined);
    expect(d.cambios).toEqual({});
  });

  it("subir el mismo archivo otra vez no cambia nada (idempotencia)", () => {
    const f = fila({ huesped_nombre: "Sabina", huesped_contacto: "+54 9 11 5555-1234", ninos: 0 });
    const ya = reserva({ huesped_nombre: "Sabina", huesped_contacto: "+54 9 11 5555-1234", ninos: 0, datos_completos: true });
    expect(decidirFilaExcel(f, ya, undefined)).toMatchObject({ cambios: {}, accion: null, aviso: null });
  });

  it("un cero es un dato, no un vacío", () => {
    expect(decidirFilaExcel(fila({ bebes: 0 }), reserva(), undefined).cambios).toEqual({ bebes: 0 });
  });
});

describe("decidirFilaExcel: estado", () => {
  const marcaCalendario = { id: "m1", origen: "calendario" as const };
  const marcaExcel = { id: "m2", origen: "excel" as const };

  it("Cancelada y el calendario ya la marcó: se cancela", () => {
    const d = decidirFilaExcel(fila({ estado: "cancelada" }), reserva(), marcaCalendario);
    expect(d.accion).toEqual({ tipo: "cancelar", marca_id: "m1" });
  });

  it("Cancelada pero el calendario todavía la muestra: va a Alertas, no se cancela", () => {
    const d = decidirFilaExcel(fila({ estado: "cancelada" }), reserva(), undefined);
    expect(d.accion).toEqual({ tipo: "marcar_cancelacion" });
  });

  it("Cancelada con una marca que ya pidió el Excel: no hace nada de nuevo", () => {
    expect(decidirFilaExcel(fila({ estado: "cancelada" }), reserva(), marcaExcel).accion).toBeNull();
  });

  it("en una fila Cancelada no se tocan nombre ni contacto (Airbnb los recorta)", () => {
    const d = decidirFilaExcel(
      fila({ estado: "cancelada", huesped_nombre: "Sabina", huesped_contacto: "+1 555", adultos: 2 }),
      reserva({ huesped_nombre: "Sabina Blanco Vecchi" }),
      marcaCalendario,
    );
    expect(d.cambios).toEqual({ adultos: 2 });
  });

  it("Confirmada en una marcada ¿Cancelada? es 'Sigue en pie'", () => {
    expect(decidirFilaExcel(fila({ estado: "confirmada" }), reserva(), marcaCalendario).accion).toEqual({
      tipo: "sigue_en_pie",
      marca_id: "m1",
    });
    expect(decidirFilaExcel(fila({ estado: "confirmada" }), reserva(), marcaExcel).accion).toEqual({
      tipo: "sigue_en_pie",
      marca_id: "m2",
    });
  });

  it("Confirmada sin marca no hace nada", () => {
    expect(decidirFilaExcel(fila({ estado: "confirmada" }), reserva(), undefined).accion).toBeNull();
  });

  it("estado vacío no toca el estado", () => {
    expect(decidirFilaExcel(fila(), reserva(), marcaCalendario).accion).toBeNull();
  });
});

describe("decidirFilaExcel: lo que se saltea", () => {
  it("un código que no existe se avisa", () => {
    const d = decidirFilaExcel(fila({ huesped_nombre: "Ana" }), undefined, undefined);
    expect(d).toMatchObject({ reserva_id: null, cambios: {}, accion: null });
    expect(d.aviso).toContain("no existe");
  });

  it("una fila sin nada completado de un código inexistente no molesta", () => {
    expect(decidirFilaExcel(fila(), undefined, undefined).aviso).toBeNull();
  });

  it("una reserva ya cancelada no se toca, y avisa si se le quiso cargar algo", () => {
    const d = decidirFilaExcel(fila({ estado: "confirmada" }), reserva({ cancelada: true }), undefined);
    expect(d).toMatchObject({ cambios: {}, accion: null });
    expect(d.aviso).toContain("ya está cancelada");
  });

  it("volver a decir Cancelada de una ya cancelada no avisa: ya está", () => {
    expect(decidirFilaExcel(fila({ estado: "cancelada" }), reserva({ cancelada: true }), undefined).aviso).toBeNull();
  });

  it("una descartada no se toca", () => {
    const d = decidirFilaExcel(fila({ huesped_nombre: "Ana" }), reserva({ descartada: true }), undefined);
    expect(d).toMatchObject({ cambios: {}, accion: null });
    expect(d.aviso).toContain("descartada");
  });
});

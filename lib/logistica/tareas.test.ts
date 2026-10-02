import { describe, expect, it } from "vitest";
import {
  diaProximaEntrada,
  esLlegadaConCandado,
  estadoTrasMarcar,
  rolPuedeVerLogistica,
  tareasEquipamiento,
} from "./tareas";

describe("quién ve logística", () => {
  it("logística y el back office que la cubre", () => {
    for (const rol of ["logistica", "admin", "manager", "coordinador"]) {
      expect(rolPuedeVerLogistica(rol), rol).toBe(true);
    }
  });

  it("limpieza, gobernanta y propietario no", () => {
    for (const rol of ["limpieza", "gobernanta", "propietario"]) {
      expect(rolPuedeVerLogistica(rol), rol).toBe(false);
    }
    expect(rolPuedeVerLogistica(null)).toBe(false);
  });
});

describe("llegadas con candado", () => {
  const reserva = { cancelada: false, descartada: false };

  it("una llegada con candado le toca a logística", () => {
    expect(esLlegadaConCandado({ tipo: "checkin", punto: { metodo: "candado" }, reserva })).toBe(true);
  });

  it("presencial, sobre o self no", () => {
    for (const metodo of ["presencial", "sobre", "self", "llaves", "valijas"]) {
      expect(esLlegadaConCandado({ tipo: "checkin", punto: { metodo }, reserva }), metodo).toBe(false);
    }
    expect(esLlegadaConCandado({ tipo: "checkin", punto: null, reserva })).toBe(false);
  });

  it("una salida no, aunque devuelva la llave en un candado", () => {
    expect(esLlegadaConCandado({ tipo: "checkout", punto: { metodo: "candado" }, reserva })).toBe(false);
  });

  it("una reserva cancelada o descartada no: no va a llegar nadie", () => {
    const punto = { metodo: "candado" };
    expect(esLlegadaConCandado({ tipo: "checkin", punto, reserva: { cancelada: true, descartada: false } })).toBe(false);
    expect(esLlegadaConCandado({ tipo: "checkin", punto, reserva: { cancelada: false, descartada: true } })).toBe(false);
  });
});

describe("día de la próxima entrada", () => {
  it("otro día: el día, sin la hora guardada, que no es confiable", () => {
    expect(diaProximaEntrada("2026-10-05T00:00:00", "2026-10-02")).toBe("05/10");
    expect(diaProximaEntrada("2026-10-05 14:00:00", "2026-10-02")).toBe("05/10");
  });

  it("el mismo día no: eso ya lo dice el horario de entrada", () => {
    expect(diaProximaEntrada("2026-10-02T00:00:00", "2026-10-02")).toBeNull();
  });

  it("sin próxima entrada, nada", () => {
    expect(diaProximaEntrada(null, "2026-10-02")).toBeNull();
  });
});

describe("cunas y sillas", () => {
  const dia = "2026-10-02";

  it("el día que empieza hay que llevarla", () => {
    expect(tareasEquipamiento({ estado: "pedido", fecha_desde: dia, fecha_hasta: "2026-10-06" }, dia)).toEqual([
      { accion: "llevar", hecha: false, bloqueada: false },
    ]);
  });

  it("ya entregada sigue apareciendo, como hecha", () => {
    expect(tareasEquipamiento({ estado: "entregado", fecha_desde: dia, fecha_hasta: "2026-10-06" }, dia)).toEqual([
      { accion: "llevar", hecha: true, bloqueada: false },
    ]);
  });

  it("el día que termina hay que retirarla; retirada sigue apareciendo", () => {
    expect(tareasEquipamiento({ estado: "entregado", fecha_desde: "2026-09-28", fecha_hasta: dia }, dia)).toEqual([
      { accion: "retirar", hecha: false, bloqueada: false },
    ]);
    expect(tareasEquipamiento({ estado: "retirado", fecha_desde: "2026-09-28", fecha_hasta: dia }, dia)).toEqual([
      { accion: "retirar", hecha: true, bloqueada: false },
    ]);
  });

  it("los días del medio no piden nada", () => {
    expect(tareasEquipamiento({ estado: "entregado", fecha_desde: "2026-09-28", fecha_hasta: "2026-10-06" }, dia)).toEqual([]);
  });

  it("en un pedido de un día, no se retira lo que no se llevó", () => {
    expect(tareasEquipamiento({ estado: "pedido", fecha_desde: dia, fecha_hasta: dia }, dia)).toEqual([
      { accion: "llevar", hecha: false, bloqueada: false },
      { accion: "retirar", hecha: false, bloqueada: true },
    ]);
  });

  it("marcar y deshacer llevan al estado correcto", () => {
    expect(estadoTrasMarcar("llevar", true)).toBe("entregado");
    expect(estadoTrasMarcar("llevar", false)).toBe("pedido");
    expect(estadoTrasMarcar("retirar", true)).toBe("retirado");
    expect(estadoTrasMarcar("retirar", false)).toBe("entregado");
  });
});

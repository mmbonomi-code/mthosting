"use client";

import { useRef, useState, useTransition } from "react";
import SelectorHora from "@/app/componentes/SelectorHora";
import { ventanaInsuficiente } from "@/lib/eventos/reglas";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";

export type OpcionAcceso = {
  valor: string;
  etiqueta: string;
  grupo: "Sin persona" | "Personas";
  metodo?: string;
  instrucciones?: string | null;
};

type Tilde = {
  clave: string;
  etiqueta: string;
  detalle?: string;
  activo: boolean;
  accion: (valor: boolean) => Promise<{ error: string } | null>;
  /** Aviso que aparece al tildarlo, cuando hay un conflicto conocido. */
  avisoAlActivar?: string | null;
};

/**
 * Todo lo que se coordina, en un solo lugar y arriba de todo: no hace falta
 * apretar "guardar". Cada cambio se guarda solo, porque en la calle nadie
 * se acuerda de confirmar y la información se perdería.
 */
export default function PanelCoordinacion({
  guardar,
  opciones,
  valores,
  tildes,
  faltantes,
  avisoSelf,
  requiereConfirmacionSelf,
  horaLimiteCheckout,
  horaMinimaCheckin,
  esCheckout,
  horaSalidaMismoDia,
}: {
  guardar: (fd: FormData) => Promise<{ error: string } | { aviso: string } | null>;
  opciones: OpcionAcceso[];
  valores: {
    acceso: string;
    fecha_coordinada: string;
    hora_coordinada: string;
    observaciones: string;
    fechaReserva: string;
  };
  tildes: Tilde[];
  faltantes: string[];
  avisoSelf: string | null;
  /** Solo el caso riesgoso pide tildar "confirmo igual". */
  requiereConfirmacionSelf: boolean;
  horaLimiteCheckout: string;
  horaMinimaCheckin: string;
  esCheckout: boolean;
  /** Si ese mismo día sale otro huésped del depto, a qué hora. */
  horaSalidaMismoDia: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const [acceso, setAcceso] = useState(valores.acceso);
  const [fecha, setFecha] = useState(valores.fecha_coordinada || valores.fechaReserva);
  const [hora, setHora] = useState(valores.hora_coordinada);

  const guardarAhora = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    iniciar(async () => {
      const resultado = await guardar(fd);
      if (resultado && "error" in resultado) {
        setError(resultado.error);
        setGuardado(false);
      } else {
        setError(null);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2000);
      }
    });
  };

  const sinPersona = opciones.filter((o) => o.grupo === "Sin persona");
  const personas = opciones.filter((o) => o.grupo === "Personas");
  const elegida = opciones.find((o) => o.valor === acceso);
  const esSelf = elegida?.metodo === "self";
  // Llegar temprano solo a dejar las valijas no ocupa el departamento: la
  // limpieza avanza igual, así que no se avisa por los tiempos (§2.8.quater).
  const esValijas = elegida?.metodo === "valijas";
  const fechaDistinta = fecha !== "" && fecha !== valores.fechaReserva;
  // Un check-out tarde deja sin tiempo para limpiar.
  const salidaTarde = esCheckout && hora !== "" && hora > horaLimiteCheckout.slice(0, 5);

  // Entrada el mismo día que sale otro: se avisa en el momento de elegir la
  // hora, no después de guardar.
  const sinTiempo =
    !esCheckout &&
    hora !== "" &&
    horaSalidaMismoDia !== null &&
    ventanaInsuficiente({
      // Las dos son del mismo día por construcción: el nombre de la prop lo
      // dice (`horaSalidaMismoDia`). `ventanaInsuficiente` exige la fecha
      // para no confundir un check-out de otro día con el de hoy; acá alcanza
      // con repetir "hoy" en las dos puntas.
      fechaSalida: fecha,
      horaSalida: horaSalidaMismoDia,
      fechaEntrada: fecha,
      horaEntrada: hora,
      horaLimiteCheckout,
      horaMinimaCheckin,
      entradaSoloValijas: esValijas,
    });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-borde-control bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium text-tinta">Coordinación</h2>
        <span className="text-xs text-tinta-etiqueta">
          {guardando ? "Guardando…" : guardado ? "✓ Guardado" : "Se guarda solo"}
        </span>
      </div>

      {sinTiempo && (
        <p className="rounded-lg bg-error-soft px-3 py-2.5 text-sm text-error-text-fuerte">
          <strong>No dan los tiempos:</strong> ese día sale otro huésped a las{" "}
          {horaSalidaMismoDia?.slice(0, 5)} y no queda margen para limpiar antes
          de esta llegada. Hay que negociar el horario con alguno de los dos.
        </p>
      )}

      {/* Qué falta, arriba de todo: es lo primero que hay que ver */}
      {faltantes.length === 0 ? (
        <p className="rounded-lg bg-exito-soft/60 px-3 py-2.5 text-sm font-medium text-exito-text-fuerte">
          ✓ Coordinado: no falta nada.
        </p>
      ) : (
        <p className="rounded-lg bg-aviso-soft/40 px-3 py-2.5 text-sm text-aviso-text-fuerte">
          <span className="font-medium">Falta:</span> {faltantes.join(" · ")}
        </p>
      )}

      <form ref={formRef} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Acceso</span>
          <select
            name="acceso"
            value={acceso}
            onChange={(e) => {
              setAcceso(e.target.value);
              queueMicrotask(guardarAhora);
            }}
            className={clsEntrada}
          >
            <option value="">— Sin definir —</option>
            {sinPersona.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
            {/* Solo aparece si esta coordinación traía una persona suelta de
                antes de que todo pasara al catálogo de accesos. */}
            {personas.length > 0 && (
              <optgroup label="Cargado antes">
                {personas.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {elegida?.instrucciones && (
          <p className="whitespace-pre-wrap rounded-lg bg-fondo/60 px-3 py-2 text-sm text-tinta-suave">
            {elegida.instrucciones}
          </p>
        )}

        {/* Con el self permitido, el texto es solo la instrucción que se le
            pasa al huésped. La confirmación se pide únicamente en el caso
            riesgoso: una sola persona donde hacen falta dos. */}
        {esSelf && avisoSelf && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              requiereConfirmacionSelf
                ? "bg-aviso-soft/50 text-aviso-text-fuerte"
                : "bg-fondo/60 text-tinta-suave"
            }`}
          >
            {avisoSelf}
            {requiereConfirmacionSelf && (
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  name="confirmar_self"
                  onChange={guardarAhora}
                  className="size-4 accent-aviso"
                />
                <span className="text-xs">Confirmo igual</span>
              </label>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Fecha coordinada</span>
            <input
              type="date"
              name="fecha_coordinada"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                queueMicrotask(guardarAhora);
              }}
              className={clsEntrada}
            />
            {fechaDistinta && (
              <span className="text-xs text-dato-text">
                Distinta a la de la reserva. La limpieza no se mueve.
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Hora coordinada</span>
            <SelectorHora
              name="hora_coordinada"
              defaultValue={valores.hora_coordinada}
              onChange={(v) => {
                setHora(v);
                queueMicrotask(guardarAhora);
              }}
            />
            {salidaTarde && (
              <span className="text-xs text-aviso-text">
                Sale después de las {horaLimiteCheckout.slice(0, 5)}: queda poco
                tiempo para limpiar.
              </span>
            )}
            {horaSalidaMismoDia && !esCheckout && (
              <span className="text-xs text-tinta-etiqueta">
                Ese día sale otro huésped a las {horaSalidaMismoDia.slice(0, 5)}.
              </span>
            )}
          </label>
        </div>

        {/* Las casillas viven acá adentro, junto a lo que se coordina */}
        {tildes.length > 0 && (
          <div className="flex flex-col gap-2">
            {tildes.map((t) => (
              <Casilla key={t.clave} tilde={t} />
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Observaciones</span>
          <textarea
            name="observaciones"
            defaultValue={valores.observaciones}
            onBlur={guardarAhora}
            className={clsAreaTexto}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-error-soft px-4 py-3 text-sm text-error-text">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

/** Casilla que guarda sola al tocarla y avisa si genera un conflicto. */
function Casilla({ tilde }: { tilde: Tilde }) {
  const [pendiente, iniciar] = useTransition();
  const [activo, setActivo] = useState(tilde.activo);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
          activo
            ? "border-exito-borde bg-exito-soft/30"
            : "border-borde-control hover:bg-superficie-alt"
        } ${pendiente ? "opacity-60" : ""}`}
      >
        <input
          type="checkbox"
          checked={activo}
          disabled={pendiente}
          onChange={(e) => {
            const valor = e.target.checked;
            setActivo(valor);
            setError(null);
            iniciar(async () => {
              // Si no se guardó, el tilde vuelve a como estaba: que no
              // parezca hecho algo que en la base no quedó.
              let resultado: { error: string } | null;
              try {
                resultado = await tilde.accion(valor);
              } catch {
                resultado = { error: "No se pudo guardar: revisá la conexión." };
              }
              if (resultado) {
                setActivo(!valor);
                setError(resultado.error);
              }
            });
          }}
          className="size-5 shrink-0 accent-primary"
        />
        <span className="min-w-0">
          <span className="block text-base text-tinta">{tilde.etiqueta}</span>
          {tilde.detalle && (
            <span className="block text-xs text-tinta-tenue">{tilde.detalle}</span>
          )}
        </span>
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm text-error-text">
          {error}
        </p>
      )}
      {activo && tilde.avisoAlActivar && (
        <p className="rounded-lg bg-aviso-soft/60 px-3 py-2 text-sm text-aviso-text-fuerte">
          {tilde.avisoAlActivar}
        </p>
      )}
    </div>
  );
}

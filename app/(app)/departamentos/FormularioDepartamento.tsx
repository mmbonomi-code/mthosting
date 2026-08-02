"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "./acciones";
import {
  ETIQUETA_AMBIENTES,
  ETIQUETA_SELF_CHECKOUT,
} from "@/lib/etiquetas";
import {
  clsAreaTexto,
  clsBotonPrimario,
  clsBotonSecundario,
  clsEntrada,
  clsEtiqueta,
} from "@/lib/ui";

type PropietarioOpcion = { id: string; nombre: string };

type Valores = {
  codigo?: string | null;
  nombre_interno?: string | null;
  propietario_id?: string | null;
  estado?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  ambientes?: string | null;
  habitaciones?: number | null;
  capacidad?: number | null;
  camas_king?: number | null;
  camas_queen?: number | null;
  camas_twin?: number | null;
  sillon_cama?: number | null;
  bano_1?: string | null;
  bano_2?: string | null;
  bano_3?: string | null;
  comision_pct?: number | null;
  wifi_ssid?: string | null;
  wifi_pass?: string | null;
  airbnb_user?: string | null;
  airbnb_pass?: string | null;
  url_publicacion?: string | null;
  url_mapa?: string | null;
  ical_url?: string | null;
  encargado_nombre?: string | null;
  encargado_telefono?: string | null;
  propietario_telefono?: string | null;
  self_checkout?: string | null;
  requiere_registro?: boolean;
  requiere_aviso_seguridad?: boolean;
  indicaciones_acceso?: string | null;
  trabajo_verificado?: boolean;
  observacion?: string | null;
  activo?: boolean;
};

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-800 p-4">
      <legend className="px-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Campo({
  etiqueta,
  ancho = false,
  children,
}: {
  etiqueta: string;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${ancho ? "sm:col-span-2" : ""}`}>
      <span className={clsEtiqueta}>{etiqueta}</span>
      {children}
    </label>
  );
}

function Casilla({
  nombre,
  etiqueta,
  defaultChecked,
}: {
  nombre: string;
  etiqueta: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 py-1">
      <input
        type="checkbox"
        name={nombre}
        defaultChecked={defaultChecked}
        className="size-5 accent-white"
      />
      <span className="text-base text-slate-200">{etiqueta}</span>
    </label>
  );
}

export default function FormularioDepartamento({
  accion,
  valores = {},
  propietarios,
  urlCancelar,
}: {
  accion: (
    estadoPrevio: EstadoFormulario,
    fd: FormData,
  ) => Promise<EstadoFormulario>;
  valores?: Valores;
  propietarios: PropietarioOpcion[];
  urlCancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-6">
      <Seccion titulo="Identificación">
        <Campo etiqueta="Código *">
          <input
            name="codigo"
            required
            defaultValue={valores.codigo ?? ""}
            placeholder="ARAOZ1"
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Nombre interno *">
          <input
            name="nombre_interno"
            required
            defaultValue={valores.nombre_interno ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Estado">
          <select
            name="estado"
            defaultValue={valores.estado ?? "activo"}
            className={clsEntrada}
          >
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
          </select>
        </Campo>
        <div className="flex items-end">
          <Casilla
            nombre="activo"
            etiqueta="Visible en el sistema"
            defaultChecked={valores.activo ?? true}
          />
        </div>
      </Seccion>

      <Seccion titulo="Ubicación y capacidad">
        <Campo etiqueta="Dirección (completa, con piso y depto)" ancho>
          <input
            name="direccion"
            defaultValue={valores.direccion ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Barrio">
          <input
            name="barrio"
            defaultValue={valores.barrio ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Ambientes (para limpieza)" ancho>
          <select
            name="ambientes"
            defaultValue={valores.ambientes ?? ""}
            className={clsEntrada}
          >
            <option value="">— Sin definir —</option>
            {Object.entries(ETIQUETA_AMBIENTES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            De acá sale el valor de cada limpieza de este departamento.
          </span>
        </Campo>
        <Campo etiqueta="Habitaciones">
          <input
            name="habitaciones"
            type="number"
            min={0}
            defaultValue={valores.habitaciones ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Capacidad (personas)">
          <input
            name="capacidad"
            type="number"
            min={0}
            defaultValue={valores.capacidad ?? ""}
            className={clsEntrada}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Camas">
        <Campo etiqueta="King">
          <input
            name="camas_king"
            type="number"
            min={0}
            defaultValue={valores.camas_king ?? 0}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Queen">
          <input
            name="camas_queen"
            type="number"
            min={0}
            defaultValue={valores.camas_queen ?? 0}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Twin (individual)">
          <input
            name="camas_twin"
            type="number"
            min={0}
            defaultValue={valores.camas_twin ?? 0}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Sillón cama">
          <input
            name="sillon_cama"
            type="number"
            min={0}
            defaultValue={valores.sillon_cama ?? 0}
            className={clsEntrada}
          />
        </Campo>
        <p className="text-xs text-slate-500 sm:col-span-2">
          El total de camas se calcula solo: es la suma de estas cuatro.
        </p>
      </Seccion>

      <Seccion titulo="Baños">
        <Campo etiqueta="Baño 1" ancho>
          <input
            name="bano_1"
            defaultValue={valores.bano_1 ?? ""}
            placeholder="Ej.: completo con ducha — dejar vacío si no existe"
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Baño 2" ancho>
          <input
            name="bano_2"
            defaultValue={valores.bano_2 ?? ""}
            placeholder="Dejar vacío si no existe"
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Baño 3" ancho>
          <input
            name="bano_3"
            defaultValue={valores.bano_3 ?? ""}
            placeholder="Dejar vacío si no existe"
            className={clsEntrada}
          />
        </Campo>
        <p className="text-xs text-slate-500 sm:col-span-2">
          La cantidad de baños se cuenta sola, según cuáles estén cargados.
        </p>
      </Seccion>

      <Seccion titulo="Wifi">
        <Campo etiqueta="Red (SSID)">
          <input
            name="wifi_ssid"
            defaultValue={valores.wifi_ssid ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Contraseña del wifi">
          <input
            name="wifi_pass"
            defaultValue={valores.wifi_pass ?? ""}
            className={clsEntrada}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Propiedad">
        <Campo etiqueta="Propietario">
          <select
            name="propietario_id"
            defaultValue={valores.propietario_id ?? ""}
            className={clsEntrada}
          >
            <option value="">— Sin propietario —</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Teléfono del propietario">
          <input
            name="propietario_telefono"
            defaultValue={valores.propietario_telefono ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Encargado del edificio">
          <input
            name="encargado_nombre"
            defaultValue={valores.encargado_nombre ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Teléfono del encargado">
          <input
            name="encargado_telefono"
            defaultValue={valores.encargado_telefono ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="URL de la publicación">
          <input
            name="url_publicacion"
            type="url"
            defaultValue={valores.url_publicacion ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="URL del mapa">
          <input
            name="url_mapa"
            type="url"
            defaultValue={valores.url_mapa ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Calendario iCal de Airbnb (URL)" ancho>
          <input
            name="ical_url"
            type="url"
            defaultValue={valores.ical_url ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Comisión de MTHosting (%)">
          <input
            name="comision_pct"
            type="number"
            step="0.1"
            min={0}
            max={100}
            defaultValue={valores.comision_pct ?? ""}
            className={clsEntrada}
          />
        </Campo>
        <div className="hidden sm:block" />
        <Campo etiqueta="Usuario de Airbnb">
          <input
            name="airbnb_user"
            defaultValue={valores.airbnb_user ?? ""}
            autoComplete="off"
            className={clsEntrada}
          />
        </Campo>
        <Campo etiqueta="Contraseña de Airbnb">
          <input
            name="airbnb_pass"
            defaultValue={valores.airbnb_pass ?? ""}
            autoComplete="off"
            className={clsEntrada}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Requisitos de ingreso">
        <Campo etiqueta="Self check-out" ancho>
          <select
            name="self_checkout"
            defaultValue={valores.self_checkout ?? "no"}
            className={clsEntrada}
          >
            {Object.entries(ETIQUETA_SELF_CHECKOUT).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Casilla
            nombre="requiere_registro"
            etiqueta="Requiere registro de huéspedes"
            defaultChecked={valores.requiere_registro ?? false}
          />
          <Casilla
            nombre="requiere_aviso_seguridad"
            etiqueta="Requiere aviso a seguridad"
            defaultChecked={valores.requiere_aviso_seguridad ?? false}
          />
          <Casilla
            nombre="trabajo_verificado"
            etiqueta="Trabajo verificado"
            defaultChecked={valores.trabajo_verificado ?? false}
          />
        </div>
        <Campo
          etiqueta="Indicaciones de acceso (recorrido, llave de luz, portero…)"
          ancho
        >
          <textarea
            name="indicaciones_acceso"
            defaultValue={valores.indicaciones_acceso ?? ""}
            className={clsAreaTexto}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Observación">
        <Campo etiqueta="Nota libre del departamento" ancho>
          <textarea
            name="observacion"
            defaultValue={valores.observacion ?? ""}
            className={clsAreaTexto}
          />
        </Campo>
      </Seccion>

      {estado?.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300"
        >
          {estado.error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <Link href={urlCancelar} className={`${clsBotonSecundario} flex items-center`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

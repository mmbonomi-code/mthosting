"use client";

import { useState } from "react";
import { clsBotonPrimario, clsBotonSecundario, clsEntrada, clsEtiqueta } from "@/lib/ui";

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
      <div>
        <h2 className="font-medium text-white">{titulo}</h2>
        <p className="text-sm text-slate-400">{descripcion}</p>
      </div>
      {children}
    </section>
  );
}

export default function FormulariosExportar({
  manana,
  hoy,
  enUnaSemana,
  enUnMes,
}: {
  manana: string;
  hoy: string;
  enUnaSemana: string;
  enUnMes: string;
}) {
  const [fechaPDF, setFechaPDF] = useState(manana);
  const [limpiezasDesde, setLimpiezasDesde] = useState(hoy);
  const [limpiezasHasta, setLimpiezasHasta] = useState(enUnaSemana);
  const [contactosDesde, setContactosDesde] = useState(hoy);
  const [contactosHasta, setContactosHasta] = useState(enUnMes);

  return (
    <div className="flex flex-col gap-5">
      <Seccion
        titulo="PDF del día"
        descripcion="La lista que se manda por WhatsApp. Viene con la fecha de mañana, que es cuando se arma."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1.5 sm:w-56">
            <span className={clsEtiqueta}>Fecha</span>
            <input
              type="date"
              value={fechaPDF}
              onChange={(e) => setFechaPDF(e.target.value)}
              className={clsEntrada}
            />
          </label>
          <a
            href={`/api/exportar/limpiezas-pdf?fecha=${fechaPDF}`}
            className={`${clsBotonPrimario} flex items-center justify-center`}
          >
            Descargar PDF
          </a>
        </div>
      </Seccion>

      <Seccion
        titulo="Limpiezas por rango"
        descripcion="Departamento, fecha, tipo y responsable. Las que no tienen responsable van marcadas."
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Desde</span>
              <input
                type="date"
                value={limpiezasDesde}
                onChange={(e) => setLimpiezasDesde(e.target.value)}
                className={clsEntrada}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Hasta</span>
              <input
                type="date"
                value={limpiezasHasta}
                onChange={(e) => setLimpiezasHasta(e.target.value)}
                className={clsEntrada}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/exportar/limpiezas-rango?desde=${limpiezasDesde}&hasta=${limpiezasHasta}&formato=xlsx`}
              className={`${clsBotonPrimario} flex items-center justify-center`}
            >
              Excel
            </a>
            <a
              href={`/api/exportar/limpiezas-rango?desde=${limpiezasDesde}&hasta=${limpiezasHasta}&formato=csv`}
              className={`${clsBotonSecundario} flex items-center justify-center`}
            >
              CSV
            </a>
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Contactos de huéspedes"
        descripcion="Por rango de fecha de check-in. Se excluyen las canceladas (Airbnb les borra el teléfono) y las que todavía no tienen departamento."
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Entran desde</span>
              <input
                type="date"
                value={contactosDesde}
                onChange={(e) => setContactosDesde(e.target.value)}
                className={clsEntrada}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Hasta</span>
              <input
                type="date"
                value={contactosHasta}
                onChange={(e) => setContactosHasta(e.target.value)}
                className={clsEntrada}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/exportar/contactos?desde=${contactosDesde}&hasta=${contactosHasta}&destino=comunicacion`}
              className={`${clsBotonPrimario} flex items-center justify-center`}
            >
              Sistema de comunicación (Excel)
            </a>
            <a
              href={`/api/exportar/contactos?desde=${contactosDesde}&hasta=${contactosHasta}&destino=google`}
              className={`${clsBotonSecundario} flex items-center justify-center`}
            >
              Google Contacts (CSV)
            </a>
          </div>
          <p className="text-xs text-slate-500">
            En el Excel el celular se escribe como texto: guardado como número
            se convierte en notación científica y el archivo llega roto.
          </p>
        </div>
      </Seccion>
    </div>
  );
}

/**
 * Completa barrio y capacidad de los departamentos (única vez).
 *
 *  - BARRIO: deducido de la dirección, calle y altura, según la geografía de
 *    CABA. Los que caen sobre una avenida que separa dos barrios están
 *    marcados como dudosos y se listan aparte para revisar.
 *  - CAPACIDAD: sale de las camas. Una king o una queen duermen 2 personas;
 *    una twin o un sillón cama, 1. Solo se completa donde hay camas
 *    cargadas: sin camas no se inventa un número.
 *
 * Uso: node --env-file=.env.local scripts/completar-barrios.mjs [--aplicar]
 */

import { createClient } from "@supabase/supabase-js";

const BARRIOS = {
  Recoleta: [
    "AGÜERO 1", "AGÜERO 2", "ANCHORENA 1", "ARENALES 2", "ARENALES 3",
    "ARENALES 4", "ARENALES 5", "ARENALES 6", "AUSTRIA 1", "AYACUCHO 1",
    "AYACUCHO 2", "AYACUCHO 3", "BILLINGHURST 1", "ECUADOR 1", "ED TALC 05",
    "ED TALC 06", "ED TALC 07", "ED TALC 08", "ED TALC 09", "ED TALC 11",
    "ED TALC 12", "ED TALC 33", "JUNCAL 1", "JUNCAL 2", "JUNCAL 3", "JUNIN 2",
    "LAPRIDA 1", "LAPRIDA 2", "LAPRIDA 3", "LAPRIDA 4", "LARREA 1", "LARREA 2",
    "LAS HERAS 2", "MONTEVIDEO 1", "MONTEVIDEO 2", "PARAGUAY 1", "PEÑA 1",
    "PEÑA 2", "POSADAS 1", "PUEYRREDON 1", "PUEYRREDON 2", "PUEYRREDON 3",
    "RODRIGUEZ PEÑA 1", "RODRIGUEZ PEÑA 2", "TALCAHUANO 1", "URIBURU 1",
  ],
  Retiro: [
    "ARENALES 1", "ARENALES 7", "ARENALES 8", "BASAVILBASO 1", "ESMERALDA 1",
    "LIBERTADOR 1", "MAIPU 2", "MAIPU 3", "MARCELO T 1", "MARCELO T 2",
    "MARCELO T 3", "PARAGUAY 3", "QUARTIER 1", "QUARTIER 2", "SUIPACHA 1",
  ],
  "San Nicolás": [
    "25 DE MAYO 1", "CORDOBA 1", "MAIPU 1", "MAIPU 4", "SARMIENTO 1",
    "TUCUMAN 1",
  ],
  Balvanera: [
    "CORRIENTES 1", "JUJUY 1A", "JUJUY 1B", "JUJUY 1C", "JUJUY 1D", "JUJUY 2A",
    "JUJUY 2B", "JUJUY 2C", "JUJUY 2D", "JUJUY 4A", "JUJUY 4B", "JUJUY 5A",
    "JUJUY 5B",
  ],
  Palermo: [
    "ARAOZ 1", "AREVALO 1", "BERUTI 1", "BERUTI 2", "BERUTI 3", "BONPLAND 1",
    "BORGES 1", "BORGES 2", "BULNES 1", "BUSTAMANTE 1", "BUSTAMANTE 2",
    "CABELLO 1", "CABELLO 2", "CABRERA 1", "CERVIÑO 1", "CORDOBA 2",
    "CORONEL D. 1", "DARREGUEYRA 1", "DORREGO 1", "FITZ ROY 1", "FITZ ROY 2",
    "GORRITI 1", "HONDURAS 1", "KENNEDY 1", "LAS HERAS 1", "MATIENZO 1",
    "PARAGUAY 2", "RUGGERI 1", "RUGGERI 2", "SCALABRINI ORTIZ 1",
    "SCALABRINI ORTIZ 2", "SEGUI 1", "SOLDADO 1", "SOLDADO 2",
  ],
  Belgrano: [
    "CABILDO 1", "CIUDAD 1", "GOLFARINI 1", "JURAMENTO 1", "LIBERTADOR 2",
    "MENDOZA 1",
  ],
  Colegiales: ["NEWBERY 1"],
};

/** Los que caen sobre un límite entre barrios: conviene que los revise una persona. */
const DUDOSOS = {
  "JUNCAL 3": "Juncal 2845, cerca del límite con Palermo",
  "LAS HERAS 2": "Av. Las Heras separa Recoleta de Palermo",
  "BUSTAMANTE 2": "Sánchez de Bustamante 1770, cerca de Almagro",
  "AYACUCHO 2": "Ayacucho 1027, cerca de Balvanera",
  "ECUADOR 1": "Ecuador 1460, cerca de Balvanera",
  "CORONEL D. 1": "Av. Coronel Díaz separa Palermo de Recoleta",
  "BULNES 1": "Bulnes 1383, cerca de Almagro",
  "NEWBERY 1": "Jorge Newbery 1985, entre Colegiales y Chacarita",
  "KENNEDY 1": "Kennedy 2808, tomado del anuncio",
  "GOLFARINI 1": "Ángel Golfarini 2328, tomado del anuncio",
};

const porCodigo = new Map();
for (const [barrio, codigos] of Object.entries(BARRIOS)) {
  for (const codigo of codigos) porCodigo.set(codigo, barrio);
}

const aplicar = process.argv.includes("--aplicar");
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: deptos, error } = await s
  .from("departamentos")
  .select("id, codigo, direccion, barrio, capacidad, camas_king, camas_queen, camas_twin, sillon_cama, total_camas");
if (error) throw new Error(error.message);

const sinMapear = [];
const cambios = [];

for (const d of deptos) {
  const barrio = porCodigo.get(d.codigo.trim()) ?? null;
  if (!barrio) sinMapear.push(d.codigo);

  // Una king o una queen duermen 2; una twin o un sillón cama, 1.
  const capacidad =
    d.total_camas > 0
      ? d.camas_king * 2 + d.camas_queen * 2 + d.camas_twin + d.sillon_cama
      : null;

  const nuevo = {};
  if (barrio && barrio !== d.barrio) nuevo.barrio = barrio;
  if (capacidad !== null && capacidad !== d.capacidad) nuevo.capacidad = capacidad;
  if (Object.keys(nuevo).length > 0) cambios.push({ id: d.id, codigo: d.codigo, ...nuevo });
}

const porBarrio = {};
for (const [, barrio] of porCodigo) porBarrio[barrio] = (porBarrio[barrio] ?? 0) + 1;

console.log("=== BARRIOS ===");
Object.entries(porBarrio)
  .sort((a, b) => b[1] - a[1])
  .forEach(([b, n]) => console.log(`  ${b.padEnd(14)} ${n}`));
console.log("\nsin mapear:", sinMapear.length ? sinMapear.join(", ") : "ninguno");
console.log(`\nsin camas cargadas (capacidad queda vacía): ${deptos.filter((d) => d.total_camas === 0).length}`);
console.log(`departamentos a actualizar: ${cambios.length}`);

console.log("\n=== A REVISAR (límites entre barrios) ===");
for (const [codigo, motivo] of Object.entries(DUDOSOS)) {
  console.log(`  ${codigo.padEnd(20)} → ${porCodigo.get(codigo)}   (${motivo})`);
}

if (!aplicar) {
  console.log("\n(simulación: no se escribió nada. Agregá --aplicar)");
  process.exit(0);
}

for (const { id, codigo, ...datos } of cambios) {
  const { error: e } = await s.from("departamentos").update(datos).eq("id", id);
  if (e) console.error(`  ${codigo}: ${e.message}`);
}
console.log(`\n✓ Actualizados ${cambios.length} departamentos.`);

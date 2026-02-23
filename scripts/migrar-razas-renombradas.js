/**
 * SCRIPT DE MIGRACIÓN — Razas con nombre compuesto → nombre simplificado del enum
 * =================================================================================
 * Problema: La BD puede tener dos variantes del nombre antiguo para estas razas:
 *
 *   CON prefijo (formato original):
 *     "(PERRO) CANICHE / POODLE"    →  " CANICHE"
 *     "(PERRO) DACHSHUND (SALCHICHA)" →  " DACHSHUND "
 *
 *   SIN prefijo (post migrar-texto-razas.js):
 *     " CANICHE / POODLE"           →  " CANICHE"
 *     " DACHSHUND (SALCHICHA)"      →  " DACHSHUND "
 *
 * El script cubre ambas variantes, por lo que es seguro correrlo antes o después
 * de migrar-texto-razas.js.
 *
 * Uso:
 *   node scripts/migrar-razas-renombradas.js            → solo reporte (seguro)
 *   node scripts/migrar-razas-renombradas.js --apply    → aplica cambios a la BD
 *
 * IMPORTANTE: Ejecutar en horario de bajo tráfico. Hacer backup previo.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { RAZAS } = require("../helpers/razas");

const APLICAR_CAMBIOS = process.argv.includes("--apply");

// ─── Mapeos: todos los valores viejos posibles → valor nuevo en el enum ────────
const MAPEOS = [
  { viejo: "(PERRO) CANICHE / POODLE",      nuevo: "CANICHE" },
  { viejo: " CANICHE / POODLE",             nuevo: "CANICHE" },
  { viejo: "(PERRO) DACHSHUND (SALCHICHA)", nuevo: "SALCHICHA" },
  { viejo: " DACHSHUND (SALCHICHA)",        nuevo: "SALCHICHA" },
];

// ─── Modelo liviano ───────────────────────────────────────────────────────────
const PublicacionSchema = new mongoose.Schema({}, { strict: false });
const Publicacion = mongoose.model("Publicacion", PublicacionSchema);

// ─── Colores para consola ─────────────────────────────────────────────────────
const C = {
  reset:    "\x1b[0m",
  rojo:     "\x1b[31m",
  verde:    "\x1b[32m",
  amarillo: "\x1b[33m",
  azul:     "\x1b[34m",
  gris:     "\x1b[90m",
  negrita:  "\x1b[1m",
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.negrita}${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.negrita}  MIGRACIÓN — Razas renombradas (CANICHE / DACHSHUND)${C.reset}`);
  console.log(`${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`  Modo: ${APLICAR_CAMBIOS ? `${C.rojo}${C.negrita}ESCRITURA (--apply)${C.reset}` : `${C.verde}SOLO LECTURA (seguro)${C.reset}`}\n`);

  await mongoose.connect(process.env.MONGODB_CNN);
  console.log(`${C.verde}✔ Conectado a MongoDB${C.reset}\n`);

  // Validar que los valores destino existan en el enum actual
  const destinos = [...new Set(MAPEOS.map((m) => m.nuevo))];
  const destinosInvalidos = destinos.filter((d) => !RAZAS.includes(d));
  if (destinosInvalidos.length > 0) {
    console.error(`${C.rojo}✘ Los siguientes valores destino NO están en el enum actual:${C.reset}`);
    destinosInvalidos.forEach((d) => console.error(`   "${d}"`));
    console.error(`${C.rojo}Revisá helpers/razas.js antes de continuar.${C.reset}\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Buscar todas las publicaciones afectadas en una sola consulta
  const valoresViejos = MAPEOS.map((m) => m.viejo);
  const publicaciones = await Publicacion.find(
    { raza: { $in: valoresViejos } },
    { _id: 1, raza: 1, especie: 1, tipo: 1 }
  ).lean();

  if (publicaciones.length === 0) {
    console.log(`${C.verde}✔ No se encontraron publicaciones con las razas a renombrar. La BD está limpia.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`${C.amarillo}⚠ Se encontraron ${C.negrita}${publicaciones.length}${C.reset}${C.amarillo} publicaciones para actualizar.${C.reset}\n`);

  // Asociar cada publicación con su mapeo correspondiente
  const entradas = publicaciones.map((pub) => {
    const mapeo = MAPEOS.find((m) => m.viejo === pub.raza);
    return { pub, ...mapeo };
  });

  // Agrupar por par viejo→nuevo para el reporte
  const grupos = {};
  for (const e of entradas) {
    const key = `${e.viejo}|||${e.nuevo}`;
    if (!grupos[key]) grupos[key] = { viejo: e.viejo, nuevo: e.nuevo, items: [] };
    grupos[key].items.push(e.pub);
  }

  // ── Reporte ──
  console.log(`${C.negrita}${C.verde}── CAMBIOS A APLICAR${C.reset}`);
  for (const { viejo, nuevo, items } of Object.values(grupos)) {
    console.log(`\n   "${C.amarillo}${viejo}${C.reset}"  →  "${C.verde}${nuevo}${C.reset}"  (${items.length} publicación/es)`);
    for (const pub of items) {
      console.log(`      ${C.gris}[${pub._id}]  especie: ${pub.especie}, tipo: ${pub.tipo}${C.reset}`);
    }
  }

  // ── Resumen ──
  console.log(`\n${C.negrita}${C.azul}── RESUMEN ──────────────────────────────────────────${C.reset}`);
  console.log(`   Total a actualizar: ${C.negrita}${publicaciones.length}${C.reset}`);

  if (!APLICAR_CAMBIOS) {
    console.log(`\n${C.gris}  Para aplicar los cambios, ejecutar:${C.reset}`);
    console.log(`  ${C.negrita}node scripts/migrar-razas-renombradas.js --apply${C.reset}\n`);
    await mongoose.disconnect();
    return;
  }

  // ── Aplicar cambios ──
  console.log(`\n${C.negrita}${C.rojo}Aplicando ${publicaciones.length} cambios...${C.reset}`);

  let exitosos = 0;
  let fallidos = 0;

  for (const { pub, viejo, nuevo } of entradas) {
    try {
      await Publicacion.updateOne({ _id: pub._id }, { $set: { raza: nuevo } });
      console.log(`   ${C.verde}✔${C.reset} [${pub._id}]  "${viejo}"  →  "${nuevo}"`);
      exitosos++;
    } catch (err) {
      console.log(`   ${C.rojo}✘${C.reset} [${pub._id}]  Error: ${err.message}`);
      fallidos++;
    }
  }

  console.log(`\n${C.negrita}Resultado: ${C.verde}${exitosos} exitosos${C.reset}${C.negrita}, ${C.rojo}${fallidos} fallidos${C.reset}\n`);

  await mongoose.disconnect();
  console.log(`${C.gris}Desconectado de MongoDB.${C.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${C.rojo}Error fatal:${C.reset}`, err.message);
  mongoose.disconnect();
  process.exit(1);
});

/**
 * SCRIPT DE MIGRACIÓN — Quitar prefijo "(ESPECIE)" del campo `raza`
 * ==================================================================
 * Problema: La BD almacena el campo `raza` con el formato antiguo
 *   "(ESPECIE) NOMBRE DE RAZA"  →  ej: "(PERRO) LABRADOR RETRIEVER"
 *
 * El enum actual ya NO incluye ese prefijo; los valores válidos son
 *   " NOMBRE DE RAZA"           →  ej: " LABRADOR RETRIEVER"
 *
 * Este script:
 *  1. Conecta a la BD usando la misma variable de entorno que la app.
 *  2. Detecta TODAS las publicaciones cuya raza sigue el patrón antiguo.
 *  3. Stripea el prefijo mediante regex: /^\([^)]+\)/
 *  4. Valida que el valor resultante exista en el enum actual (RAZAS).
 *  5. SIN el flag --apply, NUNCA modifica datos — es solo lectura.
 *  6. Con el flag --apply, ejecuta las actualizaciones y loguea cada operación.
 *
 * Uso:
 *   node scripts/migrar-texto-razas.js            → solo reporte (seguro)
 *   node scripts/migrar-texto-razas.js --apply    → aplica cambios a la BD
 *
 * IMPORTANTE: Ejecutar en horario de bajo tráfico. Hacer backup previo.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { RAZAS } = require("../helpers/razas");

const APLICAR_CAMBIOS = process.argv.includes("--apply");

// ─── Regex que detecta el prefijo antiguo: "(ALGO) " ──────────────────────────
const REGEX_PREFIJO = /^\([^)]+\)/;

// ─── Modelo liviano (sin importar el modelo completo para evitar side-effects) ─
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
  console.log(`${C.negrita}  MIGRACIÓN DE TEXTO EN RAZAS — Pet Adoption Backend${C.reset}`);
  console.log(`${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`  Modo: ${APLICAR_CAMBIOS ? `${C.rojo}${C.negrita}ESCRITURA (--apply)${C.reset}` : `${C.verde}SOLO LECTURA (seguro)${C.reset}`}`);
  console.log(`  Enum actual: ${RAZAS.length} razas válidas\n`);

  await mongoose.connect(process.env.MONGODB_CNN);
  console.log(`${C.verde}✔ Conectado a MongoDB${C.reset}\n`);

  // Buscar publicaciones cuya raza empiece con "(" (patrón antiguo)
  const publicaciones = await Publicacion.find(
    { raza: { $regex: REGEX_PREFIJO } },
    { _id: 1, raza: 1, especie: 1, tipo: 1 }
  ).lean();

  if (publicaciones.length === 0) {
    console.log(`${C.verde}✔ No se encontraron publicaciones con el prefijo de especie en la raza. La BD está limpia.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`${C.amarillo}⚠ Se encontraron ${C.negrita}${publicaciones.length}${C.reset}${C.amarillo} publicaciones con el formato antiguo.${C.reset}\n`);

  // Clasificar cada publicación
  const mapeables   = [];   // prefijo quitado → valor resultante está en el enum
  const invalidos   = [];   // prefijo quitado → valor resultante NO está en el enum

  for (const pub of publicaciones) {
    const razaNueva = pub.raza.replace(REGEX_PREFIJO, "").trim();

    if (RAZAS.includes(razaNueva)) {
      mapeables.push({ pub, razaNueva });
    } else {
      invalidos.push({ pub, razaNueva });
    }
  }

  // ── Reporte: Mapeables ──
  console.log(`${C.negrita}${C.verde}── CORREGIBLES AUTOMÁTICAMENTE (${mapeables.length})${C.reset}`);
  if (mapeables.length === 0) {
    console.log(`   ${C.gris}Ninguno${C.reset}`);
  } else {
    for (const { pub, razaNueva } of mapeables) {
      console.log(
        `   ${C.gris}[${pub._id}]${C.reset}  "${C.amarillo}${pub.raza}${C.reset}"  →  "${C.verde}${razaNueva}${C.reset}"` +
        `  ${C.gris}(especie: ${pub.especie}, tipo: ${pub.tipo})${C.reset}`
      );
    }
  }

  // ── Reporte: Inválidos ──
  console.log(`\n${C.negrita}${C.rojo}── VALOR RESULTANTE NO ESTÁ EN EL ENUM — revisión manual (${invalidos.length})${C.reset}`);
  if (invalidos.length === 0) {
    console.log(`   ${C.gris}Ninguno${C.reset}`);
  } else {
    for (const { pub, razaNueva } of invalidos) {
      console.log(
        `   ${C.gris}[${pub._id}]${C.reset}  "${C.rojo}${pub.raza}${C.reset}"  →  "${C.amarillo}${razaNueva}${C.reset}" (no está en enum)` +
        `  ${C.gris}(especie: ${pub.especie})${C.reset}`
      );
    }
  }

  // ── Resumen ──
  console.log(`\n${C.negrita}${C.azul}── RESUMEN ──────────────────────────────────────────${C.reset}`);
  console.log(`   Total con formato antiguo : ${C.negrita}${publicaciones.length}${C.reset}`);
  console.log(`   Corregibles automáticamente : ${C.verde}${mapeables.length}${C.reset}`);
  console.log(`   Requieren revisión manual   : ${C.rojo}${invalidos.length}${C.reset}`);

  if (!APLICAR_CAMBIOS) {
    console.log(`\n${C.gris}  Para aplicar las ${mapeables.length} correcciones automáticas, ejecutar:${C.reset}`);
    console.log(`  ${C.negrita}node scripts/migrar-texto-razas.js --apply${C.reset}`);
    if (invalidos.length > 0) {
      console.log(`  ${C.gris}(Los ${invalidos.length} registros inválidos requieren edición manual en la BD o en la app.)${C.reset}`);
    }
    console.log();
    await mongoose.disconnect();
    return;
  }

  // ── Aplicar cambios (solo con --apply) ──
  if (mapeables.length === 0) {
    console.log(`\n${C.amarillo}No hay cambios automáticos para aplicar.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${C.negrita}${C.rojo}Aplicando ${mapeables.length} cambios...${C.reset}`);

  let exitosos = 0;
  let fallidos = 0;

  for (const { pub, razaNueva } of mapeables) {
    try {
      await Publicacion.updateOne(
        { _id: pub._id },
        { $set: { raza: razaNueva } }
      );
      console.log(`   ${C.verde}✔${C.reset} [${pub._id}]  "${pub.raza}"  →  "${razaNueva}"`);
      exitosos++;
    } catch (err) {
      console.log(`   ${C.rojo}✘${C.reset} [${pub._id}]  Error: ${err.message}`);
      fallidos++;
    }
  }

  console.log(`\n${C.negrita}Resultado: ${C.verde}${exitosos} exitosos${C.reset}${C.negrita}, ${C.rojo}${fallidos} fallidos${C.reset}`);
  if (invalidos.length > 0) {
    console.log(`${C.amarillo}Recordá revisar manualmente los ${invalidos.length} registros con valor inválido.${C.reset}`);
  }
  console.log();

  await mongoose.disconnect();
  console.log(`${C.gris}Desconectado de MongoDB.${C.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${C.rojo}Error fatal:${C.reset}`, err.message);
  mongoose.disconnect();
  process.exit(1);
});

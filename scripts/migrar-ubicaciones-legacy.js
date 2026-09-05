/**
 * SCRIPT DE MIGRACIÓN — Geolocalización de publicaciones legacy
 * =================================================================
 * Problema: Las publicaciones PERDIDO/ENCONTRADO creadas antes de agregar
 * geolocalización no tienen `ubicacion`/`ubicacionPublica`. Este script las
 * geocodifica a partir del `lugar`/`localidad` que ya tienen cargados.
 *
 * Este script:
 *  1. Conecta a la BD usando la misma variable de entorno que la app.
 *  2. Detecta TODAS las publicaciones PERDIDO/ENCONTRADO sin `ubicacion`.
 *  3. Geocodifica cada una contra Nominatim, respetando 1 req/seg (política de uso).
 *  4. Clasifica cada resultado: geocodificable, a revisar (match demasiado
 *     impreciso, ej. a nivel provincia/departamento) o sin mapeo posible.
 *  5. SIN el flag --apply, NUNCA modifica datos — es solo lectura/reporte.
 *  6. Con el flag --apply, guarda `ubicacion`/`ubicacionPublica` solo en las
 *     geocodificables y loguea cada operación.
 *
 * Uso:
 *   node scripts/migrar-ubicaciones-legacy.js            → solo reporte (seguro)
 *   node scripts/migrar-ubicaciones-legacy.js --apply    → aplica cambios a la BD
 *
 * IMPORTANTE: Ejecutar en horario de bajo tráfico. Hacer backup previo. Después
 * de aplicar, correr `mongoose.connection.syncIndexes()` para que el índice
 * 2dsphere de `ubicacionPublica` incluya los documentos migrados.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { geocodificarDireccion, esResultadoImpreciso } = require("../helpers/geocoding");
const { coordenadasAPunto, generarUbicacionPublica } = require("../helpers/geo");

const APLICAR_CAMBIOS = process.argv.includes("--apply");
const DELAY_ENTRE_REQUESTS_MS = 1100; // Nominatim: máximo 1 req/seg

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Modelo liviano (sin importar el modelo completo para evitar side-effects) ─
const PublicacionSchema = new mongoose.Schema({}, { strict: false });
const Publicacion = mongoose.model("Publicacion", PublicacionSchema);

// ─── Colores para consola ────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  rojo: "\x1b[31m",
  verde: "\x1b[32m",
  amarillo: "\x1b[33m",
  azul: "\x1b[34m",
  gris: "\x1b[90m",
  negrita: "\x1b[1m",
};

async function main() {
  console.log(`\n${C.negrita}${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.negrita}  MIGRACIÓN DE UBICACIONES LEGACY — Pet Adoption Backend${C.reset}`);
  console.log(`${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`  Modo: ${APLICAR_CAMBIOS ? `${C.rojo}${C.negrita}ESCRITURA (--apply)${C.reset}` : `${C.verde}SOLO LECTURA (seguro)${C.reset}`}\n`);

  await mongoose.connect(process.env.MONGODB_CNN);
  console.log(`${C.verde}✔ Conectado a MongoDB${C.reset}\n`);

  const publicaciones = await Publicacion.find(
    { tipo: { $in: ["PERDIDO", "ENCONTRADO"] }, ubicacion: { $exists: false } },
    { _id: 1, lugar: 1, localidad: 1, tipo: 1 },
  ).lean();

  if (publicaciones.length === 0) {
    console.log(`${C.verde}✔ No se encontraron publicaciones legacy sin ubicación. La BD está al día.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`${C.amarillo}⚠ Se encontraron ${C.negrita}${publicaciones.length}${C.reset}${C.amarillo} publicaciones sin ubicación.${C.reset}`);
  console.log(`${C.gris}  Geocodificando de a una (1 req/seg) — esto puede tardar ~${Math.ceil((publicaciones.length * DELAY_ENTRE_REQUESTS_MS) / 1000)}s...${C.reset}\n`);

  const geocodificables = [];
  const aRevisar = [];
  const sinMapeo = [];

  let procesadas = 0;

  for (const pub of publicaciones) {
    if (!pub.lugar) {
      sinMapeo.push({ pub, motivo: "Sin campo 'lugar' cargado" });
      procesadas++;
      continue;
    }

    try {
      const contexto = [pub.localidad, "Tucumán", "Argentina"].filter(Boolean).join(", ");
      const resultado = await geocodificarDireccion({ direccion: pub.lugar, contexto });

      if (esResultadoImpreciso(resultado)) {
        aRevisar.push({ pub, resultado, motivo: `Match a nivel ${resultado.clase}/${resultado.tipo}, muy poco preciso` });
      } else {
        const punto = coordenadasAPunto({ lat: resultado.lat, lng: resultado.lng });
        geocodificables.push({ pub, ubicacion: punto, ubicacionPublica: generarUbicacionPublica(punto) });
      }
    } catch (err) {
      sinMapeo.push({ pub, motivo: err?.message || String(err) });
    }

    procesadas++;
    if (procesadas % 25 === 0) {
      console.log(`${C.gris}  ...${procesadas}/${publicaciones.length} procesadas${C.reset}`);
    }

    await sleep(DELAY_ENTRE_REQUESTS_MS);
  }

  // ── Reporte ──
  console.log(`${C.negrita}${C.verde}── GEOCODIFICABLES (${geocodificables.length})${C.reset}`);
  if (geocodificables.length === 0) {
    console.log(`   ${C.gris}Ninguna${C.reset}`);
  } else {
    for (const { pub, ubicacion } of geocodificables) {
      console.log(
        `   ${C.gris}[${pub._id}]${C.reset}  "${C.amarillo}${pub.lugar}${C.reset}"  →  ${C.verde}[${ubicacion.coordinates[1]}, ${ubicacion.coordinates[0]}]${C.reset}  ${C.gris}(${pub.tipo})${C.reset}`,
      );
    }
  }

  console.log(`\n${C.negrita}${C.amarillo}── A REVISAR — match demasiado impreciso (${aRevisar.length})${C.reset}`);
  if (aRevisar.length === 0) {
    console.log(`   ${C.gris}Ninguna${C.reset}`);
  } else {
    for (const { pub, motivo } of aRevisar) {
      console.log(`   ${C.gris}[${pub._id}]${C.reset}  "${C.amarillo}${pub.lugar}${C.reset}"  ${C.gris}— ${motivo}${C.reset}`);
    }
  }

  console.log(`\n${C.negrita}${C.rojo}── SIN MAPEO POSIBLE (${sinMapeo.length})${C.reset}`);
  if (sinMapeo.length === 0) {
    console.log(`   ${C.gris}Ninguna${C.reset}`);
  } else {
    for (const { pub, motivo } of sinMapeo) {
      console.log(`   ${C.gris}[${pub._id}]${C.reset}  "${C.rojo}${pub.lugar || "(sin lugar)"}${C.reset}"  ${C.gris}— ${motivo}${C.reset}`);
    }
  }

  console.log(`\n${C.negrita}${C.azul}── RESUMEN ──────────────────────────────────────────${C.reset}`);
  console.log(`   Total sin ubicación : ${C.negrita}${publicaciones.length}${C.reset}`);
  console.log(`   Geocodificables     : ${C.verde}${geocodificables.length}${C.reset}`);
  console.log(`   A revisar           : ${C.amarillo}${aRevisar.length}${C.reset}`);
  console.log(`   Sin mapeo           : ${C.rojo}${sinMapeo.length}${C.reset}`);

  if (!APLICAR_CAMBIOS) {
    console.log(`\n${C.gris}  Para aplicar los ${geocodificables.length} mapeos geocodificables, ejecutar:${C.reset}`);
    console.log(`  ${C.negrita}node scripts/migrar-ubicaciones-legacy.js --apply${C.reset}`);
    console.log(`  ${C.gris}(Las ${aRevisar.length + sinMapeo.length} restantes requieren revisión manual.)${C.reset}\n`);
    await mongoose.disconnect();
    return;
  }

  if (geocodificables.length === 0) {
    console.log(`\n${C.amarillo}No hay publicaciones geocodificables para aplicar.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${C.negrita}${C.rojo}Aplicando ${geocodificables.length} cambios...${C.reset}`);

  let exitosos = 0;
  let fallidos = 0;

  for (const { pub, ubicacion, ubicacionPublica } of geocodificables) {
    try {
      await Publicacion.updateOne({ _id: pub._id }, { $set: { ubicacion, ubicacionPublica } });
      console.log(`   ${C.verde}✔${C.reset} [${pub._id}]  "${pub.lugar}"`);
      exitosos++;
    } catch (err) {
      console.log(`   ${C.rojo}✘${C.reset} [${pub._id}]  Error: ${err.message}`);
      fallidos++;
    }
  }

  console.log(`\n${C.negrita}Resultado: ${C.verde}${exitosos} exitosos${C.reset}${C.negrita}, ${C.rojo}${fallidos} fallidos${C.reset}`);
  console.log(`${C.amarillo}Recordá revisar manualmente las ${aRevisar.length + sinMapeo.length} publicaciones restantes,${C.reset}`);
  console.log(`${C.amarillo}y correr mongoose.connection.syncIndexes() para indexar lo migrado.${C.reset}\n`);

  await mongoose.disconnect();
  console.log(`${C.gris}Desconectado de MongoDB.${C.reset}\n`);
}

process.on("unhandledRejection", (err) => {
  console.error(`\n${C.rojo}Promesa rechazada sin capturar:${C.reset}`, err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error(`\n${C.rojo}Excepción no capturada:${C.reset}`, err);
  process.exit(1);
});

main().catch((err) => {
  console.error(`\n${C.rojo}Error fatal:${C.reset}`, err.message);
  mongoose.disconnect();
  process.exit(1);
});

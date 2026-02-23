/**
 * SCRIPT DE MIGRACIÓN — Razas libres → Enum controlado
 * ======================================================
 * Problema: Las publicaciones creadas antes del cambio tienen el campo `raza`
 * con texto libre (ej: "labrador", "mestizo"). El modelo ahora define un enum
 * estricto con el formato "(ESPECIE) NOMBRE DE RAZA".
 *
 * Este script:
 *  1. Conecta a la BD usando la misma variable de entorno que la app.
 *  2. Detecta TODAS las publicaciones con razas fuera del nuevo enum.
 *  3. Intenta mapear automáticamente usando la `especie` existente como contexto.
 *  4. Muestra un reporte detallado por consola (candidatos, ambiguos, no mapeables).
 *  5. SIN el flag --apply, NUNCA modifica datos — es solo lectura.
 *  6. Con el flag --apply, ejecuta los cambios y loguea cada operación.
 *
 * Uso:
 *   node scripts/migrar-razas.js            → solo reporte (seguro)
 *   node scripts/migrar-razas.js --apply    → aplica cambios a la BD
 *
 * IMPORTANTE: Ejecutar en horario de bajo tráfico. Hacer backup previo.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { RAZAS, RAZAS_POR_ESPECIE } = require("../helpers/razas");

const APLICAR_CAMBIOS = process.argv.includes("--apply");

// ─── Modelo liviano (sin importar el modelo completo para evitar side-effects) ─
const PublicacionSchema = new mongoose.Schema({}, { strict: false });
const Publicacion = mongoose.model("Publicacion", PublicacionSchema);

// ─── Lógica de mapeo automático ───────────────────────────────────────────────
/**
 * Dada una raza en texto libre y una especie, intenta encontrar la entrada
 * del nuevo enum que mejor coincide.
 *
 * Estrategia (en orden de precisión):
 *  1. Coincidencia exacta (ignorando mayúsculas/tildes menores)
 *  2. La raza antigua está contenida en alguna entrada del enum de esa especie
 *  3. Alguna entrada del enum contiene la raza antigua como substring
 *  4. Sin coincidencia → necesita revisión manual
 *
 * Retorna: { candidato: string|null, confianza: "alta"|"media"|"baja"|"ninguna", alternativas: string[] }
 */
function intentarMapear(razaVieja, especie) {
  const razaNorm = razaVieja.trim().toUpperCase();
  const candidatos = RAZAS_POR_ESPECIE[especie] || [];
  const todasLasRazas = RAZAS;

  // 1. Exacta dentro de la especie
  const exacta = candidatos.find((r) => r === razaNorm);
  if (exacta) return { candidato: exacta, confianza: "alta", alternativas: [] };

  // 2. La vieja está contenida en una entrada del enum (ej: "LABRADOR" en "(PERRO) LABRADOR RETRIEVER")
  const contenidas = candidatos.filter((r) => r.includes(razaNorm));
  if (contenidas.length === 1) return { candidato: contenidas[0], confianza: "alta", alternativas: [] };
  if (contenidas.length > 1) return { candidato: null, confianza: "media", alternativas: contenidas };

  // 3. Alguna palabra de la raza vieja aparece en el enum de la especie
  const palabras = razaNorm.split(/\s+/).filter((p) => p.length > 3); // ignorar palabras cortas
  const porPalabra = candidatos.filter((r) => palabras.some((p) => r.includes(p)));
  if (porPalabra.length === 1) return { candidato: porPalabra[0], confianza: "media", alternativas: [] };
  if (porPalabra.length > 1) return { candidato: null, confianza: "baja", alternativas: porPalabra };

  // 4. Buscar en TODAS las especies (el campo especie podría estar mal también)
  const enOtrasEspecies = todasLasRazas.filter((r) => r.includes(razaNorm) || palabras.some((p) => r.includes(p)));
  if (enOtrasEspecies.length > 0) {
    return { candidato: null, confianza: "ninguna", alternativas: enOtrasEspecies, especieIncorrecta: true };
  }

  return { candidato: null, confianza: "ninguna", alternativas: [] };
}

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

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.negrita}${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.negrita}  MIGRACIÓN DE RAZAS — Pet Adoption Backend${C.reset}`);
  console.log(`${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`  Modo: ${APLICAR_CAMBIOS ? `${C.rojo}${C.negrita}ESCRITURA (--apply)${C.reset}` : `${C.verde}SOLO LECTURA (seguro)${C.reset}`}`);
  console.log(`  Enum actual: ${RAZAS.length} razas válidas\n`);

  await mongoose.connect(process.env.MONGODB_CNN);
  console.log(`${C.verde}✔ Conectado a MongoDB${C.reset}\n`);

  // Obtener todas las publicaciones cuya raza NO está en el enum
  const publicaciones = await Publicacion.find(
    { raza: { $nin: RAZAS } },
    { _id: 1, raza: 1, especie: 1, tipo: 1, estado: 1, fechaCreacion: 1 }
  ).lean();

  if (publicaciones.length === 0) {
    console.log(`${C.verde}✔ No se encontraron publicaciones con razas fuera del enum. La BD está limpia.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`${C.amarillo}⚠ Se encontraron ${C.negrita}${publicaciones.length}${C.reset}${C.amarillo} publicaciones con razas no válidas.${C.reset}\n`);

  // Clasificar resultados
  const autoMapeables = [];   // confianza alta, un solo candidato
  const ambiguos = [];        // múltiples candidatos posibles
  const sinMapeo = [];       // no se encontró ninguna coincidencia

  for (const pub of publicaciones) {
    const resultado = intentarMapear(pub.raza, pub.especie);
    const entrada = { pub, resultado };

    if (resultado.confianza === "alta" && resultado.candidato) {
      autoMapeables.push(entrada);
    } else if (resultado.candidato === null && resultado.alternativas.length > 0) {
      ambiguos.push(entrada);
    } else {
      sinMapeo.push(entrada);
    }
  }

  // ── Reporte: Auto-mapeables ──
  console.log(`${C.negrita}${C.verde}── MAPEABLES AUTOMÁTICAMENTE (${autoMapeables.length})${C.reset}`);
  if (autoMapeables.length === 0) {
    console.log(`   ${C.gris}Ninguno${C.reset}`);
  } else {
    for (const { pub, resultado } of autoMapeables) {
      console.log(
        `   ${C.gris}[${pub._id}]${C.reset}  "${C.amarillo}${pub.raza}${C.reset}"  →  "${C.verde}${resultado.candidato}${C.reset}"  ${C.gris}(especie: ${pub.especie}, tipo: ${pub.tipo})${C.reset}`
      );
    }
  }

  // ── Reporte: Ambiguos ──
  console.log(`\n${C.negrita}${C.amarillo}── AMBIGUOS — requieren elección manual (${ambiguos.length})${C.reset}`);
  if (ambiguos.length === 0) {
    console.log(`   ${C.gris}Ninguno${C.reset}`);
  } else {
    for (const { pub, resultado } of ambiguos) {
      console.log(
        `   ${C.gris}[${pub._id}]${C.reset}  "${C.amarillo}${pub.raza}${C.reset}"  (especie: ${pub.especie})`
      );
      resultado.alternativas.forEach((alt) => console.log(`      ${C.gris}→ ${alt}${C.reset}`));
      if (resultado.especieIncorrecta) {
        console.log(`      ${C.rojo}⚠ Las alternativas son de una especie diferente — revisar especie también${C.reset}`);
      }
    }
  }

  // ── Reporte: Sin mapeo ──
  console.log(`\n${C.negrita}${C.rojo}── SIN MAPEO POSIBLE — acción manual requerida (${sinMapeo.length})${C.reset}`);
  if (sinMapeo.length === 0) {
    console.log(`   ${C.gris}Ninguno${C.reset}`);
  } else {
    for (const { pub } of sinMapeo) {
      console.log(
        `   ${C.gris}[${pub._id}]${C.reset}  "${C.rojo}${pub.raza}${C.reset}"  (especie: ${pub.especie}, tipo: ${pub.tipo}, estado: ${pub.estado})`
      );
    }
  }

  // ── Resumen ──
  console.log(`\n${C.negrita}${C.azul}── RESUMEN ──────────────────────────────────────────${C.reset}`);
  console.log(`   Total fuera de enum : ${C.negrita}${publicaciones.length}${C.reset}`);
  console.log(`   Auto-mapeables      : ${C.verde}${autoMapeables.length}${C.reset}`);
  console.log(`   Ambiguos            : ${C.amarillo}${ambiguos.length}${C.reset}`);
  console.log(`   Sin mapeo           : ${C.rojo}${sinMapeo.length}${C.reset}`);

  if (!APLICAR_CAMBIOS) {
    console.log(`\n${C.gris}  Para aplicar los ${autoMapeables.length} mapeos automáticos, ejecutar:${C.reset}`);
    console.log(`  ${C.negrita}node scripts/migrar-razas.js --apply${C.reset}`);
    console.log(`  ${C.gris}(Los ${ambiguos.length + sinMapeo.length} restantes requieren edición manual en la BD o en la app.)${C.reset}\n`);
    await mongoose.disconnect();
    return;
  }

  // ── Aplicar cambios (solo con --apply) ──
  if (autoMapeables.length === 0) {
    console.log(`\n${C.amarillo}No hay mapeos automáticos para aplicar.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${C.negrita}${C.rojo}Aplicando ${autoMapeables.length} cambios...${C.reset}`);

  let exitosos = 0;
  let fallidos = 0;

  for (const { pub, resultado } of autoMapeables) {
    try {
      // Usar updateOne sin runValidators para poder actualizar el campo
      // aunque el valor viejo no cumpla el enum (ese es precisamente el objetivo)
      await Publicacion.updateOne(
        { _id: pub._id },
        { $set: { raza: resultado.candidato } }
      );
      console.log(`   ${C.verde}✔${C.reset} [${pub._id}]  "${pub.raza}"  →  "${resultado.candidato}"`);
      exitosos++;
    } catch (err) {
      console.log(`   ${C.rojo}✘${C.reset} [${pub._id}]  Error: ${err.message}`);
      fallidos++;
    }
  }

  console.log(`\n${C.negrita}Resultado: ${C.verde}${exitosos} exitosos${C.reset}${C.negrita}, ${C.rojo}${fallidos} fallidos${C.reset}`);
  console.log(`${C.amarillo}Recordá revisar y actualizar manualmente los ${ambiguos.length + sinMapeo.length} registros restantes.${C.reset}\n`);

  await mongoose.disconnect();
  console.log(`${C.gris}Desconectado de MongoDB.${C.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${C.rojo}Error fatal:${C.reset}`, err.message);
  mongoose.disconnect();
  process.exit(1);
});

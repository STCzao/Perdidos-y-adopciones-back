/**
 * SCRIPT DE MIGRACIÓN MANUAL — Cobertura completa de casos restantes
 * ====================================================================
 * Cubre los 40 registros que migrar-razas.js no pudo mapear automáticamente:
 *   - 6 ambiguos (múltiples candidatos)
 *   - 34 sin mapeo (texto libre, basura, tildes incorrectas, razas fuera del enum)
 *
 * Cada mapeo está justificado con un comentario inline.
 *
 * Uso:
 *   node scripts/migrar-razas-manual.js           → solo reporte (seguro)
 *   node scripts/migrar-razas-manual.js --apply   → aplica cambios a la BD
 */

require("dotenv").config();
const mongoose = require("mongoose");

const APLICAR_CAMBIOS = process.argv.includes("--apply");

const PublicacionSchema = new mongoose.Schema({}, { strict: false });
const Publicacion = mongoose.model("Publicacion", PublicacionSchema);

// ─── Mapeos manuales ─────────────────────────────────────────────────────────
// Formato: { id, razaVieja, razaNueva, justificacion }
const MAPEOS = [
  // ── AMBIGUOS (6) ────────────────────────────────────────────────────────────
  {
    id: "695994d093f373dfcfdcf066",
    razaVieja: "DESCONOZCO. ES UN PERRO GRANDE",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Texto descriptivo no identificable → Mestizo",
  },
  {
    id: "696081d0d233309be36a112d",
    razaVieja: "GATO",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Usuario ingresó la especie como raza → Mestizo de la especie",
  },
  {
    id: "6964d991d233309be36a14f2",
    razaVieja: "GATO",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Usuario ingresó la especie como raza → Mestizo de la especie",
  },
  {
    id: "6965738fd233309be36a15ab",
    razaVieja: "PERRO",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Usuario ingresó la especie como raza → Mestizo de la especie",
  },
  {
    id: "696bf82752ca92718d21aca4",
    razaVieja: "MESTIZO - CRUZA CON CANICHE",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Cruza declarada explícitamente como mestizo",
  },
  {
    id: "69828386f694ace867321b94",
    razaVieja: "CRUZA CON YORKSHIRE TERRIER",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Cruza → raza predominante no identificable → Mestizo",
  },

  // ── SIN MAPEO (34) ──────────────────────────────────────────────────────────

  // Basura / sin información
  {
    id: "695868509143dd40f9690746",
    razaVieja: "-",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Valor basura, especie: PERRO → Mestizo por defecto",
  },
  {
    id: "697e81fdd33463658807b019",
    razaVieja: "--",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Valor basura, especie: GATO → Mestizo por defecto",
  },
  {
    id: "6999e1f5a146395c5b664c89",
    razaVieja: "--",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Valor basura, especie: GATO → Mestizo por defecto",
  },
  {
    id: "699a4f5aa146395c5b665098",
    razaVieja: "—",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Valor basura (em dash), especie: GATO → Mestizo por defecto",
  },
  {
    id: "6973a58c64aba06d9ef163e3",
    razaVieja: "_",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Valor basura, especie: PERRO → Mestizo por defecto",
  },

  // "MESTIZA" en femenino — no coincide con "MESTIZO" en mayúsculas exactas
  {
    id: "695af372385b36af13c5dd62",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },
  {
    id: "695bc8fbe79a70fb214a9986",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },
  {
    id: "6970c3c864aba06d9ef15230",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },
  {
    id: "6976ddf4d4da854b0a615123",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },
  {
    id: "697b79025a0fc688085943b4",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },
  {
    id: "6999bc3fa146395c5b664b75",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },
  {
    id: "6999c0dda146395c5b664ba8",
    razaVieja: "MESTIZA",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Femenino de mestizo, especie: PERRO",
  },

  // Sin información declarada
  {
    id: "6970c30764aba06d9ef1521e",
    razaVieja: "NO SÉ",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Sin información → Mestizo por defecto, especie: PERRO",
  },
  {
    id: "69659645d233309be36a15c9",
    razaVieja: "NO TIENE",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Sin información → Mestizo por defecto, especie: PERRO",
  },
  {
    id: "6988c5f9f694ace8673240a4",
    razaVieja: "DESCONOZCO",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Sin información → Mestizo por defecto, especie: PERRO",
  },

  // "CALLEJERO" — usado para gatos sin dueño identificado
  {
    id: "696f0fd464aba06d9ef13b5c",
    razaVieja: "CALLEJERO",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Término coloquial para gato sin raza, especie: GATO",
  },
  {
    id: "69704f7264aba06d9ef14e75",
    razaVieja: "CALLEJERO",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Término coloquial para gato sin raza, especie: GATO",
  },

  // Patrones de color usados como raza (gatos)
  {
    id: "695ff727d233309be36a0f6c",
    razaVieja: "CAREY",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Carey es un patrón de color, no una raza → Mestizo",
  },
  {
    id: "6962baa7d233309be36a1380",
    razaVieja: "TRICOLOR",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Tricolor es un patrón de color, no una raza → Mestizo",
  },
  {
    id: "697fe9c9d33463658807b64f",
    razaVieja: "GRIS VETADO PELO LARGO COLA ESPONJOSA",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Descripción física, no raza → Mestizo",
  },
  {
    id: "699b8048a146395c5b66550c",
    razaVieja: "GATITO RAYADO",
    razaNueva: "(GATO) MESTIZO",
    justificacion: "Descripción física, no raza → Mestizo",
  },

  // Razas con error tipográfico / tildes faltantes
  {
    id: "6966838e3d07ed19a2ac8642",
    razaVieja: "MALTES",
    razaNueva: "(PERRO) MALTÉS",
    justificacion: "Maltés sin tilde → corregido al valor del enum",
  },
  {
    id: "697823fe5a0fc6880859341b",
    razaVieja: "BULLDOG FRANCES",
    razaNueva: "(PERRO) BULLDOG FRANCÉS",
    justificacion: "Bulldog Francés sin tilde → corregido al valor del enum",
  },
  {
    id: "697ece48d33463658807b2d1",
    razaVieja: "AKITA - INU",
    razaNueva: "(PERRO) AKITA",
    justificacion: "Akita Inu → nombre completo de la raza, mapeado a AKITA del enum",
  },
  {
    id: "698b70aca146395c5b66203a",
    razaVieja: "CANICHES",
    razaNueva: "(PERRO) CANICHE / POODLE",
    justificacion: "Plural de Caniche → mapeado al enum",
  },

  // Razas reales no incluidas en el enum → OTRO
  {
    id: "695ae7dc385b36af13c5dd23",
    razaVieja: "OVEJERO BELGA",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Raza válida (Malinois/Tervuren) no incluida en el enum → OTRO",
  },
  {
    id: "69600347d233309be36a0fd8",
    razaVieja: "OVEJERO BELGA",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Raza válida (Malinois/Tervuren) no incluida en el enum → OTRO",
  },
  {
    id: "696005fad233309be36a1017",
    razaVieja: "PASTOR BELGA",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Sinónimo de Ovejero Belga, no incluido en el enum → OTRO",
  },

  // Mezclas o razas no identificables con certeza → OTRO
  {
    id: "69595c4f93f373dfcfdcef68",
    razaVieja: "SHARPEI CON CRUZA DE POINTER",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Cruza sin raza dominante clara → OTRO",
  },
  {
    id: "6962c58ed233309be36a139b",
    razaVieja: "PITBULL BLUE",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Pitbull no está en el enum → OTRO",
  },
  {
    id: "69752763d4da854b0a61449c",
    razaVieja: "PITTBUL CRUZA",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Pitbull (con error tipográfico) cruza → OTRO",
  },
  {
    id: "69991fcba146395c5b664a79",
    razaVieja: "PITBULL",
    razaNueva: "(PERRO) OTRO",
    justificacion: "Pitbull no está en el enum → OTRO",
  },
  {
    id: "6992b030a146395c5b663984",
    razaVieja: "CANICHE Y POINTERLAB",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Cruza de dos razas declarada → Mestizo",
  },
  {
    id: "696d9acd52ca92718d21b125",
    razaVieja: "MESTIZO. CRUZA CON CANICHE",
    razaNueva: "(PERRO) MESTIZO",
    justificacion: "Cruza declarada explícitamente como mestizo",
  },
];

// ─── Colores ──────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  rojo: "\x1b[31m",
  verde: "\x1b[32m",
  amarillo: "\x1b[33m",
  azul: "\x1b[34m",
  gris: "\x1b[90m",
  negrita: "\x1b[1m",
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.negrita}${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.negrita}  MIGRACIÓN MANUAL — Cobertura completa${C.reset}`);
  console.log(`${C.azul}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`  Modo    : ${APLICAR_CAMBIOS ? `${C.rojo}${C.negrita}ESCRITURA (--apply)${C.reset}` : `${C.verde}SOLO LECTURA (seguro)${C.reset}`}`);
  console.log(`  Registros: ${C.negrita}${MAPEOS.length}${C.reset}\n`);

  await mongoose.connect(process.env.MONGODB_CNN);
  console.log(`${C.verde}✔ Conectado a MongoDB${C.reset}\n`);

  // Verificar cuáles IDs todavía existen y todavía tienen el valor viejo
  const ids = MAPEOS.map((m) => new mongoose.Types.ObjectId(m.id));
  const existentes = await Publicacion.find(
    { _id: { $in: ids } },
    { _id: 1, raza: 1, especie: 1 }
  ).lean();

  const mapaExistentes = new Map(existentes.map((p) => [p._id.toString(), p]));

  const pendientes = [];
  const yaCorrectos = [];
  const noEncontrados = [];

  for (const mapeo of MAPEOS) {
    const pub = mapaExistentes.get(mapeo.id);
    if (!pub) {
      noEncontrados.push(mapeo);
    } else if (pub.raza === mapeo.razaNueva) {
      yaCorrectos.push({ ...mapeo, razaActual: pub.raza });
    } else {
      pendientes.push({ ...mapeo, razaActual: pub.raza });
    }
  }

  // ── Reporte ────────────────────────────────────────────────────────────────
  if (yaCorrectos.length > 0) {
    console.log(`${C.negrita}${C.gris}── YA CORRECTOS — sin cambio necesario (${yaCorrectos.length})${C.reset}`);
    for (const m of yaCorrectos) {
      console.log(`   ${C.gris}[${m.id}]  "${m.razaNueva}" ✔ ya está correcto${C.reset}`);
    }
    console.log();
  }

  if (noEncontrados.length > 0) {
    console.log(`${C.negrita}${C.amarillo}── NO ENCONTRADOS — posiblemente eliminados (${noEncontrados.length})${C.reset}`);
    for (const m of noEncontrados) {
      console.log(`   ${C.amarillo}[${m.id}]  "${m.razaVieja}"${C.reset}`);
    }
    console.log();
  }

  console.log(`${C.negrita}${C.azul}── PENDIENTES DE MIGRAR (${pendientes.length})${C.reset}`);
  if (pendientes.length === 0) {
    console.log(`   ${C.verde}No quedan registros pendientes. La BD está completamente migrada.${C.reset}`);
  } else {
    for (const m of pendientes) {
      console.log(
        `   ${C.gris}[${m.id}]${C.reset}  "${C.amarillo}${m.razaActual}${C.reset}"  →  "${C.verde}${m.razaNueva}${C.reset}"`
      );
      console.log(`   ${C.gris}   ↳ ${m.justificacion}${C.reset}`);
    }
  }

  console.log(`\n${C.negrita}${C.azul}── RESUMEN ──────────────────────────────────────────${C.reset}`);
  console.log(`   Total en script  : ${C.negrita}${MAPEOS.length}${C.reset}`);
  console.log(`   Ya correctos     : ${C.gris}${yaCorrectos.length}${C.reset}`);
  console.log(`   No encontrados   : ${C.amarillo}${noEncontrados.length}${C.reset}`);
  console.log(`   Pendientes       : ${pendientes.length > 0 ? `${C.rojo}${C.negrita}` : C.verde}${pendientes.length}${C.reset}`);

  if (!APLICAR_CAMBIOS) {
    if (pendientes.length > 0) {
      console.log(`\n${C.gris}  Para aplicar los ${pendientes.length} cambios pendientes, ejecutar:${C.reset}`);
      console.log(`  ${C.negrita}node scripts/migrar-razas-manual.js --apply${C.reset}\n`);
    }
    await mongoose.disconnect();
    return;
  }

  if (pendientes.length === 0) {
    console.log(`\n${C.verde}No hay cambios que aplicar.${C.reset}`);
    await mongoose.disconnect();
    return;
  }

  // ── Aplicar ────────────────────────────────────────────────────────────────
  console.log(`\n${C.negrita}${C.rojo}Aplicando ${pendientes.length} cambios...${C.reset}`);

  let exitosos = 0;
  let fallidos = 0;

  for (const m of pendientes) {
    try {
      await Publicacion.updateOne(
        { _id: new mongoose.Types.ObjectId(m.id) },
        { $set: { raza: m.razaNueva } }
      );
      console.log(`   ${C.verde}✔${C.reset} [${m.id}]  "${m.razaActual}"  →  "${m.razaNueva}"`);
      exitosos++;
    } catch (err) {
      console.log(`   ${C.rojo}✘${C.reset} [${m.id}]  Error: ${err.message}`);
      fallidos++;
    }
  }

  console.log(`\n${C.negrita}Resultado: ${C.verde}${exitosos} exitosos${C.reset}${C.negrita}, ${fallidos > 0 ? C.rojo : C.gris}${fallidos} fallidos${C.reset}\n`);

  await mongoose.disconnect();
  console.log(`${C.gris}Desconectado de MongoDB.${C.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${C.rojo}Error fatal:${C.reset}`, err.message);
  mongoose.disconnect();
  process.exit(1);
});

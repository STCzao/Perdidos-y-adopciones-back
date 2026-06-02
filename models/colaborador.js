const { Schema, model } = require("mongoose");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");

const FORMAS = [
  "TRANSITO",
  "TRASLADO",
  "AVISTAMIENTO",
  "DIFUSION",
  "COORDINACION",
  "ECONOMICA",
];
const DISPONIBILIDAD_GENERAL = [
  "URGENCIAS",
  "COORDINACION_PREVIA",
  "OCASIONAL",
  "SOLO_DIFUSION",
];
const MOMENTOS = [
  "MANANA",
  "SIESTA",
  "TARDE",
  "NOCHE",
  "FINES_DE_SEMANA",
  "DEPENDE_DEL_DIA",
];
const PREFERENCIAS_TRANSITO = ["PERROS", "GATOS", "PERROS_O_GATOS"];
const PERIODOS_TRANSITO = [
  "TRANSITO_CORTO_O_DE_EMERGENCIA",
  "TRANSITO_HASTA_REENCUENTRO_CON_SU_FAMILIA",
  "TRANSITO_HASTA_ADOPCION",
  "TRANSITO_POSTOPERATORIO_O_RECUPERACION",
];
const ZONAS_TRASLADO = [
  "TRASLADOS_EN_MI_ZONA",
  "TRASLADOS_DENTRO_DE_SAN_MIGUEL_DE_TUCUMAN",
  "TRASLADOS_EN_CAPITAL_Y_ALREDEDORES",
];
const DISPONIBILIDAD_TRASLADO = [
  "PODRIA_COLABORAR_ANTE_URGENCIAS",
  "SOLO_CON_COORDINACION_PREVIA",
];
const CONDICIONES_ANIMAL_TRASLADO = ["SANO", "EN_TRATAMIENTO"];
const OPCIONES_AVISTAMIENTO = [
  "PUEDO_SALIR_A_BUSCAR_CERCA_DE_MI_CASA",
  "PUEDO_RECORRER_VARIAS_CUADRAS_O_BARRIOS_CERCANOS",
  "PUEDO_REPORTAR_POSIBLES_CASOS_DE_ANIMALES_QUE_NECESITEN_AYUDA",
];
const OPCIONES_DIFUSION = [
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "CARGAR_CASOS_EN_LA_BASE_DE_DATOS",
];
const OPCIONES_COORDINACION = [
  "CONTACTAR_PERSONAS_DE_LA_RED",
  "SEGUIMIENTO_DE_CASOS",
  "ORGANIZAR_INFO_DE_LA_BASE_DE_DATOS",
];
const OPCIONES_ECONOMICO = [
  "COLABORACION_OCASIONAL",
  "COLABORACION_ANTE_URGENCIAS",
  "CON_ALIMENTO_O_MEDICAMENTOS",
];

const crearDetalleOpcionesSchema = (opcionesPermitidas) =>
  new Schema(
    {
      opciones: [{ type: String, enum: opcionesPermitidas }],
      observaciones: { type: String, maxlength: 500 },
    },
    { _id: false },
  );

const detalleTransitoSchema = new Schema(
  {
    preferencia: { type: String, enum: PREFERENCIAS_TRANSITO },
    periodos: [{ type: String, enum: PERIODOS_TRANSITO }],
    observaciones: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const detalleTrasladoSchema = new Schema(
  {
    zonas: [{ type: String, enum: ZONAS_TRASLADO }],
    disponibilidad: [{ type: String, enum: DISPONIBILIDAD_TRASLADO }],
    condicionAnimal: [{ type: String, enum: CONDICIONES_ANIMAL_TRASLADO }],
    observaciones: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const ColaboradorSchema = Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  telefono: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true, maxlength: 100 },
  localidad: { type: String, required: true, enum: LOCALIDADES_TUCUMAN },
  barrio: { type: String, required: true, trim: true, maxlength: 100 },
  direccionReferencia: { type: String, trim: true, maxlength: 150 },
  formasColaboracion: {
    type: [{ type: String, enum: FORMAS }],
    validate: {
      validator: (v) => v.length > 0,
      message: "Debe elegir al menos una forma",
    },
  },
  detalleTransito: { type: detalleTransitoSchema },
  detalleTraslado: { type: detalleTrasladoSchema },
  detalleAvistamiento: { type: crearDetalleOpcionesSchema(OPCIONES_AVISTAMIENTO) },
  detalleDifusion: { type: crearDetalleOpcionesSchema(OPCIONES_DIFUSION) },
  detalleCoordinacion: { type: crearDetalleOpcionesSchema(OPCIONES_COORDINACION) },
  detalleEconomico: { type: crearDetalleOpcionesSchema(OPCIONES_ECONOMICO) },
  disponibilidadGeneral: { type: String, enum: DISPONIBILIDAD_GENERAL },
  momentosDisponibilidad: [{ type: String, enum: MOMENTOS }],
  aceptaContactoWhatsapp: { type: Boolean, required: true },
  quiereGruposWhatsapp: { type: Boolean, default: false },
  prefiereContactoIndividual: { type: Boolean, default: false },
  observacionesFinales: { type: String, maxlength: 1000 },
  aceptaTerminos: {
    type: Boolean,
    required: true,
    validate: {
      validator: (v) => v === true,
      message: "Debe aceptar los términos",
    },
  },
  fechaRegistro: { type: Date, default: Date.now },
  activo: { type: Boolean, default: true },
});

ColaboradorSchema.index({ localidad: 1 });
ColaboradorSchema.index({ formasColaboracion: 1 });
ColaboradorSchema.index({ fechaRegistro: -1 });

ColaboradorSchema.methods.toJSON = function () {
  const { __v, ...colaborador } = this.toObject();
  return colaborador;
};

module.exports = model("Colaborador", ColaboradorSchema);
module.exports.FORMAS = FORMAS;
module.exports.DISPONIBILIDAD_GENERAL = DISPONIBILIDAD_GENERAL;
module.exports.MOMENTOS = MOMENTOS;
module.exports.PREFERENCIAS_TRANSITO = PREFERENCIAS_TRANSITO;
module.exports.PERIODOS_TRANSITO = PERIODOS_TRANSITO;
module.exports.ZONAS_TRASLADO = ZONAS_TRASLADO;
module.exports.DISPONIBILIDAD_TRASLADO = DISPONIBILIDAD_TRASLADO;
module.exports.CONDICIONES_ANIMAL_TRASLADO = CONDICIONES_ANIMAL_TRASLADO;
module.exports.OPCIONES_AVISTAMIENTO = OPCIONES_AVISTAMIENTO;
module.exports.OPCIONES_DIFUSION = OPCIONES_DIFUSION;
module.exports.OPCIONES_COORDINACION = OPCIONES_COORDINACION;
module.exports.OPCIONES_ECONOMICO = OPCIONES_ECONOMICO;

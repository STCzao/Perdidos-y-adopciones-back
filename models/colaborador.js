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

const detalleSubSchema = new Schema(
  {
    opciones: [String],
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
  detalleTransito: { type: detalleSubSchema },
  detalleTraslado: { type: detalleSubSchema },
  detalleAvistamiento: { type: detalleSubSchema },
  detalleDifusion: { type: detalleSubSchema },
  detalleCoordinacion: { type: detalleSubSchema },
  detalleEconomico: { type: detalleSubSchema },
  disponibilidadGeneral: { type: String, required: true, enum: DISPONIBILIDAD_GENERAL },
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

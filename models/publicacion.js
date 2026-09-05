const { Schema, model } = require("mongoose");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");
const { RAZAS } = require("../helpers/razas");

const PuntoSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const PublicacionSchema = Schema({
  tipo: {
    type: String,
    required: true,
    enum: ["PERDIDO", "ENCONTRADO", "ADOPCION"],
  },
  nombreanimal: {
    type: String,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ADOPCION";
    },
    maxlength: [60, "El nombre del animal no puede tener más de 60 caracteres"],
  },

  especie: {
    type: String,
    required: [true, "La especie es obligatoria"],
    enum: ["PERRO", "GATO", "AVE", "CONEJO", "OTRO"],
  },
  estado: {
    type: String,
    required: [true, "El estado es obligatorio"],
    enum: [
      "BUSCANDO A SU FAMILIA",
      "APARECIO SU FAMILIA",
      "TIENE NUEVA FAMILIA",
      "SE BUSCA",
      "YA APARECIO",
      "EN BUSCA DE UN HOGAR",
      "ADOPTADO",
      "INACTIVO",
    ],
  },
  raza: {
    type: String,
    required: [true, "La raza es obligatoria"],
    enum: RAZAS,
  },
  localidad: {
    type: String,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ENCONTRADO";
    },
    enum: LOCALIDADES_TUCUMAN,
  },
  lugar: {
    type: String,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ENCONTRADO";
    },
    maxlength: [80, "El lugar no puede tener más de 80 caracteres"],
  },
  // Ubicación exacta (GPS o geocoding de `lugar`). Nunca se expone en endpoints
  // públicos — solo accesible vía el endpoint de moderación.
  ubicacion: {
    type: PuntoSchema,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ENCONTRADO";
    },
  },
  // Ubicación desplazada aleatoriamente 100-200m respecto de `ubicacion`, para
  // no exponer la dirección exacta de quien reporta. Es la que consume el mapa público.
  ubicacionPublica: {
    type: PuntoSchema,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ENCONTRADO";
    },
  },
  fecha: {
    type: String,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ENCONTRADO";
    },
  },
  sexo: {
    type: String,
    required: [true, "El sexo es obligatorio"],
    enum: ["MACHO", "HEMBRA", "DESCONOZCO"],
  },
  tamaño: {
    type: String,
    required: [true, "El tamaño es obligatorio"],
    enum: ["MINI", "PEQUEÑO", "MEDIANO", "GRANDE", "SIN ESPECIFICAR"],
  },
  color: {
    type: String,
    required: [true, "El color es obligatorio"],
    maxlength: [50, "El color no puede tener más de 50 caracteres"],
  },
  detalles: {
    type: String,
    maxlength: [250, "Los detalles no pueden tener más de 250 caracteres"],
  },
  edad: {
    type: String,
    required: function () {
      return this.tipo === "PERDIDO" || this.tipo === "ADOPCION";
    },
    enum: ["CACHORRO", "JOVEN", "ADULTO", "MAYOR", "SIN ESPECIFICAR"],
  },
  afinidad: {
    type: String,
    required: function () {
      return this.tipo === "ADOPCION";
    },
    enum: ["ALTA", "MEDIA", "BAJA", "DESCONOZCO"],
  },
  afinidadanimales: {
    type: String,
    required: function () {
      return this.tipo === "ADOPCION";
    },
    enum: ["ALTA", "MEDIA", "BAJA", "DESCONOZCO"],
  },
  energia: {
    type: String,
    required: function () {
      return this.tipo === "ADOPCION";
    },
    enum: ["ALTA", "MEDIA", "BAJA"],
  },
  castrado: {
    type: Boolean,
    required: function () {
      return this.tipo === "ADOPCION";
    },
  },
  whatsapp: {
    type: String,
    required: [true, "El WhatsApp es obligatorio para contacto"],
    match: [
      /^[0-9]{10,15}$/,
      "El formato de WhatsApp no es válido (solo números, sin +)",
    ],
    maxlength: [15, "El WhatsApp no puede tener más de 15 caracteres"],
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  reemplaza: {
    type: Schema.Types.ObjectId,
    ref: "Publicacion",
    default: null,
  },
  reemplazadaPor: {
    type: Schema.Types.ObjectId,
    ref: "Publicacion",
    default: null,
  },
  motivoInactivacion: {
    type: String,
    enum: ["CORRECCION_TIPO"],
    default: null,
  },
  imgs: {
    type: [
      {
        type: String,
        match: [
          /^https:\/\/res\.cloudinary\.com\/.+$/,
          "La URL de imagen no es válida",
        ],
      },
    ],
    validate: {
      validator: function (value) {
        // Documentos legacy que solo tienen `img` son válidos sin `imgs`
        if (!value || value.length === 0) return Boolean(this.img);
        return value.length >= 1 && value.length <= 5;
      },
      message: "Debe incluir entre 1 y 5 imágenes",
    },
  },
  img: {
    type: String,
    match: [
      /^https:\/\/res\.cloudinary\.com\/.+$/,
      "La URL de imagen no es válida",
    ],
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
});

// Índices para búsqueda y rendimiento
PublicacionSchema.index({ tipo: 1, estado: 1 });
PublicacionSchema.index({ raza: "text", localidad: "text", lugar: "text", detalles: "text" });
PublicacionSchema.index({ usuario: 1 });
PublicacionSchema.index({ fechaCreacion: -1 });
PublicacionSchema.index({ ubicacionPublica: "2dsphere" });

PublicacionSchema.methods.toJSON = function () {
  const { __v, ...publicacion } = this.toObject();
  return publicacion;
};

module.exports = model("Publicacion", PublicacionSchema);

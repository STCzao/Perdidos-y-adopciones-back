const { Schema, model } = require("mongoose");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");
const { RAZAS } = require("../helpers/razas");

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

PublicacionSchema.methods.toJSON = function () {
  const { __v, ...publicacion } = this.toObject();
  return publicacion;
};

module.exports = model("Publicacion", PublicacionSchema);

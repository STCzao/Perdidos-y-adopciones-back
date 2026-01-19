const { Schema, model } = require("mongoose");

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
    maxlength: [40, "La raza no puede tener más de 40 caracteres"],
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
    maxlength: [80, "El color no puede tener más de 50 caracteres"],
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
    enum: ["CACHORRO", "ADULTO", "MAYOR", "SIN ESPECIFICAR"],
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
    match: [/^\+?[0-9\s\-()]{10,15}$/, "El formato de WhatsApp no es válido"],
    maxlength: [15, "El WhatsApp no puede tener más de 15 caracteres"],
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  img: {
    type: String,
    required: [true, "La imagen es obligatoria"],
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

PublicacionSchema.methods.toJSON = function () {
  const { __v, ...publicacion } = this.toObject();
  return publicacion;
};

module.exports = model("Publicacion", PublicacionSchema);

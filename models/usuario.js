const { Schema, model } = require("mongoose");

const UsuarioSchema = Schema({
  nombre: {
    type: String,
    required: [true, "El nombre es obligatorio"],
    trim: true,
    minlength: [3, "El nombre debe tener al menos 3 caracteres"],
    maxlength: [40, "El nombre no puede tener mas de 40 caracteres"],
    match: [
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
      "El nombre solo puede contener letras y espacios",
    ],
  },
  correo: {
    type: String,
    required: [true, "El correo es obligatorio"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Debe ser un correo valido"],
    maxlength: [100, "El correo no puede tener mas de 100 caracteres"],
  },
  password: {
    type: String,
    // Las cuentas creadas via Google no tienen password propio.
    required: [
      function () {
        return !this.googleId;
      },
      "La contraseña es obligatoria",
    ],
    minlength: [8, "La contraseña debe tener al menos 8 caracteres"],
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  telefono: {
    type: String,
    required: [true, "El telefono es obligatorio"],
    trim: true,
    match: [
      /^[0-9]{7,15}$/,
      "El telefono debe contener entre 7 y 15 digitos numericos",
    ],
  },
  img: {
    type: String,
    trim: true,
    match: [
      /^https:\/\/res\.cloudinary\.com\/.+$/,
      "La URL de imagen debe pertenecer a Cloudinary",
    ],
  },
  rol: {
    type: String,
    required: true,
    default: "USER_ROLE",
    enum: ["ADMIN_ROLE", "USER_ROLE", "MODERADOR_ROLE"],
  },
  estado: { type: Boolean, default: true },
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  resetToken: { type: String },
  resetTokenExp: { type: Date },
  // NUNCA agregar `expires` a este `createdAt`. Al estar dentro de un array de
  // subdocumentos, Mongoose lo traduce en un índice TTL a nivel de colección:
  // cuando un elemento del array vence, Mongo borra el USUARIO ENTERO, no solo
  // el token. Esto ya causó el borrado masivo de +100 usuarios en producción.
  // La expiración de estos tokens se maneja manualmente en código
  // (ver service/auth.js, limpiarTokensExpirados).
  refreshTokens: [
    {
      token: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      device: String,
      ip: String,
    },
  ],
});

UsuarioSchema.index({ fechaCreacion: -1 });

UsuarioSchema.methods.toJSON = function () {
  const { __v, password, resetToken, resetTokenExp, refreshTokens, _id, ...usuario } =
    this.toObject();
  usuario.uid = _id;
  return usuario;
};

module.exports = model("Usuario", UsuarioSchema);

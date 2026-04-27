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
    required: [true, "La contraseña es obligatoria"],
    minlength: [8, "La contraseña debe tener al menos 8 caracteres"],
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
    enum: ["ADMIN_ROLE", "USER_ROLE"],
  },
  estado: { type: Boolean, default: true },
  resetToken: { type: String },
  resetTokenExp: { type: Date },
  refreshTokens: [
    {
      token: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
        expires: 2592000,
      },
      device: String,
      ip: String,
    },
  ],
});

UsuarioSchema.methods.toJSON = function () {
  const { __v, password, resetToken, resetTokenExp, refreshTokens, _id, ...usuario } =
    this.toObject();
  usuario.uid = _id;
  return usuario;
};

module.exports = model("Usuario", UsuarioSchema);

const { Schema, model } = require("mongoose");

const HistorialReclamoSchema = Schema({
  // Puede ser null cuando la reasignacion se hizo con una lista puntual de
  // publicaciones en vez de un cluster completo (ej. el difusor solo confirmo
  // que una parte de sus publicaciones viejas son suyas).
  usuarioViejoId: {
    type: Schema.Types.ObjectId,
    default: null,
  },
  publicaciones: [
    {
      type: Schema.Types.ObjectId,
      ref: "Publicacion",
      required: true,
    },
  ],
  usuarioNuevo: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  resueltoPor: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
});

HistorialReclamoSchema.methods.toJSON = function () {
  const { __v, ...historial } = this.toObject();
  return historial;
};

module.exports = model("HistorialReclamo", HistorialReclamoSchema);

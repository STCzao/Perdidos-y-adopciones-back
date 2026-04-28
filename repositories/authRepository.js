const Usuario = require("../models/usuario");

const findByCorreo = (correo) => Usuario.findOne({ correo });

const findById = (id) => Usuario.findById(id);

const findByResetToken = (token) =>
  Usuario.findOne({
    resetToken: token,
    resetTokenExp: { $gt: Date.now() },
  });

const save = (usuario) => usuario.save();

module.exports = {
  findByCorreo,
  findById,
  findByResetToken,
  save,
};

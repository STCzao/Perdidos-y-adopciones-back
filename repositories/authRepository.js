const Usuario = require("../models/usuario");

const findByCorreo = (correo) => Usuario.findOne({ correo });

const findById = (id) => Usuario.findById(id);

const findByResetTokenHash = (resetTokenHash) =>
  Usuario.findOne({
    resetToken: resetTokenHash,
    resetTokenExp: { $gt: Date.now() },
  });

const save = (usuario) => usuario.save();

module.exports = {
  findByCorreo,
  findById,
  findByResetTokenHash,
  save,
};

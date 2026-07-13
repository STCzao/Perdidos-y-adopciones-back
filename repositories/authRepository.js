const Usuario = require("../models/usuario");

const findByCorreo = (correo) => Usuario.findOne({ correo });

const findByGoogleId = (googleId) => Usuario.findOne({ googleId });

const findById = (id, { select } = {}) => {
  let query = Usuario.findById(id);
  if (select) query = query.select(select);
  return query;
};

const findByResetTokenHash = (resetTokenHash) =>
  Usuario.findOne({
    resetToken: resetTokenHash,
    resetTokenExp: { $gt: Date.now() },
  });

const save = (usuario) => usuario.save();

module.exports = {
  findByCorreo,
  findByGoogleId,
  findById,
  findByResetTokenHash,
  save,
};

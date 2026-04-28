const Comunidad = require("../models/comunidad");

const findAll = () =>
  Comunidad.find().populate("usuario", "nombre img rol").sort({ fechaCreacion: -1 });

const findById = (id) => Comunidad.findById(id).populate("usuario", "nombre img rol");

const create = (data) => new Comunidad(data);

const save = (comunidad) => comunidad.save();

const populateUsuario = (comunidad) => comunidad.populate("usuario", "nombre img rol");

const findByIdAndUpdate = (id, data, options = {}) =>
  Comunidad.findByIdAndUpdate(id, data, options).populate("usuario", "nombre img rol");

const findByIdAndDelete = (id) => Comunidad.findByIdAndDelete(id);

module.exports = {
  findAll,
  findById,
  create,
  save,
  populateUsuario,
  findByIdAndUpdate,
  findByIdAndDelete,
};

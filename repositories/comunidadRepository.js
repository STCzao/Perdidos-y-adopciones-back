const Comunidad = require("../models/comunidad");

const find = ({ filter = {}, select, sort = { fechaCreacion: -1 }, skip, limit } = {}) => {
  let query = Comunidad.find(filter).populate("usuario", "nombre img rol");

  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (Number.isInteger(skip)) query = query.skip(skip);
  if (Number.isInteger(limit)) query = query.limit(limit);

  return query;
};

const countDocuments = (filter = {}) => Comunidad.countDocuments(filter);

const findAll = () => find();

const findById = (id) => Comunidad.findById(id).populate("usuario", "nombre img rol");

const create = (data) => new Comunidad(data);

const save = (comunidad) => comunidad.save();

const populateUsuario = (comunidad) => comunidad.populate("usuario", "nombre img rol");

const findByIdAndUpdate = (id, data, options = {}) =>
  Comunidad.findByIdAndUpdate(id, data, options).populate("usuario", "nombre img rol");

const findByIdAndDelete = (id) => Comunidad.findByIdAndDelete(id);

module.exports = {
  findAll,
  find,
  countDocuments,
  findById,
  create,
  save,
  populateUsuario,
  findByIdAndUpdate,
  findByIdAndDelete,
};

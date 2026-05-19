const Publicacion = require("../models/publicacion");

const countDocuments = (filter = {}) => Publicacion.countDocuments(filter);

const find = ({ filter = {}, select, populate, sort, skip, limit } = {}) => {
  let query = Publicacion.find(filter);

  if (populate) query = query.populate(populate.path, populate.select);
  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (Number.isInteger(skip)) query = query.skip(skip);
  if (Number.isInteger(limit)) query = query.limit(limit);

  return query;
};

const findOne = ({ filter = {}, select, populate } = {}) => {
  let query = Publicacion.findOne(filter);
  if (populate) query = query.populate(populate.path, populate.select);
  if (select) query = query.select(select);
  return query;
};

const findById = (id, { select, populate } = {}) => {
  let query = Publicacion.findById(id);
  if (populate) query = query.populate(populate.path, populate.select);
  if (select) query = query.select(select);
  return query;
};

const create = (data) => new Publicacion(data);

const save = (publicacion) => publicacion.save();

const populateUsuario = (publicacion, select = "nombre") => publicacion.populate("usuario", select);

const findByIdAndUpdate = (id, data, { populate, ...queryOptions } = {}) => {
  let query = Publicacion.findByIdAndUpdate(id, data, queryOptions);
  if (populate) query = query.populate(populate.path, populate.select);
  return query;
};

const findByIdAndDelete = (id) => Publicacion.findByIdAndDelete(id);

module.exports = {
  countDocuments,
  find,
  findOne,
  findById,
  create,
  save,
  populateUsuario,
  findByIdAndUpdate,
  findByIdAndDelete,
};

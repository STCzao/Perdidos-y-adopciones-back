const Usuario = require("../models/usuario");

const create = (data) => new Usuario(data);

const save = (usuario) => usuario.save();

const countDocuments = (filter = {}) => Usuario.countDocuments(filter);

const find = ({ filter = {}, select, sort, skip, limit } = {}) => {
  let query = Usuario.find(filter);

  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (Number.isInteger(skip)) query = query.skip(skip);
  if (Number.isInteger(limit)) query = query.limit(limit);

  return query;
};

const findById = (id, { select } = {}) => {
  let query = Usuario.findById(id);
  if (select) query = query.select(select);
  return query;
};

const findByIdAndUpdate = (id, data, options = {}) => {
  const { select, ...queryOptions } = options;
  let query = Usuario.findByIdAndUpdate(id, data, queryOptions);
  if (select) query = query.select(select);
  return query;
};

module.exports = {
  create,
  save,
  countDocuments,
  find,
  findById,
  findByIdAndUpdate,
};

const Colaborador = require("../models/colaborador");

const countDocuments = (filter = {}) => Colaborador.countDocuments(filter);

const find = ({ filter = {}, select, sort, skip, limit } = {}) => {
  let query = Colaborador.find(filter);

  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (Number.isInteger(skip)) query = query.skip(skip);
  if (Number.isInteger(limit)) query = query.limit(limit);

  return query;
};

const findById = (id) => Colaborador.findById(id);
const create = (data) => new Colaborador(data);
const save = (colaborador) => colaborador.save();
const findByIdAndUpdate = (id, data, options = {}) =>
  Colaborador.findByIdAndUpdate(id, data, options);

module.exports = { countDocuments, find, findById, create, save, findByIdAndUpdate };

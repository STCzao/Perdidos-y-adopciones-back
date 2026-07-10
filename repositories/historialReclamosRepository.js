const HistorialReclamo = require("../models/historialReclamo");

const create = (data) => new HistorialReclamo(data);

const save = (historial) => historial.save();

const find = ({ filter = {}, sort } = {}) => {
  let query = HistorialReclamo.find(filter);
  if (sort) query = query.sort(sort);
  return query;
};

module.exports = {
  create,
  save,
  find,
};

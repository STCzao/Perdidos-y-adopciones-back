const Publicacion = require("../models/publicacion");
const Usuario = require("../models/usuario");

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

// Una publicacion es "huerfana" cuando su campo `usuario` ya no resuelve a
// ningun documento de Usuario existente (ver incidente de borrado masivo por
// TTL mal configurado). Como ese ObjectId nunca cambia solo, todas las
// publicaciones de una misma cuenta borrada siguen compartiendo el mismo
// `usuario`, lo que permite agruparlas en clusters.
const findClustersHuerfanos = async ({ telefono, skip = 0, limit = 20 } = {}) => {
  const usuarioIds = await Publicacion.distinct("usuario");
  const existentes = await Usuario.distinct("_id", { _id: { $in: usuarioIds } });
  const existentesSet = new Set(existentes.map(String));
  const huerfanoIds = usuarioIds.filter((id) => !existentesSet.has(String(id)));

  const filtro = { usuario: { $in: huerfanoIds } };
  if (telefono) filtro.whatsapp = telefono;

  const [{ data = [], totalCount = [] } = {}] = await Publicacion.aggregate([
    { $match: filtro },
    {
      $group: {
        _id: "$usuario",
        cantidad: { $sum: 1 },
        primeraFecha: { $min: "$fechaCreacion" },
        ultimaFecha: { $max: "$fechaCreacion" },
        localidades: { $addToSet: "$localidad" },
        tipos: { $addToSet: "$tipo" },
      },
    },
    { $sort: { cantidad: -1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  return { clusters: data, total: totalCount[0]?.count || 0 };
};

const findByUsuarioId = (usuarioViejoId) =>
  Publicacion.find({ usuario: usuarioViejoId })
    .select("tipo especie nombreanimal localidad fecha whatsapp fechaCreacion")
    .sort({ fechaCreacion: -1 });

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
  findClustersHuerfanos,
  findByUsuarioId,
};

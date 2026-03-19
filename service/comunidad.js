const Comunidad = require("../models/comunidad");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const { normalizarTexto } = require("../helpers/normalizar-texto");

const getComunidades = async () => {
  const comunidades = await Comunidad.find()
    .populate("usuario", "nombre img rol")
    .sort({ fechaCreacion: -1 });
  return { comunidades };
};

const getComunidadById = async ({ id }) => {
  const post = await Comunidad.findById(id).populate("usuario", "nombre img rol");

  if (!post) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  return { post };
};

const crearComunidad = async ({ body, usuarioActual, ip }) => {
  const { titulo, contenido, categoria, img } = body;

  const data = {
    titulo: normalizarTexto(titulo),
    contenido,
    categoria: normalizarTexto(categoria),
    img: img ? img.toLowerCase() : undefined,
    usuario: usuarioActual._id,
  };

  const comunidad = new Comunidad(data);
  const comunidadDB = await comunidad.save();
  await comunidadDB.populate("usuario", "nombre img rol");

  logger.info("Publicación de comunidad creada", {
    titulo: data.titulo,
    categoria: data.categoria,
    usuario: usuarioActual.correo,
    ip,
  });

  return { comunidad: comunidadDB };
};

const actualizarComunidad = async ({ id, body, usuarioActual, ip }) => {
  const { titulo, contenido, categoria, img } = body;

  const data = {};
  if (titulo) data.titulo = normalizarTexto(titulo);
  if (contenido) data.contenido = contenido;
  if (categoria) data.categoria = normalizarTexto(categoria);
  if (img) data.img = img.toLowerCase();

  const editado = await Comunidad.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate("usuario", "nombre img rol");

  if (!editado) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  logger.info("Publicación de comunidad editada", {
    comunidadId: id,
    usuario: usuarioActual.correo,
    ip,
  });

  return { editado };
};

const eliminarComunidad = async ({ id, usuarioActual, ip }) => {
  const eliminado = await Comunidad.findByIdAndDelete(id);

  if (!eliminado) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  logger.warn("Publicación de comunidad eliminada", {
    comunidadId: id,
    eliminadaPor: usuarioActual.correo,
    ip,
  });

  return { eliminado };
};

module.exports = {
  getComunidades,
  getComunidadById,
  crearComunidad,
  actualizarComunidad,
  eliminarComunidad,
};

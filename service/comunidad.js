const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const { normalizarTexto } = require("../helpers/normalizar-texto");
const comunidadRepository = require("../repositories/comunidadRepository");

const getComunidades = async () => {
  const comunidades = await comunidadRepository.findAll();
  return { comunidades };
};

const getComunidadById = async ({ id }) => {
  const post = await comunidadRepository.findById(id);

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

  const comunidad = comunidadRepository.create(data);
  const comunidadDB = await comunidadRepository.save(comunidad);
  await comunidadRepository.populateUsuario(comunidadDB);

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

  const editado = await comunidadRepository.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

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
  const eliminado = await comunidadRepository.findByIdAndDelete(id);

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

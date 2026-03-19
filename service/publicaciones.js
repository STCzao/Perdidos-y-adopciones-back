const Publicacion = require("../models/publicacion");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const { normalizarTexto } = require("../helpers/normalizar-texto");

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ESTADOS_PUBLICOS = [
  "BUSCANDO A SU FAMILIA", "APARECIO SU FAMILIA",
  "SE BUSCA", "YA APARECIO",
  "EN BUSCA DE UN HOGAR", "ADOPTADO",
];

const ESTADO_DEFECTO = {
  PERDIDO: "SE BUSCA",
  ENCONTRADO: "BUSCANDO A SU FAMILIA",
  ADOPCION: "EN BUSCA DE UN HOGAR",
};

const getPublicaciones = async ({ page = 1, limit = 12, tipo, estado, search }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = { estado: { $ne: "INACTIVO" } };

  if (tipo) query.tipo = normalizarTexto(tipo);

  if (estado) {
    const estadoNorm = normalizarTexto(estado);
    if (ESTADOS_PUBLICOS.includes(estadoNorm)) query.estado = estadoNorm;
  }

  if (search) {
    const searchSeguro = escaparRegex(search.slice(0, 100));
    query.$or = [
      { raza: { $regex: searchSeguro, $options: "i" } },
      { detalles: { $regex: searchSeguro, $options: "i" } },
    ];
    if (!tipo || tipo.toUpperCase() !== "ADOPCION") {
      query.$or.push({ localidad: { $regex: searchSeguro, $options: "i" } });
      query.$or.push({ lugar: { $regex: searchSeguro, $options: "i" } });
    }
  }

  const [total, publicaciones] = await Promise.all([
    Publicacion.countDocuments(query),
    Publicacion.find(query)
      .populate("usuario", "nombre")
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  return { publicaciones, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
};

const getPublicacionesUsuario = async ({ id, usuarioActual }) => {
  const puedeVer = usuarioActual.rol === "ADMIN_ROLE" || usuarioActual._id.toString() === id;

  if (!puedeVer) {
    throw new AppError("No tiene permisos para ver estas publicaciones", 403);
  }

  const publicaciones = await Publicacion.find({ usuario: id })
    .populate("usuario", "nombre")
    .sort({ fechaCreacion: -1 });

  return { publicaciones };
};

const getPublicacion = async ({ id }) => {
  const publicacion = await Publicacion.findOne({
    _id: id,
    estado: { $ne: "INACTIVO" },
  })
    .populate("usuario", "nombre")
    .select("-whatsapp");

  if (!publicacion) {
    throw new AppError("Publicación no encontrada", 404);
  }

  return { publicacion };
};

const crearPublicacion = async ({ body, usuarioId, correo, ip }) => {
  const { estado, usuario, ...datos } = body;

  const tipoNormalizado = normalizarTexto(datos.tipo);

  const datosNormalizados = {
    tipo: tipoNormalizado,
    nombreanimal: normalizarTexto(datos.nombreanimal),
    especie: normalizarTexto(datos.especie),
    raza: normalizarTexto(datos.raza),
    sexo: normalizarTexto(datos.sexo),
    tamaño: normalizarTexto(datos.tamaño),
    color: normalizarTexto(datos.color),
    edad: normalizarTexto(datos.edad),
    detalles: datos.detalles ? normalizarTexto(datos.detalles) : undefined,
    castrado: datos.castrado,
    whatsapp: datos.whatsapp,
    img: datos.img ? datos.img.toLowerCase() : undefined,
    usuario: usuarioId,
    estado: ESTADO_DEFECTO[tipoNormalizado],
  };

  if (tipoNormalizado === "PERDIDO" || tipoNormalizado === "ENCONTRADO") {
    datosNormalizados.localidad = normalizarTexto(datos.localidad);
    datosNormalizados.lugar = normalizarTexto(datos.lugar);
    datosNormalizados.fecha = datos.fecha;
  }

  if (tipoNormalizado === "ADOPCION") {
    datosNormalizados.afinidad = normalizarTexto(datos.afinidad);
    datosNormalizados.afinidadanimales = normalizarTexto(datos.afinidadanimales);
    datosNormalizados.energia = normalizarTexto(datos.energia);
  }

  const publicacion = new Publicacion(datosNormalizados);
  const publicacionDB = await publicacion.save();
  await publicacionDB.populate("usuario", "nombre");

  logger.info("Publicación creada", {
    tipo: tipoNormalizado,
    especie: datosNormalizados.especie,
    usuario: correo,
    ip,
  });

  return { publicacion: publicacionDB };
};

const actualizarPublicacion = async ({ id, body, usuarioActual }) => {
  const { _id, usuario, ...resto } = body;

  const publicacionExistente = await Publicacion.findById(id);

  if (!publicacionExistente) {
    throw new AppError("Publicación no encontrada", 404);
  }

  if (
    publicacionExistente.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para editar esta publicación", 403);
  }

  const datosNormalizados = {};
  Object.keys(resto).forEach((key) => {
    if (key === "whatsapp") {
      datosNormalizados[key] = resto[key];
    } else if (key === "img" && resto[key]) {
      datosNormalizados[key] = resto[key].toLowerCase();
    } else if (typeof resto[key] === "string" && resto[key].trim() !== "") {
      datosNormalizados[key] = normalizarTexto(resto[key]);
    } else {
      datosNormalizados[key] = resto[key];
    }
  });

  const tipoExistente = publicacionExistente.tipo;
  if (tipoExistente === "ADOPCION") {
    delete datosNormalizados.localidad;
    delete datosNormalizados.lugar;
    delete datosNormalizados.fecha;
  } else if (tipoExistente === "PERDIDO" || tipoExistente === "ENCONTRADO") {
    delete datosNormalizados.afinidad;
    delete datosNormalizados.afinidadanimales;
    delete datosNormalizados.energia;
    delete datosNormalizados.castrado;
  }

  delete datosNormalizados.tipo;
  delete datosNormalizados.estado;

  const publicacionActualizada = await Publicacion.findByIdAndUpdate(
    id,
    datosNormalizados,
    { new: true, runValidators: true }
  ).populate("usuario", "nombre");

  return { publicacion: publicacionActualizada };
};

const cambiarEstadoPublicacion = async ({ id, estado, usuarioActual, correo, ip }) => {
  const publicacion = await Publicacion.findById(id);

  if (!publicacion) {
    throw new AppError("Publicación no encontrada", 404);
  }

  if (
    publicacion.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para cambiar el estado de esta publicación", 403);
  }

  const publicacionActualizada = await Publicacion.findByIdAndUpdate(
    id,
    { estado: normalizarTexto(estado) },
    { new: true }
  ).populate("usuario", "nombre");

  logger.info("Estado de publicación actualizado", {
    publicacionId: id,
    nuevoEstado: normalizarTexto(estado),
    usuario: correo,
    ip,
  });

  return { publicacion: publicacionActualizada };
};

const eliminarPublicacion = async ({ id, usuarioActual, correo, ip }) => {
  const publicacion = await Publicacion.findById(id);

  if (!publicacion) {
    throw new AppError("Publicación no encontrada", 404);
  }

  if (
    publicacion.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para eliminar esta publicación", 403);
  }

  const publicacionEliminada = await Publicacion.findByIdAndDelete(id);

  logger.warn("Publicación eliminada", {
    publicacionId: id,
    tipo: publicacion.tipo,
    eliminadaPor: correo,
    ip,
  });

  return { publicacion: publicacionEliminada };
};

const getContacto = async ({ id }) => {
  const publicacion = await Publicacion.findOne({
    _id: id,
    estado: { $ne: "INACTIVO" },
  }).select("whatsapp");

  if (!publicacion) {
    throw new AppError("Publicación no encontrada", 404);
  }

  return { whatsapp: publicacion.whatsapp };
};

const getPublicacionesAdmin = async ({ estado, page = 1, limit = 12 }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (estado) query.estado = normalizarTexto(estado);

  const [total, publicaciones] = await Promise.all([
    Publicacion.countDocuments(query),
    Publicacion.find(query)
      .populate("usuario", "nombre correo")
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  return { total, page: pageNum, totalPages: Math.ceil(total / limitNum), publicaciones };
};

module.exports = {
  getPublicaciones,
  getPublicacionesUsuario,
  getPublicacion,
  crearPublicacion,
  actualizarPublicacion,
  cambiarEstadoPublicacion,
  eliminarPublicacion,
  getContacto,
  getPublicacionesAdmin,
};

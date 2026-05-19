const ExcelJS = require("exceljs");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const { eliminarImagen } = require("../helpers/cloudinary");
const { normalizarTexto } = require("../helpers/normalizar-texto");
const publicacionesRepository = require("../repositories/publicacionesRepository");

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TAMANIO_KEY = "tama\u00f1o";

const ESTADOS_PUBLICOS = [
  "BUSCANDO A SU FAMILIA",
  "APARECIO SU FAMILIA",
  "TIENE NUEVA FAMILIA",
  "SE BUSCA",
  "YA APARECIO",
  "EN BUSCA DE UN HOGAR",
  "ADOPTADO",
];

const ESTADO_DEFECTO = {
  PERDIDO: "SE BUSCA",
  ENCONTRADO: "BUSCANDO A SU FAMILIA",
  ADOPCION: "EN BUSCA DE UN HOGAR",
};

const normalizarImagenes = ({ imgs, img } = {}) => {
  if (Array.isArray(imgs)) {
    return imgs.map((imagen) => imagen.trim());
  }
  if (typeof img === "string" && img.trim()) {
    return [img.trim()];
  }
  return undefined;
};

const obtenerImagenesPublicacion = (publicacion) => {
  if (Array.isArray(publicacion?.imgs) && publicacion.imgs.length > 0) {
    return publicacion.imgs;
  }
  if (publicacion?.img) {
    return [publicacion.img];
  }
  return [];
};

const construirRegexBusqueda = (search) => {
  const termino = typeof search === "string" ? search.trim().slice(0, 100) : "";
  if (!termino) return null;
  return { $regex: escaparRegex(termino), $options: "i" };
};

const getPublicaciones = async ({
  page = 1,
  limit = 12,
  tipo,
  estado,
  search,
  raza,
  edad,
  localidad,
  sexo,
}) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = { estado: { $ne: "INACTIVO" } };

  if (tipo) query.tipo = normalizarTexto(tipo);

  if (estado) {
    const estadoNorm = normalizarTexto(estado);
    if (ESTADOS_PUBLICOS.includes(estadoNorm)) query.estado = estadoNorm;
  }

  if (raza) query.raza = normalizarTexto(raza);
  if (edad) query.edad = normalizarTexto(edad);
  if (localidad) query.localidad = normalizarTexto(localidad);
  if (sexo) query.sexo = normalizarTexto(sexo);

  const regex = construirRegexBusqueda(search);
  if (regex) {
    query.$or = [{ nombreanimal: regex }, { color: regex }, { raza: regex }, { detalles: regex }];
    if (!tipo || normalizarTexto(tipo) !== "ADOPCION") {
      query.$or.push({ localidad: regex });
      query.$or.push({ lugar: regex });
    }
  }

  const [total, publicaciones] = await Promise.all([
    publicacionesRepository.countDocuments(query),
    publicacionesRepository.find({
      filter: query,
      populate: { path: "usuario", select: "nombre" },
      sort: { fechaCreacion: -1 },
      skip,
      limit: limitNum,
    }),
  ]);

  return { publicaciones, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
};

const getPublicacionesUsuario = async ({
  id,
  usuarioActual,
  page = 1,
  limit = 12,
  tipo,
  estado,
  search,
}) => {
  const puedeVer = usuarioActual.rol === "ADMIN_ROLE" || usuarioActual._id.toString() === id;

  if (!puedeVer) {
    throw new AppError("No tiene permisos para ver estas publicaciones", 403);
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;
  const query = { usuario: id };

  if (tipo) query.tipo = normalizarTexto(tipo);
  if (estado) query.estado = normalizarTexto(estado);

  const regex = construirRegexBusqueda(search);
  if (regex) {
    query.$or = [{ nombreanimal: regex }, { color: regex }, { raza: regex }, { detalles: regex }];
  }

  const [total, publicaciones] = await Promise.all([
    publicacionesRepository.countDocuments(query),
    publicacionesRepository.find({
      filter: query,
      populate: { path: "usuario", select: "nombre" },
      sort: { fechaCreacion: -1 },
      skip,
      limit: limitNum,
    }),
  ]);

  return { publicaciones, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
};

const getPublicacion = async ({ id }) => {
  const publicacion = await publicacionesRepository.findOne({
    filter: {
      _id: id,
      estado: { $ne: "INACTIVO" },
    },
    populate: { path: "usuario", select: "nombre" },
    select: "-whatsapp",
  });

  if (!publicacion) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  return { publicacion };
};

const crearPublicacion = async ({ body, usuarioId, correo, ip }) => {
  const { estado, usuario, ...datos } = body;

  const tipoNormalizado = normalizarTexto(datos.tipo);
  const datosNormalizados = {
    tipo: tipoNormalizado,
    nombreanimal: datos.nombreanimal ? normalizarTexto(datos.nombreanimal) : undefined,
    especie: normalizarTexto(datos.especie),
    raza: normalizarTexto(datos.raza),
    sexo: normalizarTexto(datos.sexo),
    [TAMANIO_KEY]: normalizarTexto(datos[TAMANIO_KEY]),
    color: normalizarTexto(datos.color),
    edad: datos.edad ? normalizarTexto(datos.edad) : undefined,
    detalles: datos.detalles ? normalizarTexto(datos.detalles) : undefined,
    castrado: datos.castrado,
    whatsapp: datos.whatsapp,
    imgs: normalizarImagenes(datos),
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

  const publicacion = publicacionesRepository.create(datosNormalizados);
  const publicacionDB = await publicacionesRepository.save(publicacion);
  await publicacionesRepository.populateUsuario(publicacionDB, "nombre");

  logger.info("Publicacion creada", {
    tipo: tipoNormalizado,
    especie: datosNormalizados.especie,
    usuario: correo,
    ip,
  });

  return { publicacion: publicacionDB };
};

const actualizarPublicacion = async ({ id, body, usuarioActual }) => {
  const { _id, usuario, ...resto } = body;
  const publicacionExistente = await publicacionesRepository.findById(id);

  if (!publicacionExistente) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  if (
    publicacionExistente.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para editar esta publicacion", 403);
  }

  const imagenesActuales = obtenerImagenesPublicacion(publicacionExistente);
  const nuevasImagenes = normalizarImagenes(resto);

  if (nuevasImagenes) {
    const imagenesEliminadas = imagenesActuales.filter((img) => !nuevasImagenes.includes(img));
    await Promise.all(imagenesEliminadas.map((img) => eliminarImagen(img)));
  }

  const datosNormalizados = {};
  Object.keys(resto).forEach((key) => {
    if (key === "whatsapp") {
      datosNormalizados[key] = resto[key];
    } else if (key === "imgs" || key === "img") {
      if (nuevasImagenes) {
        datosNormalizados.imgs = nuevasImagenes;
        datosNormalizados.img = undefined;
      }
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

  const publicacionActualizada = await publicacionesRepository.findByIdAndUpdate(
    id,
    datosNormalizados,
    { new: true, runValidators: true, populate: { path: "usuario", select: "nombre" } },
  );

  return { publicacion: publicacionActualizada };
};

const cambiarEstadoPublicacion = async ({ id, estado, usuarioActual, correo, ip }) => {
  const publicacion = await publicacionesRepository.findById(id);

  if (!publicacion) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  if (
    publicacion.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para cambiar el estado de esta publicacion", 403);
  }

  const publicacionActualizada = await publicacionesRepository.findByIdAndUpdate(
    id,
    { estado: normalizarTexto(estado) },
    { new: true, populate: { path: "usuario", select: "nombre" } },
  );

  logger.info("Estado de publicacion actualizado", {
    publicacionId: id,
    nuevoEstado: normalizarTexto(estado),
    usuario: correo,
    ip,
  });

  return { publicacion: publicacionActualizada };
};

const eliminarPublicacion = async ({ id, usuarioActual, correo, ip }) => {
  const publicacion = await publicacionesRepository.findById(id);

  if (!publicacion) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  if (
    publicacion.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para eliminar esta publicacion", 403);
  }

  const imagenes = obtenerImagenesPublicacion(publicacion);
  await Promise.all(imagenes.map((img) => eliminarImagen(img)));

  const publicacionEliminada = await publicacionesRepository.findByIdAndDelete(id);

  logger.warn("Publicacion eliminada", {
    publicacionId: id,
    tipo: publicacion.tipo,
    eliminadaPor: correo,
    ip,
  });

  return { publicacion: publicacionEliminada };
};

const getContacto = async ({ id }) => {
  const publicacion = await publicacionesRepository.findOne({
    filter: {
      _id: id,
      estado: { $ne: "INACTIVO" },
    },
    select: "whatsapp",
  });

  if (!publicacion) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  return { whatsapp: publicacion.whatsapp };
};

const getPublicacionesAdmin = async ({
  estado,
  tipo,
  search,
  raza,
  localidad,
  page = 1,
  limit = 12,
  sortBy = "fechaCreacion",
  sortOrder = "desc",
}) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (estado) query.estado = normalizarTexto(estado);
  if (tipo) query.tipo = normalizarTexto(tipo);
  if (raza) query.raza = normalizarTexto(raza);
  if (localidad) query.localidad = normalizarTexto(localidad);

  const regex = construirRegexBusqueda(search);
  if (regex) {
    query.$or = [
      { nombreanimal: regex },
      { color: regex },
      { raza: regex },
      { detalles: regex },
      { lugar: regex },
    ];
  }

  const sortFields = new Set(["fechaCreacion", "tipo", "estado"]);
  const sortKey = sortFields.has(sortBy) ? sortBy : "fechaCreacion";
  const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;

  const [total, publicaciones] = await Promise.all([
    publicacionesRepository.countDocuments(query),
    publicacionesRepository.find({
      filter: query,
      populate: { path: "usuario", select: "nombre correo" },
      sort: { [sortKey]: sortDirection },
      skip,
      limit: limitNum,
    }),
  ]);

  return { total, page: pageNum, totalPages: Math.ceil(total / limitNum), publicaciones };
};

const exportarPublicaciones = async ({ estado, tipo, search, raza, localidad }) => {
  const query = {};
  if (estado) query.estado = normalizarTexto(estado);
  if (tipo) query.tipo = normalizarTexto(tipo);
  if (raza) query.raza = normalizarTexto(raza);
  if (localidad) query.localidad = normalizarTexto(localidad);

  const regex = construirRegexBusqueda(search);
  if (regex) {
    query.$or = [
      { nombreanimal: regex },
      { color: regex },
      { raza: regex },
      { detalles: regex },
      { lugar: regex },
    ];
  }

  const MAX_EXPORT = parseInt(process.env.EXPORT_MAX_ROWS ?? "5000", 10);

  const publicaciones = await publicacionesRepository.find({
    filter: query,
    populate: { path: "usuario", select: "nombre correo telefono fechaCreacion" },
    sort: { fechaCreacion: -1 },
    limit: MAX_EXPORT,
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Publicaciones");

  worksheet.columns = [
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Estado", key: "estado", width: 22 },
    { header: "Especie", key: "especie", width: 12 },
    { header: "Raza", key: "raza", width: 20 },
    { header: "Nombre del animal", key: "nombreanimal", width: 22 },
    { header: "Sexo", key: "sexo", width: 12 },
    { header: "Tamaño", key: "tamano", width: 14 },
    { header: "Color", key: "color", width: 16 },
    { header: "Edad", key: "edad", width: 14 },
    { header: "Localidad", key: "localidad", width: 22 },
    { header: "Lugar", key: "lugar", width: 30 },
    { header: "Fecha del evento", key: "fechaEvento", width: 18 },
    { header: "Detalles", key: "detalles", width: 40 },
    { header: "Fecha de publicación", key: "fechaCreacion", width: 20 },
    { header: "Nombre del usuario", key: "usuarioNombre", width: 25 },
    { header: "Correo del usuario", key: "usuarioCorreo", width: 32 },
    { header: "Teléfono del usuario", key: "usuarioTelefono", width: 18 },
    { header: "Fecha de registro", key: "usuarioFechaRegistro", width: 20 },
  ];

  publicaciones.forEach((p) => {
    const u = p.usuario || {};
    worksheet.addRow({
      tipo: p.tipo || "",
      estado: p.estado || "",
      especie: p.especie || "",
      raza: p.raza || "",
      nombreanimal: p.nombreanimal || "",
      sexo: p.sexo || "",
      tamano: p[TAMANIO_KEY] || "",
      color: p.color || "",
      edad: p.edad || "",
      localidad: p.localidad || "",
      lugar: p.lugar || "",
      fechaEvento: p.fecha || "",
      detalles: p.detalles || "",
      fechaCreacion: p.fechaCreacion?.toLocaleDateString("es-AR") || "",
      usuarioNombre: u.nombre || "",
      usuarioCorreo: u.correo || "",
      usuarioTelefono: u.telefono || "",
      usuarioFechaRegistro: u.fechaCreacion?.toLocaleDateString("es-AR") || "",
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9EAD3" },
  };

  return workbook.xlsx.writeBuffer();
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
  exportarPublicaciones,
};

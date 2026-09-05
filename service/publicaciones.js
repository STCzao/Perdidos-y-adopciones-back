const ExcelJS = require("exceljs");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const { eliminarImagen } = require("../helpers/cloudinary");
const { normalizarTexto } = require("../helpers/normalizar-texto");
const { geocodificarDireccion } = require("../helpers/geocoding");
const { coordenadasAPunto, generarUbicacionPublica } = require("../helpers/geo");
const publicacionesRepository = require("../repositories/publicacionesRepository");

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const esStringNoVacio = (value) => typeof value === "string" && value.trim().length > 0;
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
const TIPOS_CON_UBICACION = new Set(["PERDIDO", "ENCONTRADO"]);
const CAMPOS_COMPARTIDOS = [
  "nombreanimal",
  "especie",
  "raza",
  "sexo",
  TAMANIO_KEY,
  "color",
  "edad",
  "detalles",
  "whatsapp",
  "localidad",
  "lugar",
  "fecha",
  "afinidad",
  "afinidadanimales",
  "energia",
  "castrado",
  "ubicacion",
];

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

// Resuelve la ubicación exacta de una publicación PERDIDO/ENCONTRADO y calcula el
// pin público desplazado a partir de ella. Prioridad: coordenadas GPS enviadas por
// el cliente > geocoding de `lugar` > ubicación ya existente (ej. al corregir el
// tipo de una publicación sin cambiar su dirección).
const resolverUbicacion = async ({ lat, lng, lugar, localidad, ubicacionExistente }) => {
  const tieneCoordenadas = lat !== undefined && lat !== null && lng !== undefined && lng !== null;

  let punto;
  if (tieneCoordenadas) {
    punto = coordenadasAPunto({ lat, lng });
  } else if (esStringNoVacio(lugar)) {
    const contexto = [localidad, "Tucumán", "Argentina"].filter(Boolean).join(", ");
    const geocodificado = await geocodificarDireccion({ direccion: lugar, contexto });
    punto = coordenadasAPunto({ lat: geocodificado.lat, lng: geocodificado.lng });
  } else if (ubicacionExistente) {
    punto = ubicacionExistente;
  } else {
    throw new AppError("Debe indicar la ubicación por GPS (lat/lng) o cargar una dirección", 400);
  }

  return { ubicacion: punto, ubicacionPublica: generarUbicacionPublica(punto) };
};

const construirDatosPublicacion = async ({ datos, usuarioId, tipo = datos.tipo, estado, extra = {} }) => {
  const tipoNormalizado = normalizarTexto(tipo);
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
    estado: estado ?? ESTADO_DEFECTO[tipoNormalizado],
    ...extra,
  };

  if (TIPOS_CON_UBICACION.has(tipoNormalizado)) {
    datosNormalizados.localidad = normalizarTexto(datos.localidad);
    datosNormalizados.lugar = normalizarTexto(datos.lugar);
    datosNormalizados.fecha = datos.fecha;

    const { ubicacion, ubicacionPublica } = await resolverUbicacion({
      lat: datos.lat,
      lng: datos.lng,
      lugar: datosNormalizados.lugar,
      localidad: datosNormalizados.localidad,
      ubicacionExistente: datos.ubicacion,
    });
    datosNormalizados.ubicacion = ubicacion;
    datosNormalizados.ubicacionPublica = ubicacionPublica;
  }

  if (tipoNormalizado === "ADOPCION") {
    datosNormalizados.afinidad = normalizarTexto(datos.afinidad);
    datosNormalizados.afinidadanimales = normalizarTexto(datos.afinidadanimales);
    datosNormalizados.energia = normalizarTexto(datos.energia);
  }

  return datosNormalizados;
};

const extraerBasePublicacion = (publicacion) => {
  const base = { imgs: obtenerImagenesPublicacion(publicacion) };

  CAMPOS_COMPARTIDOS.forEach((campo) => {
    if (publicacion[campo] !== undefined) {
      base[campo] = publicacion[campo];
    }
  });

  return base;
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
      select: "-ubicacion",
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
    select: "-whatsapp -ubicacion",
  });

  if (!publicacion) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  return { publicacion };
};

const crearPublicacion = async ({ body, usuarioId, correo, ip }) => {
  const { estado, usuario, ...datos } = body;
  const tipoNormalizado = normalizarTexto(datos.tipo);
  const datosNormalizados = await construirDatosPublicacion({ datos, usuarioId });

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

  if (resto.tipo !== undefined && normalizarTexto(resto.tipo) !== publicacionExistente.tipo) {
    throw new AppError(
      "El tipo de publicacion no puede modificarse desde edicion. Use el flujo de correccion de tipo.",
      400,
    );
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
    } else if (key === "lat" || key === "lng") {
      // Se procesan aparte más abajo — no son campos del schema, `ubicacion`/
      // `ubicacionPublica` sí lo son.
    } else if (typeof resto[key] === "string" && resto[key].trim() !== "") {
      datosNormalizados[key] = normalizarTexto(resto[key]);
    } else {
      datosNormalizados[key] = resto[key];
    }
  });

  const tipoExistente = publicacionExistente.tipo;
  const esTipoConUbicacion = tipoExistente === "PERDIDO" || tipoExistente === "ENCONTRADO";
  const pidioNuevaUbicacion =
    resto.lat !== undefined || resto.lng !== undefined || resto.lugar !== undefined;

  if (esTipoConUbicacion && pidioNuevaUbicacion) {
    const { ubicacion, ubicacionPublica } = await resolverUbicacion({
      lat: resto.lat,
      lng: resto.lng,
      lugar: datosNormalizados.lugar,
      localidad: datosNormalizados.localidad ?? publicacionExistente.localidad,
    });
    datosNormalizados.ubicacion = ubicacion;
    datosNormalizados.ubicacionPublica = ubicacionPublica;
  }

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

const corregirTipoPublicacion = async ({ id, body, usuarioActual, correo, ip }) => {
  const { _id, usuario, estado, reemplaza, reemplazadaPor, motivoInactivacion, ...resto } = body;
  const publicacionExistente = await publicacionesRepository.findById(id);

  if (!publicacionExistente) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  if (
    publicacionExistente.usuario.toString() !== usuarioActual._id.toString() &&
    usuarioActual.rol !== "ADMIN_ROLE"
  ) {
    throw new AppError("No tiene permisos para corregir esta publicacion", 403);
  }

  if (publicacionExistente.estado === "INACTIVO") {
    throw new AppError("No se puede corregir el tipo de una publicacion inactiva", 400);
  }

  const nuevoTipo = normalizarTexto(resto.tipo);
  if (nuevoTipo === publicacionExistente.tipo) {
    throw new AppError("El nuevo tipo debe ser distinto al tipo actual", 400);
  }

  const datosBase = extraerBasePublicacion(publicacionExistente);
  const datosNuevaPublicacion = await construirDatosPublicacion({
    datos: {
      ...datosBase,
      ...resto,
      tipo: nuevoTipo,
      imgs: resto.imgs ?? datosBase.imgs,
    },
    usuarioId: publicacionExistente.usuario,
    tipo: nuevoTipo,
    estado: ESTADO_DEFECTO[nuevoTipo],
    extra: { reemplaza: publicacionExistente._id },
  });

  const nuevaPublicacion = publicacionesRepository.create(datosNuevaPublicacion);
  const publicacionDB = await publicacionesRepository.save(nuevaPublicacion);
  await publicacionesRepository.populateUsuario(publicacionDB, "nombre");

  const publicacionOriginal = await publicacionesRepository.findByIdAndUpdate(
    id,
    {
      estado: "INACTIVO",
      reemplazadaPor: publicacionDB._id,
      motivoInactivacion: "CORRECCION_TIPO",
    },
    { new: true, populate: { path: "usuario", select: "nombre" } },
  );

  logger.info("Tipo de publicacion corregido", {
    publicacionOriginalId: id,
    publicacionNuevaId: publicacionDB._id,
    tipoAnterior: publicacionExistente.tipo,
    tipoNuevo: nuevoTipo,
    usuario: correo,
    ip,
  });

  return { publicacion: publicacionDB, publicacionOriginal };
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

const getUbicacionExacta = async ({ id }) => {
  const publicacion = await publicacionesRepository.findOne({
    filter: {
      _id: id,
      estado: { $ne: "INACTIVO" },
    },
    select: "ubicacion",
  });

  if (!publicacion || !publicacion.ubicacion) {
    throw new AppError("Publicacion no encontrada o sin ubicación cargada", 404);
  }

  return { ubicacion: publicacion.ubicacion };
};

// Carga manual de moderación: para publicaciones que el geocoding automático no
// pudo resolver (o resolvió mal), un moderador fija lat/lng directo — sin pasar
// por Nominatim — a partir de una ubicación que verificó por su cuenta.
const establecerUbicacionManual = async ({ id, lat, lng, correo, ip }) => {
  const publicacion = await publicacionesRepository.findById(id);

  if (!publicacion) {
    throw new AppError("Publicacion no encontrada", 404);
  }

  if (!TIPOS_CON_UBICACION.has(publicacion.tipo)) {
    throw new AppError("Esta publicación no admite ubicación geolocalizada", 400);
  }

  const punto = coordenadasAPunto({ lat, lng });
  const ubicacionPublica = generarUbicacionPublica(punto);

  const publicacionActualizada = await publicacionesRepository.findByIdAndUpdate(
    id,
    { ubicacion: punto, ubicacionPublica },
    { new: true, populate: { path: "usuario", select: "nombre" } },
  );

  logger.info("Ubicación cargada manualmente por moderación", {
    publicacionId: id,
    moderador: correo,
    ip,
  });

  return { publicacion: publicacionActualizada };
};

const getPublicacionesAdmin = async ({
  estado,
  tipo,
  search,
  raza,
  localidad,
  sinUbicacion,
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

  // Solo PERDIDO/ENCONTRADO admiten ubicación — sin esto, un ADOPCION (que
  // nunca tiene `ubicacion`) contaminaría el filtro de "pendientes de cargar".
  if (sinUbicacion === "true") {
    query.ubicacion = { $exists: false };
    if (!tipo) query.tipo = { $in: Array.from(TIPOS_CON_UBICACION) };
  }

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
    { header: "Teléfono de contacto", key: "usuarioTelefono", width: 18 },
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
      // El whatsapp cargado en la publicacion es el numero de contacto real de
      // ese aviso y no depende de que el usuario siga existiendo; se usa como
      // fuente principal en vez de u.telefono (que se pierde si el usuario fue borrado).
      usuarioTelefono: p.whatsapp || u.telefono || "",
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
  corregirTipoPublicacion,
  cambiarEstadoPublicacion,
  eliminarPublicacion,
  getContacto,
  getUbicacionExacta,
  establecerUbicacionManual,
  getPublicacionesAdmin,
  exportarPublicaciones,
};

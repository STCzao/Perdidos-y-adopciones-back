const { response } = require("express");
const Publicacion = require("../models/publicacion");
const logger = require("../helpers/logger");

// Función para normalizar texto (case-insensitive)
const normalizarTexto = (texto) => {
  if (typeof texto !== "string") return texto;
  return texto.trim().toUpperCase();
};

// Escapar caracteres especiales de regex para evitar ReDoS
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Obtener publicaciones públicas (todas excepto INACTIVO)
const publicacionesGet = async (req, res = response, next) => {
  try {
    const { page = 1, limit = 12, tipo, estado, search } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      estado: { $ne: "INACTIVO" },
    };

    if (tipo) {
      query.tipo = normalizarTexto(tipo);
    }

    const ESTADOS_PUBLICOS = [
      "BUSCANDO A SU FAMILIA", "APARECIO SU FAMILIA",
      "SE BUSCA", "YA APARECIO",
      "EN BUSCA DE UN HOGAR", "ADOPTADO",
    ];
    if (estado) {
      const estadoNorm = normalizarTexto(estado);
      if (ESTADOS_PUBLICOS.includes(estadoNorm)) {
        query.estado = estadoNorm;
      }
      // INACTIVO u otro valor inválido se ignora — el $ne ya aplica por defecto
    }

    if (search) {
      const searchSeguro = escaparRegex(search.slice(0, 100));
      query.$or = [
        { raza: { $regex: searchSeguro, $options: "i" } },
        { detalles: { $regex: searchSeguro, $options: "i" } },
      ];
      
      // Solo buscar en 'localidad' y 'lugar' si no es ADOPCION
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

    res.json({
      success: true,
      publicaciones,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    return next(error);
  }
};

// Obtener publicaciones de un usuario (para dashboard - incluye INACTIVO)
const publicacionesUsuarioGet = async (req, res = response, next) => {
  try {
    const { id } = req.params;

    // Permitir al usuario ver sus propias publicaciones O si es admin
    const puedeVer =
      req.usuario.rol === "ADMIN_ROLE" || req.usuario._id.toString() === id;

    if (!puedeVer) {
      return res.status(403).json({
        success: false,
        msg: "No tiene permisos para ver estas publicaciones",
      });
    }

    const publicaciones = await Publicacion.find({ usuario: id })
      .populate("usuario", "nombre")
      .sort({ fechaCreacion: -1 });

    res.json({
      success: true,
      publicaciones,
    });
  } catch (error) {
    return next(error);
  }
};

// Obtener publicación individual (pública - excluye INACTIVO)
const publicacionGet = async (req, res = response, next) => {
  try {
    const { id } = req.params;
    const publicacion = await Publicacion.findOne({
      _id: id,
      estado: { $ne: "INACTIVO" },
    })
    .populate("usuario", "nombre")
    .select("-whatsapp");

    if (!publicacion) {
      return res.status(404).json({
        success: false,
        msg: "Publicación no encontrada",
      });
    }

    res.json({
      success: true,
      publicacion,
    });
  } catch (error) {
    return next(error);
  }
};

// Crear publicación
const publicacionesPost = async (req, res = response, next) => {
  try {
    const { estado, usuario, ...body } = req.body;

    // Determinar estado por defecto según el tipo de publicación
    const tipoNormalizado = normalizarTexto(body.tipo);
    let estadoDefecto;
    
    if (tipoNormalizado === "PERDIDO") {
      estadoDefecto = "SE BUSCA";
    } else if (tipoNormalizado === "ENCONTRADO") {
      estadoDefecto = "BUSCANDO A SU FAMILIA";
    } else if (tipoNormalizado === "ADOPCION") {
      estadoDefecto = "EN BUSCA DE UN HOGAR";
    }

    // Normalizar todos los campos de texto (excepto whatsapp)
    const datosNormalizados = {
      tipo: tipoNormalizado,
      nombreanimal: normalizarTexto(body.nombreanimal),
      especie: normalizarTexto(body.especie),
      raza: normalizarTexto(body.raza),
      sexo: normalizarTexto(body.sexo),
      tamaño: normalizarTexto(body.tamaño),
      color: normalizarTexto(body.color),
      edad: normalizarTexto(body.edad),
      detalles: body.detalles ? normalizarTexto(body.detalles) : undefined,
      castrado: body.castrado,
      whatsapp: body.whatsapp, // Mantener formato original
      img: body.img ? body.img.toLowerCase() : undefined,
      usuario: req.usuario._id,
      estado: estadoDefecto,
    };

    // Agregar campos condicionales según el tipo
    if (tipoNormalizado === "PERDIDO" || tipoNormalizado === "ENCONTRADO") {
      datosNormalizados.localidad = normalizarTexto(body.localidad);
      datosNormalizados.lugar = normalizarTexto(body.lugar);
      datosNormalizados.fecha = body.fecha; // Mantener como String
    }

    // Agregar campos específicos de ADOPCION
    if (tipoNormalizado === "ADOPCION") {
      datosNormalizados.afinidad = normalizarTexto(body.afinidad);
      datosNormalizados.afinidadanimales = normalizarTexto(body.afinidadanimales);
      datosNormalizados.energia = normalizarTexto(body.energia);
    }

    const publicacion = new Publicacion(datosNormalizados);
    const publicacionDB = await publicacion.save();
    await publicacionDB.populate("usuario", "nombre");

    logger.info("Publicación creada", {
      tipo: tipoNormalizado,
      especie: datosNormalizados.especie,
      usuario: req.usuario.correo,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      msg: "Publicación creada exitosamente",
      publicacion: publicacionDB,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: "Ya existe una publicación similar",
      });
    }

    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({
        success: false,
        msg: "Error de validación",
        errors,
      });
    }

    return next(error);
  }
};

// Actualizar publicación (solo dueño o admin)
const publicacionesPut = async (req, res = response, next) => {
  try {
    const { id } = req.params;
    const { _id, usuario, ...resto } = req.body;

    // Buscar publicación (incluyendo INACTIVO para que dueño/admin pueda reactivar)
    const publicacionExistente = await Publicacion.findById(id);

    if (!publicacionExistente) {
      return res.status(404).json({
        success: false,
        msg: "Publicación no encontrada",
      });
    }

    // Verificar permisos: solo dueño o admin
    if (
      publicacionExistente.usuario.toString() !== req.usuario._id.toString() &&
      req.usuario.rol !== "ADMIN_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        msg: "No tiene permisos para editar esta publicación",
      });
    }

    // Normalizar campos de texto (excepto whatsapp)
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

    // Eliminar campos que no corresponden según el tipo
    const tipoExistente = publicacionExistente.tipo;
    
    if (tipoExistente === "ADOPCION") {
      // Las publicaciones de ADOPCION no deben tener localidad, lugar ni fecha
      delete datosNormalizados.localidad;
      delete datosNormalizados.lugar;
      delete datosNormalizados.fecha;
    } else if (tipoExistente === "PERDIDO" || tipoExistente === "ENCONTRADO") {
      // Las publicaciones de PERDIDO/ENCONTRADO no deben tener campos de ADOPCION
      delete datosNormalizados.afinidad;
      delete datosNormalizados.afinidadanimales;
      delete datosNormalizados.energia;
      delete datosNormalizados.castrado;
    }

    // 'tipo' y 'estado' no se pueden cambiar desde este endpoint
    delete datosNormalizados.tipo;
    delete datosNormalizados.estado;

    const publicacionActualizada = await Publicacion.findByIdAndUpdate(
      id,
      datosNormalizados,
      { new: true, runValidators: true }
    ).populate("usuario", "nombre");

    res.json({
      success: true,
      msg: "Publicación actualizada exitosamente",
      publicacion: publicacionActualizada,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({
        success: false,
        msg: "Error de validación",
        errors,
      });
    }

    return next(error);
  }
};

// Actualizar estado de publicación (solo dueño o admin)
const publicacionesEstadoPut = async (req, res = response, next) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    // Buscar publicación
    const publicacion = await Publicacion.findById(id);

    if (!publicacion) {
      return res.status(404).json({
        success: false,
        msg: "Publicación no encontrada",
      });
    }

    // Verificar permisos: solo dueño o admin
    if (
      publicacion.usuario.toString() !== req.usuario._id.toString() &&
      req.usuario.rol !== "ADMIN_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        msg: "No tiene permisos para cambiar el estado de esta publicación",
      });
    }

    // Actualizar solo el estado
    const publicacionActualizada = await Publicacion.findByIdAndUpdate(
      id,
      { estado: normalizarTexto(estado) },
      { new: true }
    ).populate("usuario", "nombre");

    logger.info("Estado de publicación actualizado", {
      publicacionId: id,
      nuevoEstado: normalizarTexto(estado),
      usuario: req.usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      msg: "Estado actualizado exitosamente",
      publicacion: publicacionActualizada,
    });
  } catch (error) {
    return next(error);
  }
};

// Eliminar publicación (cambiar estado a INACTIVO)
const publicacionesDelete = async (req, res = response, next) => {
  try {
    const { id } = req.params;

    const publicacion = await Publicacion.findById(id);

    if (!publicacion) {
      return res.status(404).json({
        success: false,
        msg: "Publicación no encontrada",
      });
    }

    // Verificar permisos: solo dueño o admin
    if (
      publicacion.usuario.toString() !== req.usuario._id.toString() &&
      req.usuario.rol !== "ADMIN_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        msg: "No tiene permisos para eliminar esta publicación",
      });
    }

    const publicacionEliminada = await Publicacion.findByIdAndDelete(id);

    logger.warn("Publicación eliminada", {
      publicacionId: id,
      tipo: publicacion.tipo,
      eliminadaPor: req.usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      msg: "Publicación eliminada correctamente",
      publicacion: publicacionEliminada,
    });
  } catch (error) {
    return next(error);
  }
};

// Obtener contacto de la publicación (requiere autenticación)
const obtenerContactoPublicacion = async (req, res = response, next) => {
  try {
    const { id } = req.params;

    // Buscar publicación activa (excluye INACTIVO)
    const publicacion = await Publicacion.findOne({
      _id: id,
      estado: { $ne: "INACTIVO" },
    }).select("whatsapp");

    if (!publicacion) {
      return res.status(404).json({
        success: false,
        msg: "Publicación no encontrada",
      });
    }

    res.json({
      success: true,
      whatsapp: publicacion.whatsapp,
    });
  } catch (error) {
    return next(error);
  }
};

// Admin: ver todas las publicaciones (incluyendo INACTIVO)
const publicacionesAdminGet = async (req, res = response, next) => {
  try {
    const { estado, page = 1, limit = 12 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (estado) {
      query.estado = normalizarTexto(estado);
    }

    const [total, publicaciones] = await Promise.all([
      Publicacion.countDocuments(query),
      Publicacion.find(query)
        .populate("usuario", "nombre correo")
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      publicaciones,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  publicacionesGet,
  publicacionesUsuarioGet,
  publicacionGet,
  publicacionesPost,
  publicacionesPut,
  publicacionesEstadoPut,
  publicacionesDelete,
  obtenerContactoPublicacion,
  publicacionesAdminGet,
};

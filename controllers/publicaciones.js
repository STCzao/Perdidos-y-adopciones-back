const { response } = require("express");
const Publicacion = require("../models/publicacion");
const logger = require("../helpers/logger");

// Función para normalizar texto (case-insensitive)
const normalizarTexto = (texto) => {
  if (typeof texto !== "string") return texto;
  return texto.trim().toUpperCase();
};

// Obtener publicaciones públicas (todas excepto INACTIVO)
const publicacionesGet = async (req, res = response) => {
  try {
    const { page = 1, limit = 12, tipo, estado, search } = req.query;

    const pageNum = Number(page);
    let limitNum = Number(limit);
    
    // Validar límites de paginación
    limitNum = Math.min(limitNum, 50); // Máximo 50 resultados por página
    limitNum = Math.max(limitNum, 1);  // Mínimo 1 resultado
    
    const skip = (Math.max(pageNum, 1) - 1) * limitNum;

    const query = {
      estado: { $ne: "INACTIVO" },
    };

    if (tipo) {
      query.tipo = normalizarTexto(tipo);
    }

    if (estado) {
      query.estado = normalizarTexto(estado);
    }

    if (search) {
      query.$or = [
        { raza: { $regex: search, $options: "i" } },
        { detalles: { $regex: search, $options: "i" } },
      ];
      
      // Solo buscar en 'lugar' si no es ADOPCION (porque ADOPCION no tiene lugar)
      if (!tipo || tipo.toUpperCase() !== "ADOPCION") {
        query.$or.push({ lugar: { $regex: search, $options: "i" } });
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
      page: Math.max(pageNum, 1),
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error("Error al obtener publicaciones", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al obtener publicaciones",
    });
  }
};

// Obtener publicaciones de un usuario (para dashboard - incluye INACTIVO)
const publicacionesUsuarioGet = async (req, res = response) => {
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
    logger.error("Error al obtener publicaciones del usuario", {
      error: error.message,
      stack: error.stack,
      usuarioId: id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al obtener publicaciones del usuario",
    });
  }
};

// Obtener publicación individual (pública - excluye INACTIVO)
const publicacionGet = async (req, res = response) => {
  try {
    const { id } = req.params;
    const publicacion = await Publicacion.findOne({
      _id: id,
      estado: { $ne: "INACTIVO" },
    }).populate("usuario", "nombre");

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
    logger.error("Error al obtener la publicación", {
      error: error.message,
      stack: error.stack,
      publicacionId: req.params.id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al obtener la publicación",
    });
  }
};

// Crear publicación
const publicacionesPost = async (req, res = response) => {
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

    // Validar campos requeridos según el tipo
    const erroresValidacion = {};
    
    if (tipoNormalizado === "PERDIDO" || tipoNormalizado === "ENCONTRADO") {
      if (!body.lugar) erroresValidacion.lugar = "El lugar es obligatorio para este tipo de publicación";
      if (!body.fecha) erroresValidacion.fecha = "La fecha es obligatoria para este tipo de publicación";
    }
    
    if (tipoNormalizado === "ADOPCION") {
      if (!body.afinidad) erroresValidacion.afinidad = "La afinidad es obligatoria para adopción";
      if (!body.afinidadanimales) erroresValidacion.afinidadanimales = "La afinidad con animales es obligatoria para adopción";
      if (!body.energia) erroresValidacion.energia = "El nivel de energía es obligatorio para adopción";
      if (body.castrado === undefined || body.castrado === null) erroresValidacion.castrado = "El estado de castración es obligatorio para adopción";
    }
    
    if (Object.keys(erroresValidacion).length > 0) {
      return res.status(400).json({
        success: false,
        msg: "Error de validación",
        errors: erroresValidacion,
      });
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

    logger.error("Error al crear publicación", {
      error: error.message,
      stack: error.stack,
      usuario: req.usuario.correo,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      msg: "Error al crear la publicación",
    });
  }
};

// Actualizar publicación (solo dueño o admin)
const publicacionesPut = async (req, res = response) => {
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
      // Las publicaciones de ADOPCION no deben tener lugar ni fecha
      delete datosNormalizados.lugar;
      delete datosNormalizados.fecha;
    } else if (tipoExistente === "PERDIDO" || tipoExistente === "ENCONTRADO") {
      // Las publicaciones de PERDIDO/ENCONTRADO no deben tener campos de ADOPCION
      delete datosNormalizados.afinidad;
      delete datosNormalizados.afinidadanimales;
      delete datosNormalizados.energia;
      delete datosNormalizados.castrado;
    }

    const publicacionActualizada = await Publicacion.findByIdAndUpdate(
      id,
      datosNormalizados,
      { new: true }
    ).populate("usuario", "nombre");

    res.json({
      success: true,
      msg: "Publicación actualizada exitosamente",
      publicacion: publicacionActualizada,
    });
  } catch (error) {
    logger.error("Error al actualizar publicación", {
      error: error.message,
      stack: error.stack,
      publicacionId: req.params.id,
      ip: req.ip,
    });

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

    res.status(500).json({
      success: false,
      msg: "Error al actualizar la publicación",
    });
  }
};

// Actualizar estado de publicación (solo dueño o admin)
const publicacionesEstadoPut = async (req, res = response) => {
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
    logger.error("Error al actualizar estado de publicación", {
      error: error.message,
      stack: error.stack,
      publicacionId: id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al actualizar el estado",
    });
  }
};

// Eliminar publicación (cambiar estado a INACTIVO)
const publicacionesDelete = async (req, res = response) => {
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
    logger.error("Error al eliminar publicación", {
      error: error.message,
      stack: error.stack,
      publicacionId: id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al eliminar la publicación",
    });
  }
};

// Obtener contacto de la publicación (requiere autenticación)
const obtenerContactoPublicacion = async (req, res = response) => {
  try {
    const { id } = req.params;

    // Buscar publicación activa (excluye INACTIVO)
    const publicacion = await Publicacion.findOne({
      _id: id,
      estado: { $ne: "INACTIVO" },
    }).populate("usuario", "nombre telefono correo");

    if (!publicacion) {
      return res.status(404).json({
        success: false,
        msg: "Publicación no encontrada",
      });
    }

    const contacto = {
      nombre: publicacion.usuario.nombre,
      telefono: publicacion.usuario.telefono,
      correo: publicacion.usuario.correo,
      whatsapp: publicacion.whatsapp,
    };

    res.json({
      success: true,
      contacto,
    });
  } catch (error) {
    logger.error("Error al obtener información de contacto", {
      error: error.message,
      stack: error.stack,
      publicacionId: req.params.id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al obtener información de contacto",
    });
  }
};

// Admin: ver todas las publicaciones (incluyendo INACTIVO)
const publicacionesAdminGet = async (req, res = response) => {
  try {
    const { estado, page = 1, limit = 12 } = req.query;

    const pageNum = Number(page);
    let limitNum = Number(limit);
    
    // Validar límites de paginación
    limitNum = Math.min(limitNum, 50); // Máximo 50 resultados por página
    limitNum = Math.max(limitNum, 1);  // Mínimo 1 resultado
    
    const skip = (Math.max(pageNum, 1) - 1) * limitNum;

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
      page: Math.max(pageNum, 1),
      totalPages: Math.ceil(total / limitNum),
      publicaciones,
    });
  } catch (error) {
    logger.error("Error al obtener publicaciones (Admin)", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al obtener publicaciones",
    });
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

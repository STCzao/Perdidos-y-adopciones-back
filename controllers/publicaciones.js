const { response } = require("express");
const Publicacion = require("../models/publicacion");

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
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

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
        { lugar: { $regex: search, $options: "i" } },
        { detalles: { $regex: search, $options: "i" } },
      ];
    }

    const [total, publicaciones] = await Promise.all([
      Publicacion.countDocuments(query),
      Publicacion.find(query)
        .populate("usuario", "nombre")
        .sort({ fecha: -1 })
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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

    // Normalizar todos los campos de texto (excepto whatsapp)
    const datosNormalizados = {
      tipo: normalizarTexto(body.tipo),
      nombreanimal: normalizarTexto(body.nombreanimal),
      especie: normalizarTexto(body.especie),
      raza: normalizarTexto(body.raza),
      lugar: body.lugar ? normalizarTexto(body.lugar) : undefined,
      sexo: normalizarTexto(body.sexo),
      tamaño: normalizarTexto(body.tamaño),
      color: normalizarTexto(body.color),
      edad: normalizarTexto(body.edad),
      detalles: body.detalles ? normalizarTexto(body.detalles) : undefined,
      afinidad: body.afinidad ? normalizarTexto(body.afinidad) : undefined,
      afinidadanimales: body.afinidadanimales
        ? normalizarTexto(body.afinidadanimales)
        : undefined,
      energia: body.energia ? normalizarTexto(body.energia) : undefined,
      castrado: body.castrado,
      whatsapp: body.whatsapp, // Mantener formato original
      img: body.img ? body.img.toLowerCase() : undefined,
      fecha: body.fecha,
      usuario: req.usuario._id,
    };

    const publicacion = new Publicacion(datosNormalizados);
    const publicacionDB = await publicacion.save();
    await publicacionDB.populate("usuario", "nombre");

    res.status(201).json({
      success: true,
      msg: "Publicación creada exitosamente",
      publicacion: publicacionDB,
    });
  } catch (error) {
    console.error(error);

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
    console.error(error);

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

    res.json({
      success: true,
      msg: "Estado actualizado exitosamente",
      publicacion: publicacionActualizada,
    });
  } catch (error) {
    console.error(error);
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

    res.json({
      success: true,
      msg: "Publicación eliminada correctamente",
      publicacion: publicacionEliminada,
    });
  } catch (error) {
    console.error(error);
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
    console.error(error);
    res.status(500).json({
      success: false,
      msg: "Error al obtener información de contacto",
    });
  }
};

// Admin: ver todas las publicaciones (incluyendo INACTIVO)
const publicacionesAdminGet = async (req, res = response) => {
  try {
    const { estado } = req.query;

    const query = {};
    if (estado) {
      query.estado = normalizarTexto(estado);
    }

    const [total, publicaciones] = await Promise.all([
      Publicacion.countDocuments(query),
      Publicacion.find(query)
        .populate("usuario", "nombre correo")
        .sort({ fechaCreacion: -1 }),
    ]);

    res.json({
      success: true,
      total,
      publicaciones,
    });
  } catch (error) {
    console.error(error);
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

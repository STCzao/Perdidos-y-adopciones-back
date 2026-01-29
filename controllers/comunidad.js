const { response } = require("express");
const Comunidad = require("../models/comunidad");
const logger = require("../helpers/logger");

const normalizar = (t) => (typeof t === "string" ? t.trim().toUpperCase() : t);

const comunidadGet = async (req, res = response) => {
  try {
    const comunidades = await Comunidad.find()
      .populate("usuario", "nombre img rol")
      .sort({ fechaCreacion: -1 });

    res.json({
      success: true,
      comunidades,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Error al obtener comunidad",
    });
  }
};

const comunidadGetById = async (req, res = response) => {
  try {
    const post = await Comunidad.findById(req.params.id).populate(
      "usuario",
      "nombre img rol"
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        msg: "Publicacion no encontrada",
      });
    }

    res.json({
      success: true,
      post,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Error al obtener la publicacion",
    });
  }
};

const comunidadPost = async (req, res = response) => {
  try {
    if (req.usuario.rol !== "ADMIN_ROLE") {
      return res.status(403).json({
        success: false,
        msg: "Solo el administrador puede crear",
      });
    }

    const { titulo, contenido, categoria, img } = req.body;

    const data = {
      titulo: normalizar(titulo),
      contenido,
      categoria: normalizar(categoria),
      img: img.toLowerCase(),
      usuario: req.usuario._id,
    };

    const comunidad = new Comunidad(data);
    const comunidadDB = await comunidad.save();
    await comunidadDB.populate("usuario", "nombre img rol");

    logger.info("Publicación de comunidad creada", {
      titulo: data.titulo,
      categoria: data.categoria,
      usuario: req.usuario.correo,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      comunidad: comunidadDB,
    });
  } catch (error) {
    logger.error("Error al crear publicación de comunidad", {
      error: error.message,
      stack: error.stack,
      usuario: req.usuario.correo,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al crear",
    });
  }
};

const comunidadPut = async (req, res = response) => {
  try {
    if (req.usuario.rol !== "ADMIN_ROLE") {
      return res.status(403).json({
        success: false,
        msg: "Solo el administrador puede editar",
      });
    }

    const { id } = req.params;
    const { titulo, contenido, categoria, img } = req.body;

    const data = {};

    if (titulo) data.titulo = titulo.trim().toUpperCase();
    if (contenido) data.contenido = contenido;
    if (categoria) data.categoria = categoria.trim().toUpperCase();
    if (img) data.img = img.toLowerCase();

    const editado = await Comunidad.findByIdAndUpdate(id, data, {
      new: true,
    }).populate("usuario", "nombre img rol");

    if (!editado) {
      return res.status(404).json({
        success: false,
        msg: "Publicacion no encontrada",
      });
    }

    logger.info("Publicación de comunidad editada", {
      comunidadId: id,
      usuario: req.usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      editado,
    });
  } catch (error) {
    logger.error("Error al editar publicación de comunidad", {
      error: error.message,
      stack: error.stack,
      comunidadId: req.params.id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al editar",
    });
  }
};

const comunidadDelete = async (req, res = response) => {
  try {
    if (req.usuario.rol !== "ADMIN_ROLE") {
      return res.status(403).json({
        success: false,
        msg: "Solo el administrador puede eliminar",
      });
    }

    const eliminado = await Comunidad.findByIdAndDelete(req.params.id);

    logger.warn("Publicación de comunidad eliminada", {
      comunidadId: req.params.id,
      eliminadaPor: req.usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      eliminado,
    });
  } catch (error) {
    logger.error("Error al eliminar publicación de comunidad", {
      error: error.message,
      stack: error.stack,
      comunidadId: req.params.id,
      ip: req.ip,
    });
    res.status(500).json({
      success: false,
      msg: "Error al eliminar",
    });
  }
};

module.exports = {
  comunidadGet,
  comunidadGetById,
  comunidadPost,
  comunidadPut,
  comunidadDelete,
};

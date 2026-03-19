const publicacionService = require("../service/publicaciones");

const publicacionesGet = async (req, res, next) => {
  try {
    const result = await publicacionService.getPublicaciones(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionesUsuarioGet = async (req, res, next) => {
  try {
    const result = await publicacionService.getPublicacionesUsuario({
      id: req.params.id,
      usuarioActual: req.usuario,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionGet = async (req, res, next) => {
  try {
    const result = await publicacionService.getPublicacion({ id: req.params.id });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionesPost = async (req, res, next) => {
  try {
    const result = await publicacionService.crearPublicacion({
      body: req.body,
      usuarioId: req.usuario._id,
      correo: req.usuario.correo,
      ip: req.ip,
    });
    res.status(201).json({ success: true, msg: "Publicación creada exitosamente", ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionesPut = async (req, res, next) => {
  try {
    const result = await publicacionService.actualizarPublicacion({
      id: req.params.id,
      body: req.body,
      usuarioActual: req.usuario,
    });
    res.json({ success: true, msg: "Publicación actualizada exitosamente", ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionesEstadoPut = async (req, res, next) => {
  try {
    const result = await publicacionService.cambiarEstadoPublicacion({
      id: req.params.id,
      estado: req.body.estado,
      usuarioActual: req.usuario,
      correo: req.usuario.correo,
      ip: req.ip,
    });
    res.json({ success: true, msg: "Estado actualizado exitosamente", ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionesDelete = async (req, res, next) => {
  try {
    const result = await publicacionService.eliminarPublicacion({
      id: req.params.id,
      usuarioActual: req.usuario,
      correo: req.usuario.correo,
      ip: req.ip,
    });
    res.json({ success: true, msg: "Publicación eliminada correctamente", ...result });
  } catch (error) {
    next(error);
  }
};

const obtenerContactoPublicacion = async (req, res, next) => {
  try {
    const result = await publicacionService.getContacto({ id: req.params.id });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const publicacionesAdminGet = async (req, res, next) => {
  try {
    const result = await publicacionService.getPublicacionesAdmin(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
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

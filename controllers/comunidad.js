const comunidadService = require("../service/comunidad");

const comunidadGet = async (req, res, next) => {
  try {
    const result = await comunidadService.getComunidades();
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const comunidadGetById = async (req, res, next) => {
  try {
    const result = await comunidadService.getComunidadById({ id: req.params.id });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const comunidadPost = async (req, res, next) => {
  try {
    const result = await comunidadService.crearComunidad({
      body: req.body,
      usuarioActual: req.usuario,
      ip: req.ip,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const comunidadPut = async (req, res, next) => {
  try {
    const result = await comunidadService.actualizarComunidad({
      id: req.params.id,
      body: req.body,
      usuarioActual: req.usuario,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const comunidadDelete = async (req, res, next) => {
  try {
    const result = await comunidadService.eliminarComunidad({
      id: req.params.id,
      usuarioActual: req.usuario,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  comunidadGet,
  comunidadGetById,
  comunidadPost,
  comunidadPut,
  comunidadDelete,
};

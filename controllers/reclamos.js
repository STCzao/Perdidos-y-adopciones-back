const reclamosService = require("../service/reclamos");

const reclamosHuerfanosGet = async (req, res, next) => {
  try {
    const result = await reclamosService.buscarHuerfanos(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const reclamosClusterGet = async (req, res, next) => {
  try {
    const result = await reclamosService.detalleCluster(req.params.usuarioViejoId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const reclamosAsignarPost = async (req, res, next) => {
  try {
    const result = await reclamosService.asignarPublicaciones({
      usuarioViejoId: req.body.usuarioViejoId,
      publicaciones: req.body.publicaciones,
      usuarioNuevoId: req.body.usuarioNuevo,
      adminId: req.usuario._id,
    });
    res.json({ success: true, msg: "Publicaciones reasignadas exitosamente", ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  reclamosHuerfanosGet,
  reclamosClusterGet,
  reclamosAsignarPost,
};

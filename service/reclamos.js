const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const publicacionesRepository = require("../repositories/publicacionesRepository");
const usuariosRepository = require("../repositories/usuariosRepository");
const historialReclamosRepository = require("../repositories/historialReclamosRepository");

const buscarHuerfanos = async ({ telefono, page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const { clusters, total } = await publicacionesRepository.findClustersHuerfanos({
    telefono: telefono?.trim(),
    skip,
    limit: limitNum,
  });

  return {
    clusters: clusters.map((cluster) => ({
      usuarioViejoId: cluster._id,
      cantidad: cluster.cantidad,
      primeraFecha: cluster.primeraFecha,
      ultimaFecha: cluster.ultimaFecha,
      localidades: cluster.localidades,
      tipos: cluster.tipos,
    })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

const detalleCluster = async (usuarioViejoId) => {
  const publicaciones = await publicacionesRepository.findByUsuarioId(usuarioViejoId);
  return { publicaciones };
};

const asignarPublicaciones = async ({ usuarioViejoId, publicaciones, usuarioNuevoId, adminId }) => {
  const usuarioNuevo = await usuariosRepository.findById(usuarioNuevoId);
  if (!usuarioNuevo) {
    throw new AppError("Usuario destino no encontrado", 404);
  }

  const publicacionesAReasignar = usuarioViejoId
    ? (await publicacionesRepository.findByUsuarioId(usuarioViejoId)).map((p) => String(p._id))
    : publicaciones.map(String);

  if (publicacionesAReasignar.length === 0) {
    throw new AppError("No hay publicaciones para reasignar", 400);
  }

  for (const publicacionId of publicacionesAReasignar) {
    await publicacionesRepository.findByIdAndUpdate(publicacionId, { usuario: usuarioNuevoId });
    logger.info("Publicacion reasignada por reclamo", {
      publicacionId,
      usuarioViejoId: usuarioViejoId || null,
      usuarioNuevo: usuarioNuevoId,
      adminId,
    });
  }

  const historial = historialReclamosRepository.create({
    usuarioViejoId: usuarioViejoId || null,
    publicaciones: publicacionesAReasignar,
    usuarioNuevo: usuarioNuevoId,
    resueltoPor: adminId,
  });
  await historialReclamosRepository.save(historial);

  return { publicacionesReasignadas: publicacionesAReasignar.length };
};

module.exports = {
  buscarHuerfanos,
  detalleCluster,
  asignarPublicaciones,
};

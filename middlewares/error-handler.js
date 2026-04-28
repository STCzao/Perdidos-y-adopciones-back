const logger = require("../helpers/logger");

const errorHandler = (err, req, res, next) => {
  logger.error("Error no manejado", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId: req.requestId,
    usuario: req.usuario?.correo || "No autenticado",
  });

  if (err.name === "ValidationError") {
    const errors = {};
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });

    return res.status(400).json({
      success: false,
      requestId: req.requestId,
      msg: "Error de validación",
      errors,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      requestId: req.requestId,
      msg: `Ya existe un registro con ese ${field}`,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      requestId: req.requestId,
      msg: "ID inválido",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      requestId: req.requestId,
      msg: "Token inválido",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      requestId: req.requestId,
      msg: "Token expirado",
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    requestId: req.requestId,
    msg: err.message || "Error interno del servidor",
    ...(err.errors && { errors: err.errors }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

const notFound = (req, res) => {
  logger.warn("Ruta no encontrada", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId: req.requestId,
  });

  return res.status(404).json({
    success: false,
    requestId: req.requestId,
    msg: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = {
  errorHandler,
  notFound,
};

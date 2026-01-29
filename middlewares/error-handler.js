const logger = require("../helpers/logger");

/**
 * Middleware centralizado para manejo de errores
 * Debe ser el último middleware registrado en server.js
 */
const errorHandler = (err, req, res, next) => {
  // Log del error con contexto completo
  logger.error("Error no manejado", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    usuario: req.usuario?.correo || "No autenticado",
  });

  // Errores de validación de Mongoose
  if (err.name === "ValidationError") {
    const errors = {};
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return res.status(400).json({
      success: false,
      msg: "Error de validación",
      errors,
    });
  }

  // Error de duplicado (Mongoose unique constraint)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      msg: `Ya existe un registro con ese ${field}`,
    });
  }

  // Error de CastError (ID inválido en MongoDB)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      msg: "ID inválido",
    });
  }

  // Error de JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      msg: "Token inválido",
    });
  }

  // Error de JWT expirado
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      msg: "Token expirado",
    });
  }

  // Error genérico del servidor
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    msg: err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

/**
 * Middleware para rutas no encontradas (404)
 */
const notFound = (req, res) => {
  logger.warn("Ruta no encontrada", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    msg: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = {
  errorHandler,
  notFound,
};

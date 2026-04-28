const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuario");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const { buildAccessTokenVerifyOptions } = require("../helpers/jwt-config");

const validarJWT = async (req, res, next) => {
  const token = req.header("x-token");

  if (!token) {
    return next(new AppError("No hay token en la petición", 401));
  }

  try {
    const { uid, type } = jwt.verify(
      token,
      process.env.SECRETORPRIVATEKEY,
      buildAccessTokenVerifyOptions(),
    );

    if (type !== "access") {
      return next(new AppError("Token inválido", 401));
    }

    const usuarioDB = await Usuario.findById(uid);

    if (!usuarioDB) {
      return next(new AppError("Usuario no existe en DB - Token inválido", 401));
    }

    if (!usuarioDB.estado) {
      return next(new AppError("Usuario inhabilitado - Token inválido", 401));
    }

    req.usuario = usuarioDB;
    next();
  } catch (error) {
    logger.warn("Token JWT inválido o expirado", {
      error: error.message,
      ip: req.ip,
      path: req.path,
    });
    next(error); // JsonWebTokenError y TokenExpiredError manejados en error-handler
  }
};

module.exports = {
  validarJWT,
};

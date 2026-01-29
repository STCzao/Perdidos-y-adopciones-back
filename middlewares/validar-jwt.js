const { response } = require("express");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuario");
const logger = require("../helpers/logger");

const validarJWT = async (req, res = response, next) => {
  const token = req.header("x-token");

  if (!token) {
    return res.status(401).json({
      success: false,
      msg: "No hay token en la petición",
    });
  }

  try {
    const { uid } = jwt.verify(token, process.env.SECRETORPRIVATEKEY);

    const usuarioDB = await Usuario.findById(uid);

    if (!usuarioDB) {
      return res.status(401).json({
        success: false,
        msg: "Usuario no existe en DB - Token inválido",
      });
    }

    if (!usuarioDB.estado) {
      return res.status(401).json({
        success: false,
        msg: "Usuario inhabilitado - Token inválido",
      });
    }

    req.usuario = usuarioDB;
    next();
  } catch (error) {
    logger.warn("Token JWT inválido o expirado", {
      error: error.message,
      ip: req.ip,
      path: req.path,
    });
    
    return res.status(401).json({
      success: false,
      msg: "Token no válido",
    });
  }
};

module.exports = {
  validarJWT,
};

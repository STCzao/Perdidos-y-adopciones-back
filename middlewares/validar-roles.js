const { response } = require("express");

const esAdminRole = (req, res = response, next) => {
  if (!req.usuario) {
    return res.status(500).json({
      success: false,
      msg: "Se quiere verificar el role sin validar el token primero",
    });
  }

  const { rol, nombre } = req.usuario;

  if (rol !== "ADMIN_ROLE") {
    return res.status(403).json({
      success: false,
      msg: `${nombre} no es administrador - No puede hacer esto`,
    });
  }

  next();
};

const esModeradorOAdmin = (req, res = response, next) => {
  if (!req.usuario) {
    return res.status(500).json({
      success: false,
      msg: "Se quiere verificar el role sin validar el token primero",
    });
  }

  const { rol } = req.usuario;

  if (rol !== "ADMIN_ROLE" && rol !== "MODERADOR_ROLE") {
    return res.status(403).json({
      success: false,
      msg: "No tiene permisos",
    });
  }

  next();
};

const tieneRole = (...roles) => {
  return (req, res = response, next) => {
    if (!req.usuario) {
      return res.status(500).json({
        success: false,
        msg: "Se quiere verificar el role sin validar el token primero",
      });
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        msg: `El servicio requiere uno de estos roles: ${roles}`,
      });
    }

    next();
  };
};

module.exports = {
  esAdminRole,
  esModeradorOAdmin,
  tieneRole,
};

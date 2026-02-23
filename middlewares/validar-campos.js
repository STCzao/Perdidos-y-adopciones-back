const { validationResult } = require("express-validator");

const validarCampos = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    // Normalizar al mismo formato que usa el resto del proyecto:
    // { success: false, msg: "...", errors: { campo: "mensaje" } }
    const errors = {};
    result.array().forEach(({ path, msg }) => {
      if (!errors[path]) errors[path] = msg;
    });
    return res.status(400).json({
      success: false,
      msg: "Error en los datos enviados",
      errors,
    });
  }

  next();
};

module.exports = {
  validarCampos,
};

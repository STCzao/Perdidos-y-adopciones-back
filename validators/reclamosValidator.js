const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");

const buscarHuerfanosValidator = [check("telefono").optional().trim(), validarCampos];

const detalleClusterValidator = [
  check("usuarioViejoId", "No es un ID válido").isMongoId(),
  validarCampos,
];

const asignarValidator = [
  check("usuarioNuevo", "No es un ID válido").isMongoId(),
  check("usuarioViejoId").optional().isMongoId().withMessage("No es un ID válido"),
  check("publicaciones").optional().isArray({ min: 1 }).withMessage("Debe ser un arreglo de IDs"),
  check("publicaciones.*").isMongoId().withMessage("No es un ID válido"),
  check("usuarioViejoId").custom((value, { req }) => {
    const tieneCluster = Boolean(value);
    const tieneLista = Array.isArray(req.body.publicaciones) && req.body.publicaciones.length > 0;
    if (tieneCluster === tieneLista) {
      throw new Error("Debe enviarse usuarioViejoId o publicaciones, pero no ambos ni ninguno");
    }
    return true;
  }),
  validarCampos,
];

module.exports = {
  buscarHuerfanosValidator,
  detalleClusterValidator,
  asignarValidator,
};

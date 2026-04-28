const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");

const cloudinaryImageUrl = /^https:\/\/res\.cloudinary\.com\/.+\/.+\.(jpg|jpeg|png|webp)$/i;
const esStringNoVacio = (value) => typeof value === "string" && value.trim().length > 0;

const comunidadIdValidator = [check("id", "No es un ID válido").isMongoId(), validarCampos];

const createComunidadValidator = [
  check("titulo", "El título es obligatorio").custom(esStringNoVacio),
  check("titulo").isString().withMessage("El título debe ser una cadena válida").bail().trim(),
  check("titulo", "El título debe tener entre 5 y 80 caracteres").isLength({ min: 5, max: 80 }),
  check("contenido", "El contenido es obligatorio").custom(esStringNoVacio),
  check("contenido").isString().withMessage("El contenido debe ser una cadena válida").bail().trim(),
  check("contenido", "El contenido debe tener entre 20 y 3000 caracteres").isLength({
    min: 20,
    max: 3000,
  }),
  check("categoria", "La categoría es obligatoria").custom(esStringNoVacio),
  check("categoria", "La categoría debe ser HISTORIA o ALERTA").isIn(["HISTORIA", "ALERTA"]),
  check("img", "La imagen es obligatoria").custom(esStringNoVacio),
  check("img").isString().withMessage("La imagen debe ser una URL válida").bail().trim(),
  check("img", "La URL de imagen no es válida").matches(cloudinaryImageUrl),
  validarCampos,
];

const updateComunidadValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("titulo").optional().custom(esStringNoVacio).withMessage("El título no puede estar vacío"),
  check("titulo").optional().isString().withMessage("El título debe ser una cadena válida").bail().trim(),
  check("titulo")
    .optional()
    .isLength({ min: 5, max: 80 })
    .withMessage("El título debe tener entre 5 y 80 caracteres"),
  check("contenido")
    .optional()
    .custom(esStringNoVacio)
    .withMessage("El contenido no puede estar vacío"),
  check("contenido")
    .optional()
    .isString()
    .withMessage("El contenido debe ser una cadena válida")
    .bail()
    .trim(),
  check("contenido")
    .optional()
    .isLength({ min: 20, max: 3000 })
    .withMessage("El contenido debe tener entre 20 y 3000 caracteres"),
  check("categoria")
    .optional()
    .isIn(["HISTORIA", "ALERTA"])
    .withMessage("La categoría debe ser HISTORIA o ALERTA"),
  check("img").optional().custom(esStringNoVacio).withMessage("La imagen no puede estar vacía"),
  check("img").optional().isString().withMessage("La imagen debe ser una URL válida").bail().trim(),
  check("img").optional().matches(cloudinaryImageUrl).withMessage("La URL de imagen no es válida"),
  validarCampos,
];

module.exports = {
  comunidadIdValidator,
  createComunidadValidator,
  updateComunidadValidator,
};

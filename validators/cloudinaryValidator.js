const { query } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");

const ALLOWED_CLOUDINARY_FOLDERS = ["publicaciones", "comunidad", "usuarios"];

const firmaValidator = [
  query("carpeta", "La carpeta es obligatoria")
    .exists({ values: "falsy" })
    .bail()
    .isString()
    .bail()
    .trim(),
  query("carpeta", "La carpeta no es valida").isIn(ALLOWED_CLOUDINARY_FOLDERS),
  validarCampos,
];

module.exports = {
  ALLOWED_CLOUDINARY_FOLDERS,
  firmaValidator,
};

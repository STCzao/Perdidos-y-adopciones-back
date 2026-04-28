const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");

const soloLetrasYEspacios = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
const soloDigitosTelefono = /^[0-9]{7,15}$/;
const cloudinaryUrl = /^https:\/\/res\.cloudinary\.com\/.+$/;
const esStringNoVacio = (value) => typeof value === "string" && value.trim().length > 0;

const validarCorreo = [
  check("correo", "El correo es obligatorio")
    .exists({ values: "falsy" })
    .bail()
    .isString()
    .bail()
    .trim(),
  check("correo", "Debe ser un correo válido").isEmail().normalizeEmail(),
  check("correo", "El correo no puede tener más de 100 caracteres").isLength({ max: 100 }),
];

const validarPasswordNueva = ({
  field = "password",
  requiredMessage = "La contraseña es obligatoria",
  lengthMessage = "La contraseña debe tener entre 8 y 64 caracteres",
} = {}) => [
  check(field, requiredMessage).custom(esStringNoVacio),
  check(field).isString().withMessage(requiredMessage),
  check(field, lengthMessage).isLength({ min: 8, max: 64 }),
];

const validarPasswordCredencial = ({
  field,
  requiredMessage,
  maxLengthMessage,
}) => [
  check(field, requiredMessage).custom(esStringNoVacio),
  check(field).isString().withMessage(requiredMessage),
  check(field, maxLengthMessage).isLength({ max: 128 }),
];

const validarConfirmacionPassword = ({ passwordField = "password" } = {}) => [
  check("confirmPassword", "La confirmación de contraseña es obligatoria").custom(esStringNoVacio),
  check("confirmPassword")
    .isString()
    .withMessage("La confirmación de contraseña es obligatoria"),
  check("confirmPassword").custom((value, { req }) => {
    if (value !== req.body[passwordField]) {
      throw new Error("La confirmación de contraseña no coincide");
    }
    return true;
  }),
];

const createUsuarioValidator = [
  check("nombre", "El nombre es obligatorio")
    .exists({ values: "falsy" })
    .bail()
    .isString()
    .bail()
    .trim(),
  check("nombre", "El nombre debe tener entre 3 y 40 caracteres").isLength({ min: 3, max: 40 }),
  check("nombre", "El nombre solo puede contener letras y espacios").matches(soloLetrasYEspacios),
  ...validarPasswordNueva(),
  ...validarConfirmacionPassword(),
  ...validarCorreo,
  check("telefono", "El teléfono es obligatorio")
    .exists({ values: "falsy" })
    .bail()
    .isString()
    .bail()
    .trim(),
  check("telefono", "El teléfono debe contener entre 7 y 15 dígitos").matches(soloDigitosTelefono),
  validarCampos,
];

const updateMiPerfilValidator = [
  check("nombre").optional().isString().withMessage("El nombre debe ser una cadena válida").bail().trim(),
  check("nombre")
    .optional()
    .isLength({ min: 3, max: 40 })
    .withMessage("El nombre debe tener entre 3 y 40 caracteres"),
  check("nombre")
    .optional()
    .matches(soloLetrasYEspacios)
    .withMessage("El nombre solo puede contener letras y espacios"),
  check("telefono")
    .optional()
    .isString()
    .withMessage("El teléfono debe ser una cadena válida")
    .bail()
    .trim(),
  check("telefono")
    .optional()
    .matches(soloDigitosTelefono)
    .withMessage("El teléfono debe contener entre 7 y 15 dígitos"),
  check("img").optional().isString().withMessage("La imagen debe ser una URL válida").bail().trim(),
  check("img").optional().matches(cloudinaryUrl).withMessage("La URL de imagen no es válida"),
  validarCampos,
];

const changeMiPerfilPasswordValidator = [
  ...validarPasswordCredencial({
    field: "currentPassword",
    requiredMessage: "La contraseña actual es obligatoria",
    maxLengthMessage: "La contraseña actual no puede tener más de 128 caracteres",
  }),
  ...validarPasswordNueva({
    field: "newPassword",
    requiredMessage: "La nueva contraseña es obligatoria",
    lengthMessage: "La nueva contraseña debe tener entre 8 y 64 caracteres",
  }),
  ...validarConfirmacionPassword({ passwordField: "newPassword" }),
  check("newPassword").custom((value, { req }) => {
    if (value === req.body.currentPassword) {
      throw new Error("La nueva contraseña debe ser distinta a la actual");
    }
    return true;
  }),
  validarCampos,
];

const usuarioIdValidator = [check("id", "No es un ID válido").isMongoId(), validarCampos];

const updateUsuarioValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("nombre").optional().isString().withMessage("El nombre debe ser una cadena válida").bail().trim(),
  check("nombre")
    .optional()
    .isLength({ min: 3, max: 40 })
    .withMessage("El nombre debe tener entre 3 y 40 caracteres"),
  check("nombre")
    .optional()
    .matches(soloLetrasYEspacios)
    .withMessage("El nombre solo puede contener letras y espacios"),
  check("telefono")
    .optional()
    .isString()
    .withMessage("El teléfono debe ser una cadena válida")
    .bail()
    .trim(),
  check("telefono")
    .optional()
    .matches(soloDigitosTelefono)
    .withMessage("El teléfono debe contener entre 7 y 15 dígitos"),
  check("img").optional().isString().withMessage("La imagen debe ser una URL válida").bail().trim(),
  check("img").optional().matches(cloudinaryUrl).withMessage("La URL de imagen no es válida"),
  check("password")
    .not()
    .exists()
    .withMessage("La contraseña no se puede modificar desde este endpoint"),
  validarCampos,
];

const cambiarEstadoValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("estado", "El estado debe ser un valor booleano").isBoolean().toBoolean(),
  validarCampos,
];

module.exports = {
  createUsuarioValidator,
  updateMiPerfilValidator,
  changeMiPerfilPasswordValidator,
  usuarioIdValidator,
  updateUsuarioValidator,
  cambiarEstadoValidator,
};

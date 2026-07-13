const { check, param } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");

const esStringNoVacio = (value) => typeof value === "string" && value.trim().length > 0;

const validarCorreo = (field = "correo") => [
  check(field, "El correo es obligatorio")
    .exists({ values: "falsy" })
    .bail()
    .isString()
    .bail()
    .trim(),
  check(field, "Debe ser un correo válido").isEmail().normalizeEmail(),
  check(field, "El correo no puede tener más de 100 caracteres").isLength({ max: 100 }),
];

const validarPasswordCredencial = ({
  field = "password",
  requiredMessage = "La contraseña es obligatoria",
  maxLengthMessage = "La contraseña no puede tener más de 128 caracteres",
} = {}) => [
  check(field, requiredMessage).custom(esStringNoVacio),
  check(field).isString().withMessage(requiredMessage),
  check(field, maxLengthMessage).isLength({ max: 128 }),
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

const validarConfirmacionPassword = ({
  passwordField = "password",
  confirmField = "confirmPassword",
  requiredMessage = "La confirmación de contraseña es obligatoria",
  mismatchMessage = "La confirmación de contraseña no coincide",
} = {}) => [
  check(confirmField, requiredMessage).custom(esStringNoVacio),
  check(confirmField).isString().withMessage(requiredMessage),
  check(confirmField).custom((value, { req }) => {
    if (value !== req.body[passwordField]) {
      throw new Error(mismatchMessage);
    }
    return true;
  }),
];

const validarTokenReset = [
  param("token", "El token de recuperación es obligatorio").custom(esStringNoVacio),
  param("token", "El token de recuperación no es válido").matches(/^[a-f0-9]{64}$/i),
];

const loginValidator = [
  ...validarCorreo(),
  ...validarPasswordCredencial(),
  validarCampos,
];

const forgotPasswordValidator = [...validarCorreo(), validarCampos];

const resetPasswordValidator = [
  ...validarTokenReset,
  ...validarPasswordNueva(),
  ...validarConfirmacionPassword(),
  validarCampos,
];

const googleLoginValidator = [
  check("idToken", "El idToken es obligatorio").custom(esStringNoVacio),
  check("telefono")
    .optional()
    .matches(/^[0-9]{7,15}$/)
    .withMessage("El telefono debe contener entre 7 y 15 digitos numericos"),
  validarCampos,
];

const refreshTokenValidator = [
  check("refreshToken").custom((value, { req }) => {
    const cookieToken = req.cookies?.refreshToken;
    if (!value && !cookieToken) {
      throw new Error("El refresh token es obligatorio");
    }
    if (value !== undefined && typeof value !== "string") {
      throw new Error("El refresh token debe ser una cadena válida");
    }
    return true;
  }),
  validarCampos,
];

module.exports = {
  loginValidator,
  googleLoginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
};

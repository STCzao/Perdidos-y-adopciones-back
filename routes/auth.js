const { Router } = require("express");
const { check } = require("express-validator");
const {
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
} = require("../controllers/auth");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");

const router = Router();

router.post(
  "/login",
  [
    check("correo", "Debe ser un correo valido").isEmail().normalizeEmail(),
    check("password", "La contraseña es obligatoria").not().isEmpty(),
    validarCampos,
  ],
  login,
);

router.post(
  "/forgot-password",
  [check("correo", "Debe ser un correo valido").isEmail().normalizeEmail(), validarCampos],
  forgotPassword,
);

router.post(
  "/reset-password/:token",
  [
    check("password", "La contraseña es obligatoria").not().isEmpty(),
    check("password", "La contraseña debe tener entre 8 y 64 caracteres").isLength({
      min: 8,
      max: 64,
    }),
    check("confirmPassword", "La confirmación de contraseña es obligatoria").not().isEmpty(),
    check("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("La confirmación de contraseña no coincide");
      }
      return true;
    }),
    validarCampos,
  ],
  resetPassword,
);

router.post(
  "/refresh",
  [
    check("refreshToken").custom((value, { req }) => {
      const cookieToken = req.cookies?.refreshToken;
      if (!value && !cookieToken) {
        throw new Error("El refresh token es obligatorio");
      }
      return true;
    }),
    validarCampos,
  ],
  refreshToken,
);

router.post("/logout", validarJWT, logout);
router.post("/logout-all", validarJWT, logoutAll);

module.exports = router;

const { Router } = require("express");
const { check } = require("express-validator");
const {
  login,
  forgotPassword,
  resetPassword,
  revalidarToken,
  refreshToken,
  logout,
  logoutAll,
} = require("../controllers/auth");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");

const router = Router();

// Login
router.post(
  "/login",
  [
    check("correo", "Debe ser un correo válido").isEmail(),
    check("password", "La contraseña es obligatoria").not().isEmpty(),
    validarCampos,
  ],
  login
);

// Forgot password
router.post(
  "/forgot-password",
  [check("correo", "Debe ser un correo válido").isEmail(), validarCampos],
  forgotPassword
);

// Reset password
router.post(
  "/reset-password/:token",
  [
    check("password", "La contraseña es obligatoria").not().isEmpty(),
    validarCampos,
  ],
  resetPassword
);

//Obtener usuario logueado / revalidar token
router.get("/me", validarJWT, revalidarToken);

// Renovar access token usando refresh token
router.post(
  "/refresh",
  [
    check("refreshToken", "El refresh token es obligatorio").not().isEmpty(),
    validarCampos,
  ],
  refreshToken
);

// Logout (cerrar sesión en dispositivo actual)
router.post("/logout", validarJWT, logout);

// Logout de todos los dispositivos
router.post("/logout-all", validarJWT, logoutAll);

module.exports = router;

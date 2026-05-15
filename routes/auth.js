const { Router } = require("express");
const {
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  cloudinarySignature,
} = require("../controllers/auth");
const {
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
} = require("../validators/authValidator");
const { validarJWT } = require("../middlewares/validar-jwt");

const router = Router();

router.post("/login", loginValidator, login);

router.post("/forgot-password", forgotPasswordValidator, forgotPassword);

router.post("/reset-password/:token", resetPasswordValidator, resetPassword);

router.post("/refresh", refreshTokenValidator, refreshToken);

router.get("/cloudinary-signature", validarJWT, cloudinarySignature);
router.post("/logout", validarJWT, logout);
router.post("/logout-all", validarJWT, logoutAll);

module.exports = router;

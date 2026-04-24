const { Router } = require("express");
const { check } = require("express-validator");
const {
  usuariosGet,
  usuariosPost,
  usuariosPut,
  cambiarUsuarioEstado,
  usuariosDelete,
  usuarioGet,
  usuariosDashboard,
  miPerfilGet,
  miPerfilPut,
  miPerfilPasswordPatch,
} = require("../controllers/usuarios");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");

const router = Router();

router.post(
  "/",
  [
    check("nombre", "El nombre debe tener entre 3 y 40 caracteres").isLength({
      min: 3,
      max: 40,
    }),
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
    check("correo", "El correo debe ser valido").isEmail().normalizeEmail(),
    check("correo", "El correo no puede tener mas de 100 caracteres").isLength({ max: 100 }),
    check("telefono", "El telefono debe contener entre 7 y 15 digitos").matches(
      /^[0-9]{7,15}$/,
    ),
    validarCampos,
  ],
  usuariosPost,
);

router.get("/mi-perfil", [validarJWT], miPerfilGet);

router.put(
  "/mi-perfil",
  [
    validarJWT,
    check("nombre", "El nombre debe tener entre 3 y 40 caracteres")
      .optional()
      .isLength({ min: 3, max: 40 }),
    check("telefono", "El telefono debe contener entre 7 y 15 digitos")
      .optional()
      .matches(/^[0-9]{7,15}$/),
    check("img", "La URL de imagen no es valida")
      .optional()
      .matches(/^https:\/\/res\.cloudinary\.com\/.+$/),
    validarCampos,
  ],
  miPerfilPut,
);

router.patch(
  "/mi-perfil/password",
  [
    validarJWT,
    check("currentPassword", "La contraseña actual es obligatoria").not().isEmpty(),
    check("newPassword", "La nueva contraseña debe tener entre 8 y 64 caracteres").isLength({
      min: 8,
      max: 64,
    }),
    check("confirmPassword", "La confirmación de contraseña es obligatoria").not().isEmpty(),
    check("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("La confirmación de contraseña no coincide");
      }
      return true;
    }),
    check("newPassword").custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("La nueva contraseña debe ser distinta a la actual");
      }
      return true;
    }),
    validarCampos,
  ],
  miPerfilPasswordPatch,
);

router.get("/", [validarJWT, esAdminRole], usuariosGet);

router.get(
  "/:id",
  [validarJWT, check("id", "No es un ID valido").isMongoId(), validarCampos],
  usuarioGet,
);

router.get(
  "/dashboard/:id",
  [validarJWT, check("id", "No es un ID valido").isMongoId(), validarCampos],
  usuariosDashboard,
);

router.put(
  "/:id",
  [
    validarJWT,
    check("id", "No es un ID valido").isMongoId(),
    check("nombre", "El nombre debe tener entre 3 y 40 caracteres")
      .optional()
      .isLength({ min: 3, max: 40 }),
    check("password", "La contraseña debe tener entre 8 y 64 caracteres")
      .optional()
      .isLength({ min: 8, max: 64 }),
    validarCampos,
  ],
  usuariosPut,
);

router.put(
  "/:id/estado",
  [
    validarJWT,
    esAdminRole,
    check("id", "No es un ID valido").isMongoId(),
    check("estado", "El estado debe ser un valor booleano").isBoolean().toBoolean(),
    validarCampos,
  ],
  cambiarUsuarioEstado,
);

router.delete(
  "/:id",
  [validarJWT, check("id", "No es un ID valido").isMongoId(), validarCampos],
  usuariosDelete,
);

module.exports = router;

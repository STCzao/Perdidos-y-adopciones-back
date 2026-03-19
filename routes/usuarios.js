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
} = require("../controllers/usuarios");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");

const router = Router();

// Rutas públicas - crear usuario
router.post(
  "/",
  [
    check("nombre", "El nombre debe tener entre 3 y 40 caracteres").isLength({
      min: 3,
      max: 40,
    }),
    check(
      "password",
      "La contraseña debe tener entre 8 y 64 caracteres"
    ).isLength({
      min: 8,
      max: 64,
    }),
    check("correo", "El correo debe ser válido").isEmail(),
    check("telefono", "El teléfono debe contener entre 7 y 15 dígitos").matches(/^[0-9]{7,15}$/),
    validarCampos,
  ],
  usuariosPost
);

// Rutas protegidas - Perfil personal
router.get("/mi-perfil", [validarJWT], miPerfilGet);

router.put(
  "/mi-perfil",
  [
    validarJWT,
    // Validaciones opcionales solo para los campos que se envíen
    check("nombre", "El nombre debe tener entre 3 y 40 caracteres")
      .optional()
      .isLength({ min: 3, max: 40 }),
    check("telefono", "El teléfono debe contener entre 7 y 15 dígitos")
      .optional()
      .matches(/^[0-9]{7,15}$/),
    validarCampos,
  ],
  miPerfilPut
);

// Rutas protegidas - Solo admin
router.get("/", [validarJWT, esAdminRole], usuariosGet);

router.get(
  "/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  usuarioGet
);

router.get(
  "/dashboard/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  usuariosDashboard
);

router.put(
  "/:id",
  [
    validarJWT,
    check("id", "No es un ID válido").isMongoId(),
    check("nombre", "El nombre debe tener entre 3 y 40 caracteres")
      .optional()
      .isLength({ min: 3, max: 40 }),
    check("password", "La contraseña debe tener entre 8 y 64 caracteres")
      .optional()
      .isLength({ min: 8, max: 64 }),
    validarCampos,
  ],
  usuariosPut
);

router.put(
  "/:id/estado",
  [
    validarJWT,
    esAdminRole,
    check("id", "No es un ID válido").isMongoId(),
    check("estado", "El estado debe ser un valor booleano").isBoolean().toBoolean(),
    validarCampos,
  ],
  cambiarUsuarioEstado
);

router.delete(
  "/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  usuariosDelete
);

module.exports = router;

const { Router } = require("express");
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
const {
  createUsuarioValidator,
  updateMiPerfilValidator,
  changeMiPerfilPasswordValidator,
  usuarioIdValidator,
  updateUsuarioValidator,
  cambiarEstadoValidator,
} = require("../validators/usuariosValidator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");

const router = Router();

router.post("/", createUsuarioValidator, usuariosPost);

router.get("/mi-perfil", [validarJWT], miPerfilGet);

router.put("/mi-perfil", [validarJWT, ...updateMiPerfilValidator], miPerfilPut);

router.patch(
  "/mi-perfil/password",
  [validarJWT, ...changeMiPerfilPasswordValidator],
  miPerfilPasswordPatch,
);

router.get("/", [validarJWT, esAdminRole], usuariosGet);

router.get("/dashboard/:id", [validarJWT, ...usuarioIdValidator], usuariosDashboard);

router.get("/:id", [validarJWT, ...usuarioIdValidator], usuarioGet);

router.put("/:id", [validarJWT, ...updateUsuarioValidator], usuariosPut);

router.put(
  "/:id/estado",
  [validarJWT, esAdminRole, ...cambiarEstadoValidator],
  cambiarUsuarioEstado,
);

router.delete("/:id", [validarJWT, ...usuarioIdValidator], usuariosDelete);

module.exports = router;

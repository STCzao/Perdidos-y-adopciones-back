const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");
const {
  colaboradoresPost,
  colaboradoresGet,
  colaboradorGet,
  colaboradoresExportar,
  colaboradoresEstadoPatch,
} = require("../controllers/colaboradores");
const {
  colaboradorIdValidator,
  registrarColaboradorValidator,
  estadoColaboradorValidator,
} = require("../validators/colaboradoresValidator");

const router = Router();

router.post("/", [...registrarColaboradorValidator], colaboradoresPost);
router.get("/exportar", [validarJWT, esAdminRole], colaboradoresExportar);
router.get("/", [validarJWT, esAdminRole], colaboradoresGet);
router.get("/:id", [validarJWT, esAdminRole, ...colaboradorIdValidator], colaboradorGet);
router.patch(
  "/:id/estado",
  [validarJWT, esAdminRole, ...estadoColaboradorValidator],
  colaboradoresEstadoPatch,
);

module.exports = router;

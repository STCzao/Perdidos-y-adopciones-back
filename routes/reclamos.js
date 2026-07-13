const { Router } = require("express");
const {
  reclamosHuerfanosGet,
  reclamosClusterGet,
  reclamosAsignarPost,
} = require("../controllers/reclamos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");
const {
  buscarHuerfanosValidator,
  detalleClusterValidator,
  asignarValidator,
} = require("../validators/reclamosValidator");

const router = Router();

router.get("/huerfanos", [validarJWT, esAdminRole, ...buscarHuerfanosValidator], reclamosHuerfanosGet);

router.get(
  "/huerfanos/:usuarioViejoId",
  [validarJWT, esAdminRole, ...detalleClusterValidator],
  reclamosClusterGet,
);

router.post("/asignar", [validarJWT, esAdminRole, ...asignarValidator], reclamosAsignarPost);

module.exports = router;

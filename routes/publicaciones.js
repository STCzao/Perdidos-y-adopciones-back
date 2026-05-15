const { Router } = require("express");
const { RAZAS, RAZAS_POR_ESPECIE } = require("../helpers/razas");
const {
  publicacionesGet,
  publicacionesUsuarioGet,
  publicacionGet,
  publicacionesPost,
  publicacionesPut,
  publicacionesEstadoPut,
  publicacionesDelete,
  obtenerContactoPublicacion,
  publicacionesAdminGet,
  publicacionesExportar,
} = require("../controllers/publicaciones");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");
const {
  publicacionIdValidator,
  createPublicacionValidator,
  estadoPublicacionValidator,
  updatePublicacionValidator,
} = require("../validators/publicacionesValidator");

const router = Router();

router.get("/", publicacionesGet);

router.get("/razas", (req, res) =>
  res.json({ success: true, razas: RAZAS, razasPorEspecie: RAZAS_POR_ESPECIE }),
);

router.get("/admin/exportar", [validarJWT, esAdminRole], publicacionesExportar);

router.get("/admin/todas", [validarJWT, esAdminRole], publicacionesAdminGet);

router.get("/usuario/:id", [validarJWT, ...publicacionIdValidator], publicacionesUsuarioGet);

router.get("/contacto/:id", [validarJWT, ...publicacionIdValidator], obtenerContactoPublicacion);

router.get("/:id", publicacionIdValidator, publicacionGet);

router.post("/", [validarJWT, ...createPublicacionValidator], publicacionesPost);

router.put("/:id/estado", [validarJWT, ...estadoPublicacionValidator], publicacionesEstadoPut);

router.put("/:id", [validarJWT, ...updatePublicacionValidator], publicacionesPut);

router.delete("/:id", [validarJWT, ...publicacionIdValidator], publicacionesDelete);

module.exports = router;

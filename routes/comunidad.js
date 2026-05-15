const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole, esModeradorOAdmin } = require("../middlewares/validar-roles");
const {
  comunidadIdValidator,
  createComunidadValidator,
  updateComunidadValidator,
} = require("../validators/comunidadValidator");
const {
  comunidadGet,
  comunidadGetById,
  comunidadPost,
  comunidadPut,
  comunidadDelete,
} = require("../controllers/comunidad");

const router = Router();

router.get("/", comunidadGet);
router.get("/:id", comunidadIdValidator, comunidadGetById);

router.post("/", [validarJWT, esModeradorOAdmin, ...createComunidadValidator], comunidadPost);

router.put("/:id", [validarJWT, esModeradorOAdmin, ...updateComunidadValidator], comunidadPut);

router.delete("/:id", [validarJWT, esAdminRole, ...comunidadIdValidator], comunidadDelete);

module.exports = router;

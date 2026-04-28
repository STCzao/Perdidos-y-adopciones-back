const { Router } = require("express");
const { obtenerFirma } = require("../controllers/cloudinary");
const { validarJWT } = require("../middlewares/validar-jwt");
const { firmaValidator } = require("../validators/cloudinaryValidator");

const router = Router();

router.get("/signature", [validarJWT, ...firmaValidator], obtenerFirma);

module.exports = router;

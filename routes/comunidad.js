const { Router } = require("express");
const { check } = require("express-validator");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarCampos } = require("../middlewares/validar-campos");
const { esAdminRole } = require("../middlewares/validar-roles");
const {
  comunidadGet,
  comunidadGetById,
  comunidadPost,
  comunidadPut,
  comunidadDelete,
} = require("../controllers/comunidad");

const router = Router();

router.get("/", comunidadGet);
router.get(
  "/:id",
  [check("id", "No es un ID válido").isMongoId(), validarCampos],
  comunidadGetById
);

router.post(
  "/",
  [
    validarJWT,
    esAdminRole,
    check("titulo", "El título es obligatorio").not().isEmpty(),
    check("titulo", "El título no puede tener más de 80 caracteres").isLength({ max: 80 }),
    check("contenido", "El contenido es obligatorio").not().isEmpty(),
    check("contenido", "El contenido no puede tener más de 3000 caracteres").isLength({ max: 3000 }),
    check("categoria", "La categoría debe ser HISTORIA o ALERTA").isIn(["HISTORIA", "ALERTA"]),
    check("img", "La imagen es obligatoria").not().isEmpty(),
    check("img", "La URL de imagen no es válida").matches(
      /^https:\/\/res\.cloudinary\.com\/.+\/.+\.(jpg|jpeg|png|webp)$/
    ),
    validarCampos,
  ],
  comunidadPost
);

router.put(
  "/:id",
  [
    validarJWT,
    esAdminRole,
    check("id", "No es un ID válido").isMongoId(),
    check("titulo").optional().not().isEmpty().withMessage("El título no puede estar vacío")
      .isLength({ max: 80 }).withMessage("El título no puede tener más de 80 caracteres"),
    check("contenido").optional().not().isEmpty().withMessage("El contenido no puede estar vacío")
      .isLength({ max: 3000 }).withMessage("El contenido no puede tener más de 3000 caracteres"),
    check("categoria").optional()
      .isIn(["HISTORIA", "ALERTA"]).withMessage("La categoría debe ser HISTORIA o ALERTA"),
    check("img").optional()
      .matches(/^https:\/\/res\.cloudinary\.com\/.+\/.+\.(jpg|jpeg|png|webp)$/)
      .withMessage("La URL de imagen no es válida"),
    validarCampos,
  ],
  comunidadPut
);

router.delete(
  "/:id",
  [
    validarJWT,
    esAdminRole,
    check("id", "No es un ID válido").isMongoId(),
    validarCampos,
  ],
  comunidadDelete
);

module.exports = router;

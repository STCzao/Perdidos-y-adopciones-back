const { Router } = require("express");
const { check } = require("express-validator");
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
} = require("../controllers/publicaciones");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");

const router = Router();

// Públicas - Cualquiera puede ver publicaciones activas
router.get("/", publicacionesGet);

// Individual - Pública
router.get(
  "/:id",
  [check("id", "No es un ID válido").isMongoId(), validarCampos],
  publicacionGet,
);

// Protegidas - Requieren autenticación
router.get(
  "/usuario/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  publicacionesUsuarioGet,
);

router.get(
  "/contacto/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  obtenerContactoPublicacion,
);

// Solo Admin
router.get("/admin/todas", [validarJWT, esAdminRole], publicacionesAdminGet);

// CRUD protegido
router.post(
  "/",
  [
    validarJWT,
    check("tipo", "El tipo es obligatorio").isIn([
      "PERDIDO",
      "ENCONTRADO",
      "ADOPCION",
    ]),
    check("especie", "La especie es obligatoria").isIn([
      "PERRO",
      "GATO",
      "AVE",
      "CONEJO",
      "OTRO",
    ]),

    check("raza", "La raza es obligatoria").not().isEmpty(),
    check("raza", "La raza no puede tener más de 40 caracteres").isLength({
      max: 40,
    }),

    check("nombreanimal").custom((value, { req }) => {
      if (
        (req.body.tipo === "PERDIDO" || req.body.tipo === "ADOPCION") &&
        !value
      ) {
        throw new Error(
          "El nombre del animal es obligatorio para perdidos y adopciones",
        );
      }
      return true;
    }),
    check("nombreanimal")
      .optional()
      .isLength({ max: 60 })
      .withMessage("El nombre del animal no puede tener más de 60 caracteres"),

    check("sexo", "El sexo es obligatorio").isIn([
      "MACHO",
      "HEMBRA",
      "DESCONOZCO",
    ]),
    check("tamaño", "El tamaño es obligatorio").isIn([
      "MINI",
      "PEQUEÑO",
      "MEDIANO",
      "GRANDE",
      "SIN ESPECIFICAR",
    ]),
    check("color", "El color es obligatorio").not().isEmpty(),
    check("color", "El color no puede tener más de 20 caracteres").isLength({
      max: 80,
    }),
    check("edad")
      .optional()
      .isIn(["CACHORRO", "ADULTO", "MAYOR", "SIN ESPECIFICAR"]),

    check("whatsapp", "El WhatsApp es obligatorio").not().isEmpty(),
    check("whatsapp", "El formato de WhatsApp no es válido").matches(
      /^\+?[0-9\s\-()]{10,15}$/,
    ),
    validarCampos,
  ],
  publicacionesPost,
);

router.put(
  "/:id/estado",
  [
    validarJWT,
    check("id", "No es un ID válido").isMongoId(),
    check("estado").isIn([
      "YA APARECIO",
      "EN BUSCA DE UN HOGAR",
      "ADOPTADO",
      "INACTIVO",
      "BUSCANDO A SU FAMILIA",
      "APARECIO SU FAMILIA",
      "SE BUSCA",
    ]),
    validarCampos,
  ],
  publicacionesEstadoPut,
);

router.put(
  "/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  publicacionesPut,
);

router.delete(
  "/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  publicacionesDelete,
);

module.exports = router;

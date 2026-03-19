const { Router } = require("express");
const { check } = require("express-validator");
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
} = require("../controllers/publicaciones");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { esAdminRole } = require("../middlewares/validar-roles");

const router = Router();

// Públicas - Cualquiera puede ver publicaciones activas
router.get("/", publicacionesGet);

// Catálogo de razas disponibles (para desplegable en formulario Post/Put)
router.get("/razas", (req, res) =>
  res.json({ success: true, razas: RAZAS, razasPorEspecie: RAZAS_POR_ESPECIE })
);

// Solo Admin - DEBE IR ANTES de /:id para evitar conflictos
router.get("/admin/todas", [validarJWT, esAdminRole], publicacionesAdminGet);

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

// Individual - Pública - DEBE IR AL FINAL de las rutas GET específicas
router.get(
  "/:id",
  [check("id", "No es un ID válido").isMongoId(), validarCampos],
  publicacionGet,
);

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
    check("raza", "Raza no válida, debe seleccionarse del listado").isIn(RAZAS),
    // Cross-validation: la raza debe corresponder a la especie declarada.
    // RAZAS_POR_ESPECIE tiene las mismas claves que el enum de especie,
    // por lo que basta verificar que la raza esté dentro del subarray correcto.
    check("raza").custom((raza, { req }) => {
      const especie = req.body.especie;
      if (!especie || !RAZAS_POR_ESPECIE[especie]) return true; // especie inválida ya la detecta su propio check
      if (!RAZAS_POR_ESPECIE[especie].includes(raza)) {
        throw new Error(`La raza "${raza}" no corresponde a la especie "${especie}"`);
      }
      return true;
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
    check("color", "El color no puede tener más de 50 caracteres").isLength({
      max: 50,
    }),
    
    // Edad - obligatorio para PERDIDO y ADOPCION
    check("edad").custom((value, { req }) => {
      if ((req.body.tipo === "PERDIDO" || req.body.tipo === "ADOPCION") && !value) {
        throw new Error("La edad es obligatoria para perdidos y adopciones");
      }
      if (value && !["CACHORRO", "JOVEN", "ADULTO", "MAYOR", "SIN ESPECIFICAR"].includes(value)) {
        throw new Error("La edad debe ser CACHORRO, JOVEN, ADULTO, MAYOR o SIN ESPECIFICAR");
      }
      return true;
    }),

    // Localidad - obligatorio para PERDIDO y ENCONTRADO
    check("localidad").custom((value, { req }) => {
      if ((req.body.tipo === "PERDIDO" || req.body.tipo === "ENCONTRADO") && !value) {
        throw new Error("La localidad es obligatoria para perdidos y encontrados");
      }
      return true;
    }),

    // Lugar (detalles) - obligatorio para PERDIDO y ENCONTRADO
    check("lugar").custom((value, { req }) => {
      if ((req.body.tipo === "PERDIDO" || req.body.tipo === "ENCONTRADO") && !value) {
        throw new Error("El lugar es obligatorio para perdidos y encontrados");
      }
      return true;
    }),
    check("lugar")
      .optional()
      .isLength({ max: 80 })
      .withMessage("El lugar no puede tener más de 80 caracteres"),

    // Fecha - obligatorio para PERDIDO y ENCONTRADO
    check("fecha").custom((value, { req }) => {
      if ((req.body.tipo === "PERDIDO" || req.body.tipo === "ENCONTRADO") && !value) {
        throw new Error("La fecha es obligatoria para perdidos y encontrados");
      }
      return true;
    }),

    // Campos de ADOPCION - obligatorios para ADOPCION
    check("afinidad").custom((value, { req }) => {
      if (req.body.tipo === "ADOPCION" && !value) {
        throw new Error("La afinidad es obligatoria para adopciones");
      }
      if (value && !["ALTA", "MEDIA", "BAJA", "DESCONOZCO"].includes(value)) {
        throw new Error("La afinidad debe ser ALTA, MEDIA, BAJA o DESCONOZCO");
      }
      return true;
    }),

    check("afinidadanimales").custom((value, { req }) => {
      if (req.body.tipo === "ADOPCION" && !value) {
        throw new Error("La afinidad con animales es obligatoria para adopciones");
      }
      if (value && !["ALTA", "MEDIA", "BAJA", "DESCONOZCO"].includes(value)) {
        throw new Error("La afinidad con animales debe ser ALTA, MEDIA, BAJA o DESCONOZCO");
      }
      return true;
    }),

    check("energia").custom((value, { req }) => {
      if (req.body.tipo === "ADOPCION" && !value) {
        throw new Error("El nivel de energía es obligatorio para adopciones");
      }
      if (value && !["ALTA", "MEDIA", "BAJA"].includes(value)) {
        throw new Error("El nivel de energía debe ser ALTA, MEDIA o BAJA");
      }
      return true;
    }),

    check("castrado").custom((value, { req }) => {
      if (req.body.tipo === "ADOPCION" && (value === undefined || value === null)) {
        throw new Error("El estado de castración es obligatorio para adopciones");
      }
      return true;
    }),

    check("whatsapp", "El WhatsApp es obligatorio").not().isEmpty(),
    check("whatsapp", "El formato de WhatsApp no es válido (solo números, sin +)").matches(
      /^[0-9]{10,15}$/,
    ),
    
    check("img", "La imagen es obligatoria").not().isEmpty(),
    check("img", "La URL de imagen no es válida").matches(
      /^https:\/\/res\.cloudinary\.com\/.+$/,
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
    check("estado", "El estado es obligatorio").not().isEmpty(),
    check("estado").isIn([
      "YA APARECIO",
      "EN BUSCA DE UN HOGAR",
      "ADOPTADO",
      "INACTIVO",
      "BUSCANDO A SU FAMILIA",
      "APARECIO SU FAMILIA",
      "SE BUSCA",
    ]).withMessage("Estado no válido"),
    validarCampos,
  ],
  publicacionesEstadoPut,
);

router.put(
  "/:id",
  [
    validarJWT,
    check("id", "No es un ID válido").isMongoId(),

    // Enums opcionales — si se envían, deben ser valores válidos
    check("especie")
      .optional()
      .isIn(["PERRO", "GATO", "AVE", "CONEJO", "OTRO"])
      .withMessage("Especie no válida"),

    check("raza")
      .optional()
      .isIn(RAZAS)
      .withMessage("Raza no válida, debe seleccionarse del listado"),

    check("sexo")
      .optional()
      .isIn(["MACHO", "HEMBRA", "DESCONOZCO"])
      .withMessage("Sexo no válido"),

    check("tamaño")
      .optional()
      .isIn(["MINI", "PEQUEÑO", "MEDIANO", "GRANDE", "SIN ESPECIFICAR"])
      .withMessage("Tamaño no válido"),

    check("edad")
      .optional()
      .isIn(["CACHORRO", "JOVEN", "ADULTO", "MAYOR", "SIN ESPECIFICAR"])
      .withMessage("Edad no válida"),

    check("afinidad")
      .optional()
      .isIn(["ALTA", "MEDIA", "BAJA", "DESCONOZCO"])
      .withMessage("Afinidad no válida"),

    check("afinidadanimales")
      .optional()
      .isIn(["ALTA", "MEDIA", "BAJA", "DESCONOZCO"])
      .withMessage("Afinidad con animales no válida"),

    check("energia")
      .optional()
      .isIn(["ALTA", "MEDIA", "BAJA"])
      .withMessage("Nivel de energía no válido"),

    // Strings opcionales con límite de longitud
    check("nombreanimal")
      .optional()
      .isLength({ max: 60 })
      .withMessage("El nombre del animal no puede tener más de 60 caracteres"),

    check("color")
      .optional()
      .not().isEmpty()
      .withMessage("El color no puede estar vacío")
      .isLength({ max: 50 })
      .withMessage("El color no puede tener más de 50 caracteres"),

    check("lugar")
      .optional()
      .isLength({ max: 80 })
      .withMessage("El lugar no puede tener más de 80 caracteres"),

    check("detalles")
      .optional()
      .isLength({ max: 250 })
      .withMessage("Los detalles no pueden tener más de 250 caracteres"),

    // Formato estricto para whatsapp e imagen
    check("whatsapp")
      .optional()
      .matches(/^[0-9]{10,15}$/)
      .withMessage("El formato de WhatsApp no es válido (solo números, sin +)"),

    check("img")
      .optional()
      .matches(/^https:\/\/res\.cloudinary\.com\/.+$/)
      .withMessage("La URL de imagen no es válida"),

    // Cross-validation PUT: solo se aplica cuando ambos campos llegan en el mismo body.
    // Si solo llega uno de los dos, no se puede validar la relación a nivel de ruta
    // (el controller bloquea cambios de tipo, y el enum de Mongoose es la última barrera).
    check("raza").optional().custom((raza, { req }) => {
      const especie = req.body.especie;
      if (!especie) return true; // no se está cambiando especie en este request
      if (!RAZAS_POR_ESPECIE[especie]) return true; // especie inválida detectada por su propio check
      if (!RAZAS_POR_ESPECIE[especie].includes(raza)) {
        throw new Error(`La raza "${raza}" no corresponde a la especie "${especie}"`);
      }
      return true;
    }),

    validarCampos,
  ],
  publicacionesPut,
);

router.delete(
  "/:id",
  [validarJWT, check("id", "No es un ID válido").isMongoId(), validarCampos],
  publicacionesDelete,
);

module.exports = router;

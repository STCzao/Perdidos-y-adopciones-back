const { check } = require("express-validator");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");
const { RAZAS, RAZAS_POR_ESPECIE } = require("../helpers/razas");
const { validarCampos } = require("../middlewares/validar-campos");

const TIPOS = ["PERDIDO", "ENCONTRADO", "ADOPCION"];
const ESPECIES = ["PERRO", "GATO", "AVE", "CONEJO", "OTRO"];
const SEXOS = ["MACHO", "HEMBRA", "DESCONOZCO"];
const TAMANIOS = ["MINI", "PEQUEÑO", "MEDIANO", "GRANDE", "SIN ESPECIFICAR"];
const EDADES = ["CACHORRO", "JOVEN", "ADULTO", "MAYOR", "SIN ESPECIFICAR"];
const AFINIDADES = ["ALTA", "MEDIA", "BAJA", "DESCONOZCO"];
const ENERGIAS = ["ALTA", "MEDIA", "BAJA"];
const ESTADOS = [
  "YA APARECIO",
  "EN BUSCA DE UN HOGAR",
  "ADOPTADO",
  "INACTIVO",
  "BUSCANDO A SU FAMILIA",
  "APARECIO SU FAMILIA",
  "TIENE NUEVA FAMILIA",
  "SE BUSCA",
];

const cloudinaryUrl = /^https:\/\/res\.cloudinary\.com\/.+$/;
const soloNumeros = /^[0-9]{10,15}$/;
const esStringNoVacio = (value) => typeof value === "string" && value.trim().length > 0;
const validarImgs = (requerido = false) =>
  check("imgs")
    .if((_value, { req }) => requerido || req.body.imgs !== undefined)
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error("Las imágenes deben enviarse en un arreglo");
      }
      if (value.length < 1 || value.length > 5) {
        throw new Error("Debe incluir entre 1 y 5 imágenes");
      }
      value.forEach((img) => {
        if (!esStringNoVacio(img) || !cloudinaryUrl.test(img.trim())) {
          throw new Error("Todas las imágenes deben ser URLs válidas de Cloudinary");
        }
      });
      return true;
    });

const stringRequerido = (field, etiqueta, { min, max } = {}) => {
  const reglas = [
    check(field, `${etiqueta} es obligatorio`).custom(esStringNoVacio),
    check(field)
      .isString()
      .withMessage(`${etiqueta} debe ser una cadena válida`)
      .bail()
      .trim(),
  ];

  if (min || max) {
    reglas.push(
      check(field, `${etiqueta} debe tener entre ${min} y ${max} caracteres`).isLength({
        ...(min ? { min } : {}),
        ...(max ? { max } : {}),
      }),
    );
  }

  return reglas;
};

const stringOpcional = (field, etiqueta, { min, max } = {}) => {
  const reglas = [
    check(field)
      .optional()
      .custom(esStringNoVacio)
      .withMessage(`${etiqueta} no puede estar vacío`),
    check(field)
      .optional()
      .isString()
      .withMessage(`${etiqueta} debe ser una cadena válida`)
      .bail()
      .trim(),
  ];

  if (min || max) {
    reglas.push(
      check(field)
        .optional()
        .isLength({
          ...(min ? { min } : {}),
          ...(max ? { max } : {}),
        })
        .withMessage(`${etiqueta} debe tener entre ${min} y ${max} caracteres`),
    );
  }

  return reglas;
};

const publicacionIdValidator = [check("id", "No es un ID válido").isMongoId(), validarCampos];

const createPublicacionValidator = [
  check("tipo", "El tipo es obligatorio").isIn(TIPOS),
  check("especie", "La especie es obligatoria").isIn(ESPECIES),
  ...stringRequerido("raza", "La raza"),
  check("raza", "Raza no válida, debe seleccionarse del listado").isIn(RAZAS),
  check("raza").custom((raza, { req }) => {
    const especie = req.body.especie;
    if (!especie || !RAZAS_POR_ESPECIE[especie]) return true;
    if (!RAZAS_POR_ESPECIE[especie].includes(raza)) {
      throw new Error(`La raza "${raza}" no corresponde a la especie "${especie}"`);
    }
    return true;
  }),
  check("nombreanimal").custom((value, { req }) => {
    if (["PERDIDO", "ADOPCION"].includes(req.body.tipo) && !esStringNoVacio(value)) {
      throw new Error("El nombre del animal es obligatorio para perdidos y adopciones");
    }
    return true;
  }),
  ...stringOpcional("nombreanimal", "El nombre del animal", { min: 2, max: 60 }),
  check("sexo", "El sexo es obligatorio").isIn(SEXOS),
  check("tamaño", "El tamaño es obligatorio").isIn(TAMANIOS),
  ...stringRequerido("color", "El color", { min: 2, max: 50 }),
  ...stringOpcional("detalles", "Los detalles", { min: 5, max: 250 }),
  check("edad").custom((value, { req }) => {
    if (["PERDIDO", "ADOPCION"].includes(req.body.tipo) && !value) {
      throw new Error("La edad es obligatoria para perdidos y adopciones");
    }
    if (value && !EDADES.includes(value)) {
      throw new Error("Edad no válida");
    }
    return true;
  }),
  check("localidad").custom((value, { req }) => {
    if (["PERDIDO", "ENCONTRADO"].includes(req.body.tipo) && !esStringNoVacio(value)) {
      throw new Error("La localidad es obligatoria para perdidos y encontrados");
    }
    return true;
  }),
  check("localidad")
    .optional()
    .isIn(LOCALIDADES_TUCUMAN)
    .withMessage("La localidad debe ser una opción válida de Tucumán"),
  check("lugar").custom((value, { req }) => {
    if (["PERDIDO", "ENCONTRADO"].includes(req.body.tipo) && !esStringNoVacio(value)) {
      throw new Error("El lugar es obligatorio para perdidos y encontrados");
    }
    return true;
  }),
  ...stringOpcional("lugar", "El lugar", { min: 5, max: 80 }),
  check("fecha").custom((value, { req }) => {
    if (["PERDIDO", "ENCONTRADO"].includes(req.body.tipo) && !esStringNoVacio(value)) {
      throw new Error("La fecha es obligatoria para perdidos y encontrados");
    }
    return true;
  }),
  check("fecha")
    .optional()
    .isISO8601()
    .withMessage("La fecha debe tener un formato válido (YYYY-MM-DD)"),
  check("afinidad").custom((value, { req }) => {
    if (req.body.tipo === "ADOPCION" && !value) {
      throw new Error("La afinidad es obligatoria para adopciones");
    }
    if (value && !AFINIDADES.includes(value)) {
      throw new Error("Afinidad no válida");
    }
    return true;
  }),
  check("afinidadanimales").custom((value, { req }) => {
    if (req.body.tipo === "ADOPCION" && !value) {
      throw new Error("La afinidad con animales es obligatoria para adopciones");
    }
    if (value && !AFINIDADES.includes(value)) {
      throw new Error("Afinidad con animales no válida");
    }
    return true;
  }),
  check("energia").custom((value, { req }) => {
    if (req.body.tipo === "ADOPCION" && !value) {
      throw new Error("El nivel de energía es obligatorio para adopciones");
    }
    if (value && !ENERGIAS.includes(value)) {
      throw new Error("Nivel de energía no válido");
    }
    return true;
  }),
  check("castrado").custom((value, { req }) => {
    if (req.body.tipo === "ADOPCION" && (value === undefined || value === null)) {
      throw new Error("El estado de castración es obligatorio para adopciones");
    }
    return true;
  }),
  check("castrado").optional().isBoolean().withMessage("El estado de castración debe ser booleano"),
  ...stringRequerido("whatsapp", "El WhatsApp", { min: 10, max: 15 }),
  check("whatsapp", "El formato de WhatsApp no es válido (solo números, sin +)").matches(
    soloNumeros,
  ),
  validarImgs(true),
  validarCampos,
];

const estadoPublicacionValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("estado", "El estado es obligatorio").custom(esStringNoVacio),
  check("estado").isIn(ESTADOS).withMessage("Estado no válido"),
  validarCampos,
];

const updatePublicacionValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("especie").optional().isIn(ESPECIES).withMessage("Especie no válida"),
  check("raza").optional().custom(esStringNoVacio).withMessage("La raza no puede estar vacía"),
  check("raza")
    .optional()
    .isIn(RAZAS)
    .withMessage("Raza no válida, debe seleccionarse del listado"),
  check("raza")
    .optional()
    .custom((raza, { req }) => {
      const especie = req.body.especie;
      if (!especie || !RAZAS_POR_ESPECIE[especie]) return true;
      if (!RAZAS_POR_ESPECIE[especie].includes(raza)) {
        throw new Error(`La raza "${raza}" no corresponde a la especie "${especie}"`);
      }
      return true;
    }),
  check("sexo").optional().isIn(SEXOS).withMessage("Sexo no válido"),
  check("tamaño").optional().isIn(TAMANIOS).withMessage("Tamaño no válido"),
  check("edad").optional().isIn(EDADES).withMessage("Edad no válida"),
  check("afinidad").optional().isIn(AFINIDADES).withMessage("Afinidad no válida"),
  check("afinidadanimales")
    .optional()
    .isIn(AFINIDADES)
    .withMessage("Afinidad con animales no válida"),
  check("energia").optional().isIn(ENERGIAS).withMessage("Nivel de energía no válido"),
  check("castrado").optional().isBoolean().withMessage("El estado de castración debe ser booleano"),
  check("localidad")
    .optional()
    .isIn(LOCALIDADES_TUCUMAN)
    .withMessage("La localidad debe ser una opción válida de Tucumán"),
  check("fecha")
    .optional()
    .isISO8601()
    .withMessage("La fecha debe tener un formato válido (YYYY-MM-DD)"),
  ...stringOpcional("nombreanimal", "El nombre del animal", { min: 2, max: 60 }),
  ...stringOpcional("color", "El color", { min: 2, max: 50 }),
  ...stringOpcional("lugar", "El lugar", { min: 5, max: 80 }),
  ...stringOpcional("detalles", "Los detalles", { min: 5, max: 250 }),
  ...stringOpcional("whatsapp", "El WhatsApp", { min: 10, max: 15 }),
  check("whatsapp")
    .optional()
    .matches(soloNumeros)
    .withMessage("El formato de WhatsApp no es válido (solo números, sin +)"),
  validarImgs(false),
  validarCampos,
];

module.exports = {
  publicacionIdValidator,
  createPublicacionValidator,
  estadoPublicacionValidator,
  updatePublicacionValidator,
};

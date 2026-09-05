const { check } = require("express-validator");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");
const { RAZAS, RAZAS_POR_ESPECIE } = require("../helpers/razas");
const { validarCampos } = require("../middlewares/validar-campos");

const TIPOS = ["PERDIDO", "ENCONTRADO", "ADOPCION"];
const ESPECIES = ["PERRO", "GATO", "AVE", "CONEJO", "OTRO"];
const SEXOS = ["MACHO", "HEMBRA", "DESCONOZCO"];
const TAMANIO_KEY = "tamaño";
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

const enumValidator = (field, values, requiredMessage, invalidMessage, optional = false) => {
  const validator = optional ? check(field).optional() : check(field, requiredMessage);
  return validator.isIn(values).withMessage(invalidMessage);
};

const razaValidators = (optional = false) => [
  ...(optional
    ? [
        check("raza")
          .optional()
          .custom(esStringNoVacio)
          .withMessage("La raza no puede estar vacía"),
      ]
    : stringRequerido("raza", "La raza")),
  enumValidator(
    "raza",
    RAZAS,
    "La raza es obligatoria",
    "Raza no válida, debe seleccionarse del listado",
    optional,
  ),
  check("raza")
    .if((_value, { req }) => !optional || req.body.raza !== undefined)
    .custom((raza, { req }) => {
      const especie = req.body.especie;
      if (!especie || !RAZAS_POR_ESPECIE[especie]) return true;
      if (!RAZAS_POR_ESPECIE[especie].includes(raza)) {
        throw new Error(`La raza "${raza}" no corresponde a la especie "${especie}"`);
      }
      return true;
    }),
];

const nombreAnimalValidators = (optional = false) => [
  check("nombreanimal")
    .if((_value, { req }) => !optional || req.body.nombreanimal !== undefined)
    .custom((value, { req }) => {
      if (!optional && ["PERDIDO", "ADOPCION"].includes(req.body.tipo) && !esStringNoVacio(value)) {
        throw new Error("El nombre del animal es obligatorio para perdidos y adopciones");
      }
      return true;
    }),
  ...stringOpcional("nombreanimal", "El nombre del animal", { min: 2, max: 60 }),
];

const edadValidators = (optional = false) => [
  check("edad")
    .if((_value, { req }) => !optional || req.body.edad !== undefined)
    .custom((value, { req }) => {
      if (!optional && ["PERDIDO", "ADOPCION"].includes(req.body.tipo) && !value) {
        throw new Error("La edad es obligatoria para perdidos y adopciones");
      }
      if (value && !EDADES.includes(value)) {
        throw new Error("Edad no válida");
      }
      return true;
    }),
];

const ubicacionValidators = (optional = false) => [
  check("localidad")
    .if((_value, { req }) => !optional || req.body.localidad !== undefined)
    .custom((value, { req }) => {
      if (!optional && ["PERDIDO", "ENCONTRADO"].includes(req.body.tipo) && !esStringNoVacio(value)) {
        throw new Error("La localidad es obligatoria para perdidos y encontrados");
      }
      return true;
    }),
  check("localidad")
    .optional()
    .isIn(LOCALIDADES_TUCUMAN)
    .withMessage("La localidad debe ser una opción válida de Tucumán"),
  check("lat")
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("La latitud no es válida")
    .toFloat(),
  check("lng")
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("La longitud no es válida")
    .toFloat(),
  check("lat").custom((value, { req }) => {
    const tieneLat = value !== undefined && value !== null;
    const tieneLng = req.body.lng !== undefined && req.body.lng !== null;
    if (tieneLat !== tieneLng) {
      throw new Error("La latitud y la longitud deben enviarse juntas");
    }
    return true;
  }),
  check("lugar")
    .if((_value, { req }) => !optional || req.body.lugar !== undefined)
    .custom((value, { req }) => {
      const esTipoConUbicacion = ["PERDIDO", "ENCONTRADO"].includes(req.body.tipo);
      const tieneCoordenadas = req.body.lat !== undefined && req.body.lat !== null;
      if (!optional && esTipoConUbicacion && !tieneCoordenadas && !esStringNoVacio(value)) {
        throw new Error("Debe indicar la ubicación por GPS (lat/lng) o cargar una dirección en 'lugar'");
      }
      return true;
    }),
  ...stringOpcional("lugar", "El lugar", { min: 5, max: 80 }),
  check("fecha")
    .if((_value, { req }) => !optional || req.body.fecha !== undefined)
    .custom((value, { req }) => {
      if (!optional && ["PERDIDO", "ENCONTRADO"].includes(req.body.tipo) && !esStringNoVacio(value)) {
        throw new Error("La fecha es obligatoria para perdidos y encontrados");
      }
      return true;
    }),
  check("fecha")
    .optional()
    .isISO8601()
    .withMessage("La fecha debe tener un formato válido (YYYY-MM-DD)"),
];

const adopcionValidators = (optional = false) => [
  check("afinidad")
    .if((_value, { req }) => !optional || req.body.afinidad !== undefined)
    .custom((value, { req }) => {
      if (!optional && req.body.tipo === "ADOPCION" && !value) {
        throw new Error("La afinidad es obligatoria para adopciones");
      }
      if (value && !AFINIDADES.includes(value)) {
        throw new Error("Afinidad no válida");
      }
      return true;
    }),
  check("afinidadanimales")
    .if((_value, { req }) => !optional || req.body.afinidadanimales !== undefined)
    .custom((value, { req }) => {
      if (!optional && req.body.tipo === "ADOPCION" && !value) {
        throw new Error("La afinidad con animales es obligatoria para adopciones");
      }
      if (value && !AFINIDADES.includes(value)) {
        throw new Error("Afinidad con animales no válida");
      }
      return true;
    }),
  check("energia")
    .if((_value, { req }) => !optional || req.body.energia !== undefined)
    .custom((value, { req }) => {
      if (!optional && req.body.tipo === "ADOPCION" && !value) {
        throw new Error("El nivel de energia es obligatorio para adopciones");
      }
      if (value && !ENERGIAS.includes(value)) {
        throw new Error("Nivel de energía no válido");
      }
      return true;
    }),
  check("castrado")
    .if((_value, { req }) => !optional || req.body.castrado !== undefined)
    .custom((value, { req }) => {
      if (!optional && req.body.tipo === "ADOPCION" && (value === undefined || value === null)) {
        throw new Error("El estado de castración es obligatorio para adopciones");
      }
      return true;
    }),
  check("castrado").optional().isBoolean().withMessage("El estado de castración debe ser booleano"),
];

const publicacionIdValidator = [check("id", "No es un ID válido").isMongoId(), validarCampos];

const ubicacionManualValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("lat", "La latitud es obligatoria")
    .exists({ checkNull: true })
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("La latitud no es válida")
    .toFloat(),
  check("lng", "La longitud es obligatoria")
    .exists({ checkNull: true })
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("La longitud no es válida")
    .toFloat(),
  validarCampos,
];

const createPublicacionValidator = [
  check("tipo", "El tipo es obligatorio").isIn(TIPOS),
  enumValidator("especie", ESPECIES, "La especie es obligatoria", "Especie no válida"),
  ...razaValidators(false),
  ...nombreAnimalValidators(false),
  enumValidator("sexo", SEXOS, "El sexo es obligatorio", "Sexo no válido"),
  enumValidator(TAMANIO_KEY, TAMANIOS, "El tamaño es obligatorio", "Tamaño no válido"),
  ...stringRequerido("color", "El color", { min: 2, max: 50 }),
  ...edadValidators(false),
  ...ubicacionValidators(false),
  ...adopcionValidators(false),
  ...stringOpcional("detalles", "Los detalles", { min: 5, max: 250 }),
  ...stringRequerido("whatsapp", "El WhatsApp", { min: 10, max: 15 }),
  check("whatsapp")
    .matches(soloNumeros)
    .withMessage("El formato de WhatsApp no es válido (solo números, sin +)"),
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
  enumValidator("especie", ESPECIES, "La especie es obligatoria", "Especie no válida", true),
  ...razaValidators(true),
  ...nombreAnimalValidators(true),
  enumValidator("sexo", SEXOS, "El sexo es obligatorio", "Sexo no válido", true),
  enumValidator(TAMANIO_KEY, TAMANIOS, "El tamaño es obligatorio", "Tamaño no válido", true),
  ...stringOpcional("color", "El color", { min: 2, max: 50 }),
  ...edadValidators(true),
  ...ubicacionValidators(true),
  ...adopcionValidators(true),
  ...stringOpcional("detalles", "Los detalles", { min: 5, max: 250 }),
  ...stringOpcional("whatsapp", "El WhatsApp", { min: 10, max: 15 }),
  check("whatsapp")
    .optional()
    .matches(soloNumeros)
    .withMessage("El formato de WhatsApp no es válido (solo números, sin +)"),
  validarImgs(false),
  validarCampos,
];

const prohibirCambioEnCorreccion = (campo, mensaje) =>
  check(campo).custom((value, { req }) => {
    if (Object.prototype.hasOwnProperty.call(req.body, campo)) {
      throw new Error(mensaje);
    }
    return true;
  });

const corregirTipoPublicacionValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("tipo", "El tipo es obligatorio").isIn(TIPOS),
  enumValidator("especie", ESPECIES, "La especie es obligatoria", "Especie no válida", true),
  ...razaValidators(true),
  ...nombreAnimalValidators(true),
  enumValidator("sexo", SEXOS, "El sexo es obligatorio", "Sexo no válido", true),
  enumValidator(TAMANIO_KEY, TAMANIOS, "El tamaño es obligatorio", "Tamaño no válido", true),
  ...stringOpcional("color", "El color", { min: 2, max: 50 }),
  ...edadValidators(true),
  ...ubicacionValidators(true),
  ...adopcionValidators(true),
  ...stringOpcional("detalles", "Los detalles", { min: 5, max: 250 }),
  ...stringOpcional("whatsapp", "El WhatsApp", { min: 10, max: 15 }),
  check("whatsapp")
    .optional()
    .matches(soloNumeros)
    .withMessage("El formato de WhatsApp no es válido (solo números, sin +)"),
  validarImgs(false),
  prohibirCambioEnCorreccion("estado", "El estado no puede enviarse en la corrección de tipo"),
  prohibirCambioEnCorreccion("usuario", "El usuario no puede modificarse en la corrección de tipo"),
  validarCampos,
];

module.exports = {
  publicacionIdValidator,
  ubicacionManualValidator,
  createPublicacionValidator,
  estadoPublicacionValidator,
  updatePublicacionValidator,
  corregirTipoPublicacionValidator,
};

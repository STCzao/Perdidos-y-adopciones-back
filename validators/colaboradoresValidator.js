const { check } = require("express-validator");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");
const { validarCampos } = require("../middlewares/validar-campos");
const {
  FORMAS,
  DISPONIBILIDAD_GENERAL,
  MOMENTOS,
  PREFERENCIAS_TRANSITO,
  PERIODOS_TRANSITO,
  ZONAS_TRASLADO,
  DISPONIBILIDAD_TRASLADO,
  CONDICIONES_ANIMAL_TRASLADO,
  OPCIONES_AVISTAMIENTO,
  OPCIONES_DIFUSION,
  OPCIONES_COORDINACION,
  OPCIONES_ECONOMICO,
} = require("../models/colaborador");

const soloNumeros = /^[0-9]{7,15}$/;

const incluyeForma = (req, forma) =>
  Array.isArray(req.body.formasColaboracion) && req.body.formasColaboracion.includes(forma);

const detalleValidator = (campo, opcionesPermitidas) => [
  check(`${campo}.opciones`).optional().isArray(),
  check(`${campo}.opciones.*`)
    .optional()
    .isIn(opcionesPermitidas)
    .withMessage(`Una de las opciones de ${campo} no es válida`),
  check(`${campo}.observaciones`).optional().isString().isLength({ max: 500 }),
];

const colaboradorIdValidator = [
  check("id", "No es un ID válido").isMongoId(),
  validarCampos,
];

const registrarColaboradorValidator = [
  check("nombre", "El nombre es obligatorio").isString().trim().notEmpty().isLength({ max: 100 }),
  check("telefono", "El teléfono es obligatorio y debe tener entre 7 y 15 dígitos").matches(
    soloNumeros,
  ),
  check("email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage("El email no tiene un formato válido")
    .normalizeEmail(),
  check("localidad", "La localidad es obligatoria").isIn(LOCALIDADES_TUCUMAN),
  check("barrio", "El barrio es obligatorio").isString().trim().notEmpty().isLength({ max: 100 }),
  check("direccionReferencia").optional().isString().isLength({ max: 150 }),
  check("formasColaboracion", "Debe elegir al menos una forma de colaboración").isArray({
    min: 1,
  }),
  check("formasColaboracion.*", "Forma de colaboración no válida").isIn(FORMAS),
  check("disponibilidadGeneral").optional().isIn(DISPONIBILIDAD_GENERAL),
  check("momentosDisponibilidad").optional().isArray(),
  check("momentosDisponibilidad.*").optional().isIn(MOMENTOS),
  check("aceptaContactoWhatsapp", "El campo de contacto WhatsApp es obligatorio").isBoolean(),
  check("quiereGruposWhatsapp").optional().isBoolean(),
  check("prefiereContactoIndividual").optional().isBoolean(),
  check("observacionesFinales").optional().isString().isLength({ max: 1000 }),

  check("detalleTransito.preferencia")
    .optional()
    .isIn(PREFERENCIAS_TRANSITO)
    .withMessage("La preferencia de tránsito no es válida"),
  check("detalleTransito.periodos")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Los períodos de tránsito deben ser un arreglo con al menos una opción"),
  check("detalleTransito.periodos.*")
    .optional()
    .isIn(PERIODOS_TRANSITO)
    .withMessage("Uno de los períodos de tránsito no es válido"),
  check("detalleTransito.observaciones").optional().isString().isLength({ max: 500 }),
  check("detalleTransito").custom((value, { req }) => {
    if (!incluyeForma(req, "TRANSITO")) return true;
    if (!value || typeof value !== "object") {
      throw new Error("Debe completar el detalle de tránsito");
    }
    if (!value.preferencia) {
      throw new Error("Debe indicar qué animales puede recibir en tránsito");
    }
    if (!Array.isArray(value.periodos) || value.periodos.length === 0) {
      throw new Error("Debe indicar al menos un período de tránsito");
    }
    return true;
  }),

  check("detalleTraslado.zonas")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Las zonas de traslado deben ser un arreglo con al menos una opción"),
  check("detalleTraslado.zonas.*")
    .optional()
    .isIn(ZONAS_TRASLADO)
    .withMessage("Una de las zonas de traslado no es válida"),
  check("detalleTraslado.disponibilidad")
    .optional()
    .isArray({ min: 1 })
    .withMessage("La disponibilidad de traslado debe ser un arreglo con al menos una opción"),
  check("detalleTraslado.disponibilidad.*")
    .optional()
    .isIn(DISPONIBILIDAD_TRASLADO)
    .withMessage("Una de las disponibilidades de traslado no es válida"),
  check("detalleTraslado.condicionAnimal")
    .optional()
    .isArray({ min: 1 })
    .withMessage("La condición del animal debe ser un arreglo con al menos una opción"),
  check("detalleTraslado.condicionAnimal.*")
    .optional()
    .isIn(CONDICIONES_ANIMAL_TRASLADO)
    .withMessage("Una de las condiciones del animal no es válida"),
  check("detalleTraslado.observaciones").optional().isString().isLength({ max: 500 }),
  check("detalleTraslado").custom((value, { req }) => {
    if (!incluyeForma(req, "TRASLADO")) return true;
    if (!value || typeof value !== "object") {
      throw new Error("Debe completar el detalle de traslado");
    }
    if (!Array.isArray(value.zonas) || value.zonas.length === 0) {
      throw new Error("Debe indicar al menos una zona de traslado");
    }
    if (!Array.isArray(value.disponibilidad) || value.disponibilidad.length === 0) {
      throw new Error("Debe indicar al menos una disponibilidad para traslado");
    }
    if (!Array.isArray(value.condicionAnimal) || value.condicionAnimal.length === 0) {
      throw new Error("Debe indicar en qué condición puede trasladar al animal");
    }
    return true;
  }),

  ...detalleValidator("detalleAvistamiento", OPCIONES_AVISTAMIENTO),
  check("detalleAvistamiento").custom((value, { req }) => {
    if (!incluyeForma(req, "AVISTAMIENTO")) return true;
    if (!value || !Array.isArray(value.opciones) || value.opciones.length === 0) {
      throw new Error("Debe indicar al menos una forma de ayuda para avistamiento");
    }
    return true;
  }),

  ...detalleValidator("detalleDifusion", OPCIONES_DIFUSION),
  check("detalleDifusion").custom((value, { req }) => {
    if (!incluyeForma(req, "DIFUSION")) return true;
    if (!value || !Array.isArray(value.opciones) || value.opciones.length === 0) {
      throw new Error("Debe indicar al menos una forma de ayuda para difusión");
    }
    return true;
  }),

  ...detalleValidator("detalleCoordinacion", OPCIONES_COORDINACION),
  check("detalleCoordinacion").custom((value, { req }) => {
    if (!incluyeForma(req, "COORDINACION")) return true;
    if (!value || !Array.isArray(value.opciones) || value.opciones.length === 0) {
      throw new Error("Debe indicar al menos una forma de ayuda para coordinación");
    }
    return true;
  }),

  ...detalleValidator("detalleEconomico", OPCIONES_ECONOMICO),
  check("detalleEconomico").custom((value, { req }) => {
    if (!incluyeForma(req, "ECONOMICA")) return true;
    if (!value || !Array.isArray(value.opciones) || value.opciones.length === 0) {
      throw new Error("Debe indicar al menos una forma de ayuda para colaboración económica");
    }
    return true;
  }),

  check("aceptaTerminos", "Debe aceptar los términos para continuar")
    .isBoolean()
    .custom((v) => v === true),
  validarCampos,
];

const estadoColaboradorValidator = [
  check("id", "No es un ID válido").isMongoId(),
  check("activo", "El estado activo es obligatorio").isBoolean(),
  validarCampos,
];

module.exports = {
  colaboradorIdValidator,
  registrarColaboradorValidator,
  estadoColaboradorValidator,
};

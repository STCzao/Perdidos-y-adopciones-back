const { check } = require("express-validator");
const { LOCALIDADES_TUCUMAN } = require("../helpers/localidades");
const { validarCampos } = require("../middlewares/validar-campos");
const { FORMAS, DISPONIBILIDAD_GENERAL, MOMENTOS } = require("../models/colaborador");

const soloNumeros = /^[0-9]{7,15}$/;

const detalleValidator = (campo) => [
  check(`${campo}.opciones`).optional().isArray(),
  check(`${campo}.opciones.*`).optional().isString(),
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
  check("disponibilidadGeneral", "La disponibilidad es obligatoria").isIn(
    DISPONIBILIDAD_GENERAL,
  ),
  check("momentosDisponibilidad").optional().isArray(),
  check("momentosDisponibilidad.*").optional().isIn(MOMENTOS),
  check("aceptaContactoWhatsapp", "El campo de contacto WhatsApp es obligatorio").isBoolean(),
  check("quiereGruposWhatsapp").optional().isBoolean(),
  check("prefiereContactoIndividual").optional().isBoolean(),
  check("observacionesFinales").optional().isString().isLength({ max: 1000 }),
  ...detalleValidator("detalleTransito"),
  ...detalleValidator("detalleTraslado"),
  ...detalleValidator("detalleAvistamiento"),
  ...detalleValidator("detalleDifusion"),
  ...detalleValidator("detalleCoordinacion"),
  ...detalleValidator("detalleEconomico"),
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

const ExcelJS = require("exceljs");
const AppError = require("../helpers/AppError");
const colaboradoresRepository = require("../repositories/colaboradoresRepository");

const DETALLE_MAP = {
  TRANSITO: "detalleTransito",
  TRASLADO: "detalleTraslado",
  AVISTAMIENTO: "detalleAvistamiento",
  DIFUSION: "detalleDifusion",
  COORDINACION: "detalleCoordinacion",
  ECONOMICA: "detalleEconomico",
};

const registrarColaborador = async ({ body }) => {
  const {
    nombre,
    telefono,
    email,
    localidad,
    barrio,
    direccionReferencia,
    formasColaboracion,
    disponibilidadGeneral,
    momentosDisponibilidad,
    aceptaContactoWhatsapp,
    quiereGruposWhatsapp,
    prefiereContactoIndividual,
    observacionesFinales,
    aceptaTerminos,
    detalleTransito,
    detalleTraslado,
    detalleAvistamiento,
    detalleDifusion,
    detalleCoordinacion,
    detalleEconomico,
  } = body;

  const datos = {
    nombre,
    telefono,
    email,
    localidad,
    barrio,
    direccionReferencia,
    formasColaboracion,
    disponibilidadGeneral,
    momentosDisponibilidad,
    aceptaContactoWhatsapp,
    quiereGruposWhatsapp,
    prefiereContactoIndividual,
    observacionesFinales,
    aceptaTerminos,
  };

  const detalles = {
    detalleTransito,
    detalleTraslado,
    detalleAvistamiento,
    detalleDifusion,
    detalleCoordinacion,
    detalleEconomico,
  };

  formasColaboracion.forEach((forma) => {
    const campo = DETALLE_MAP[forma];
    if (campo && detalles[campo]) datos[campo] = detalles[campo];
  });

  const colaborador = colaboradoresRepository.create(datos);
  const guardado = await colaboradoresRepository.save(colaborador);
  return { colaborador: guardado };
};

const getColaboradores = async ({ page = 1, limit = 20, localidad, forma, activo }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (localidad) query.localidad = localidad;
  if (forma) query.formasColaboracion = forma;
  if (activo !== undefined) query.activo = activo === "true";

  const [total, colaboradores] = await Promise.all([
    colaboradoresRepository.countDocuments(query),
    colaboradoresRepository.find({
      filter: query,
      sort: { fechaRegistro: -1 },
      skip,
      limit: limitNum,
    }),
  ]);

  return {
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    colaboradores,
  };
};

const getColaborador = async ({ id }) => {
  const colaborador = await colaboradoresRepository.findById(id);
  if (!colaborador) throw new AppError("Colaborador no encontrado", 404);
  return { colaborador };
};

const cambiarEstadoColaborador = async ({ id, activo }) => {
  const colaborador = await colaboradoresRepository.findById(id);
  if (!colaborador) throw new AppError("Colaborador no encontrado", 404);

  const actualizado = await colaboradoresRepository.findByIdAndUpdate(id, { activo }, { new: true });
  return { colaborador: actualizado };
};

const exportarColaboradores = async ({ localidad, forma }) => {
  const query = {};
  if (localidad) query.localidad = localidad;
  if (forma) query.formasColaboracion = forma;

  const colaboradores = await colaboradoresRepository.find({
    filter: query,
    sort: { fechaRegistro: -1 },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Colaboradores");

  worksheet.columns = [
    { header: "Nombre", key: "nombre", width: 25 },
    { header: "Teléfono", key: "telefono", width: 16 },
    { header: "Email", key: "email", width: 30 },
    { header: "Localidad", key: "localidad", width: 22 },
    { header: "Barrio", key: "barrio", width: 20 },
    { header: "Dirección referencia", key: "direccionReferencia", width: 30 },
    { header: "Tránsito", key: "TRANSITO", width: 10 },
    { header: "Traslado", key: "TRASLADO", width: 10 },
    { header: "Avistamiento", key: "AVISTAMIENTO", width: 14 },
    { header: "Difusión", key: "DIFUSION", width: 10 },
    { header: "Coordinación", key: "COORDINACION", width: 14 },
    { header: "Colaboración económica", key: "ECONOMICA", width: 20 },
    { header: "Detalle tránsito", key: "detTransito", width: 40 },
    { header: "Obs. tránsito", key: "obsTransito", width: 30 },
    { header: "Detalle traslado", key: "detTraslado", width: 40 },
    { header: "Obs. traslado", key: "obsTraslado", width: 30 },
    { header: "Detalle avistamiento", key: "detAvistamiento", width: 40 },
    { header: "Obs. avistamiento", key: "obsAvistamiento", width: 30 },
    { header: "Detalle difusión", key: "detDifusion", width: 40 },
    { header: "Obs. difusión", key: "obsDifusion", width: 30 },
    { header: "Detalle coordinación", key: "detCoordinacion", width: 40 },
    { header: "Obs. coordinación", key: "obsCoordinacion", width: 30 },
    { header: "Detalle económico", key: "detEconomico", width: 40 },
    { header: "Obs. económico", key: "obsEconomico", width: 30 },
    { header: "Disponibilidad", key: "disponibilidadGeneral", width: 22 },
    { header: "Momentos", key: "momentos", width: 35 },
    { header: "Acepta WhatsApp", key: "whatsapp", width: 14 },
    { header: "Quiere grupos WA", key: "grupos", width: 14 },
    { header: "Prefiere individual", key: "individual", width: 16 },
    { header: "Observaciones", key: "observaciones", width: 40 },
    { header: "Fecha registro", key: "fechaRegistro", width: 18 },
    { header: "Activo", key: "activo", width: 8 },
  ];

  colaboradores.forEach((c) => {
    const formas = c.formasColaboracion || [];

    worksheet.addRow({
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email || "",
      localidad: c.localidad,
      barrio: c.barrio,
      direccionReferencia: c.direccionReferencia || "",
      TRANSITO: formas.includes("TRANSITO") ? "Sí" : "NO",
      TRASLADO: formas.includes("TRASLADO") ? "Sí" : "NO",
      AVISTAMIENTO: formas.includes("AVISTAMIENTO") ? "Sí" : "NO",
      DIFUSION: formas.includes("DIFUSION") ? "Sí" : "NO",
      COORDINACION: formas.includes("COORDINACION") ? "Sí" : "NO",
      ECONOMICA: formas.includes("ECONOMICA") ? "Sí" : "NO",
      detTransito: c.detalleTransito?.opciones?.join("; ") || "",
      obsTransito: c.detalleTransito?.observaciones || "",
      detTraslado: c.detalleTraslado?.opciones?.join("; ") || "",
      obsTraslado: c.detalleTraslado?.observaciones || "",
      detAvistamiento: c.detalleAvistamiento?.opciones?.join("; ") || "",
      obsAvistamiento: c.detalleAvistamiento?.observaciones || "",
      detDifusion: c.detalleDifusion?.opciones?.join("; ") || "",
      obsDifusion: c.detalleDifusion?.observaciones || "",
      detCoordinacion: c.detalleCoordinacion?.opciones?.join("; ") || "",
      obsCoordinacion: c.detalleCoordinacion?.observaciones || "",
      detEconomico: c.detalleEconomico?.opciones?.join("; ") || "",
      obsEconomico: c.detalleEconomico?.observaciones || "",
      disponibilidadGeneral: c.disponibilidadGeneral,
      momentos: (c.momentosDisponibilidad || []).join("; "),
      whatsapp: c.aceptaContactoWhatsapp ? "Sí" : "NO",
      grupos: c.quiereGruposWhatsapp ? "Sí" : "NO",
      individual: c.prefiereContactoIndividual ? "Sí" : "NO",
      observaciones: c.observacionesFinales || "",
      fechaRegistro: c.fechaRegistro?.toLocaleDateString("es-AR"),
      activo: c.activo ? "Sí" : "NO",
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9EAD3" },
  };

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  registrarColaborador,
  getColaboradores,
  getColaborador,
  cambiarEstadoColaborador,
  exportarColaboradores,
};

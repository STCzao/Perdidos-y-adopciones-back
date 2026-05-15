const colaboradorService = require("../service/colaboradores");

const colaboradoresPost = async (req, res, next) => {
  try {
    const result = await colaboradorService.registrarColaborador({ body: req.body });
    res.status(201).json({
      success: true,
      msg: "Registro exitoso. Gracias por sumarte.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const colaboradoresGet = async (req, res, next) => {
  try {
    const result = await colaboradorService.getColaboradores(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const colaboradorGet = async (req, res, next) => {
  try {
    const result = await colaboradorService.getColaborador({ id: req.params.id });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const colaboradoresExportar = async (req, res, next) => {
  try {
    const buffer = await colaboradorService.exportarColaboradores(req.query);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="colaboradores-${Date.now()}.xlsx"`,
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const colaboradoresEstadoPatch = async (req, res, next) => {
  try {
    const result = await colaboradorService.cambiarEstadoColaborador({
      id: req.params.id,
      activo: req.body.activo,
    });
    res.json({ success: true, msg: "Estado actualizado", ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  colaboradoresPost,
  colaboradoresGet,
  colaboradorGet,
  colaboradoresExportar,
  colaboradoresEstadoPatch,
};

const usuarioService = require("../service/usuarios");

const usuariosGet = async (req, res, next) => {
  try {
    const result = await usuarioService.getUsuarios(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const usuariosPost = async (req, res, next) => {
  try {
    const result = await usuarioService.crearUsuario({
      nombre: req.body.nombre,
      correo: req.body.correo,
      password: req.body.password,
      telefono: req.body.telefono,
      ip: req.ip,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const usuariosPut = async (req, res, next) => {
  try {
    const result = await usuarioService.actualizarUsuario({
      id: req.params.id,
      datos: req.body,
      usuarioActual: req.usuario,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const cambiarUsuarioEstado = async (req, res, next) => {
  try {
    const result = await usuarioService.cambiarEstado({
      id: req.params.id,
      estado: req.body.estado,
      usuarioActual: req.usuario,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const usuariosDelete = async (req, res, next) => {
  try {
    const result = await usuarioService.eliminarUsuario({
      id: req.params.id,
      usuarioActual: req.usuario,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const usuarioGet = async (req, res, next) => {
  try {
    const result = await usuarioService.getUsuario({
      id: req.params.id,
      usuarioActual: req.usuario,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const usuariosDashboard = async (req, res, next) => {
  try {
    const result = await usuarioService.getDashboard({
      id: req.params.id,
      usuarioActual: req.usuario,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const miPerfilGet = async (req, res, next) => {
  try {
    const result = await usuarioService.getMiPerfil({ userId: req.usuario._id });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const miPerfilPut = async (req, res, next) => {
  try {
    const result = await usuarioService.actualizarMiPerfil({
      userId: req.usuario._id,
      datos: req.body,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const miPerfilPasswordPatch = async (req, res, next) => {
  try {
    const result = await usuarioService.cambiarPasswordMiPerfil({
      userId: req.usuario._id,
      correo: req.usuario.correo,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  usuariosGet,
  usuariosPost,
  usuariosPut,
  cambiarUsuarioEstado,
  usuariosDelete,
  usuarioGet,
  usuariosDashboard,
  miPerfilGet,
  miPerfilPut,
  miPerfilPasswordPatch,
};

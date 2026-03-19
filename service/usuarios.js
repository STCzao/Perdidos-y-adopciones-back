const bcryptjs = require("bcryptjs");
const Usuario = require("../models/usuario");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");

const getUsuarios = async ({ page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [total, usuarios] = await Promise.all([
    Usuario.countDocuments({}),
    Usuario.find({}).select("-password").skip(skip).limit(limitNum),
  ]);

  return { total, page: pageNum, totalPages: Math.ceil(total / limitNum), usuarios };
};

const crearUsuario = async ({ nombre, correo, password, telefono, ip }) => {
  const usuario = new Usuario({
    nombre,
    correo,
    password,
    rol: "USER_ROLE",
    telefono,
  });

  const salt = bcryptjs.genSaltSync();
  usuario.password = bcryptjs.hashSync(password, salt);
  await usuario.save();

  logger.info("Usuario registrado exitosamente", { nombre, correo, ip });

  return { usuario };
};

const actualizarUsuario = async ({ id, datos, usuarioActual }) => {
  if (usuarioActual.rol !== "ADMIN_ROLE" && usuarioActual._id.toString() !== id) {
    throw new AppError("No tiene permisos para modificar este usuario", 403);
  }

  const { _id, password, google, correo, ...resto } = datos;

  if (usuarioActual.rol !== "ADMIN_ROLE") {
    delete resto.rol;
    delete resto.estado;
  }

  if (password) {
    resto.password = bcryptjs.hashSync(password, bcryptjs.genSaltSync());
  }

  const usuario = await Usuario.findByIdAndUpdate(id, resto, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { usuario };
};

const cambiarEstado = async ({ id, estado, usuarioActual, ip }) => {
  const usuario = await Usuario.findById(id);

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  if (usuario.rol === "ADMIN_ROLE") {
    throw new AppError("No se puede cambiar el estado de un administrador", 403);
  }

  usuario.estado = estado;
  if (estado === false) {
    usuario.refreshTokens = [];
  }
  await usuario.save();

  logger.info("Estado de usuario modificado", {
    usuarioId: id,
    nuevoEstado: estado,
    modificadoPor: usuarioActual.correo,
    ip,
    tokensInvalidados: estado === false,
  });

  return { usuario };
};

const eliminarUsuario = async ({ id, usuarioActual, ip }) => {
  if (usuarioActual.rol !== "ADMIN_ROLE" && usuarioActual._id.toString() !== id) {
    throw new AppError("No tiene permisos para eliminar este usuario", 403);
  }

  if (usuarioActual._id.toString() === id) {
    const usuario = await Usuario.findByIdAndUpdate(
      id,
      { estado: false, refreshTokens: [] },
      { new: true }
    );

    logger.warn("Usuario eliminó su propia cuenta", {
      usuarioId: id,
      correo: usuarioActual.correo,
      ip,
      tokensInvalidados: true,
    });

    return { usuario, logout: true, msg: "Cuenta eliminada correctamente" };
  }

  const usuario = await Usuario.findByIdAndUpdate(
    id,
    { estado: false, refreshTokens: [] },
    { new: true }
  );

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  logger.warn("Usuario eliminado por administrador", {
    usuarioEliminado: id,
    eliminadoPor: usuarioActual.correo,
    ip,
    tokensInvalidados: true,
  });

  return { usuario, logout: false, msg: "Usuario eliminado correctamente" };
};

const getUsuario = async ({ id, usuarioActual }) => {
  if (usuarioActual.rol !== "ADMIN_ROLE" && usuarioActual._id.toString() !== id) {
    throw new AppError("No tiene permisos para ver este usuario", 403);
  }

  const usuario = await Usuario.findById(id).select("nombre correo telefono rol estado");

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { usuario };
};

const getDashboard = async ({ id, usuarioActual }) => {
  if (usuarioActual.rol !== "ADMIN_ROLE" && usuarioActual._id.toString() !== id) {
    throw new AppError("No tiene permisos para acceder a este dashboard", 403);
  }

  const usuario = await Usuario.findById(id).select("-password");

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { usuario };
};

const getMiPerfil = async ({ userId }) => {
  const usuario = await Usuario.findById(userId).select("-password");

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { usuario };
};

const actualizarMiPerfil = async ({ userId, datos }) => {
  const { nombre, telefono, password, correo, rol, ...camposNoPermitidos } = datos;

  if (password !== undefined) {
    throw new AppError("Para cambiar la contraseña use el endpoint específico", 400, {
      password: "La contraseña no se puede modificar desde este endpoint",
    });
  }

  const camposNoPermitidosKeys = Object.keys(camposNoPermitidos);
  if (camposNoPermitidosKeys.length > 0) {
    throw new AppError(
      `Campos no permitidos para actualización: ${camposNoPermitidosKeys.join(", ")}`,
      400,
      { general: "Solo se permiten actualizar nombre y teléfono" }
    );
  }

  if (correo !== undefined) {
    throw new AppError("No se puede modificar el correo electrónico", 400, {
      correo: "El correo electrónico no se puede modificar",
    });
  }

  const updateData = {};

  if (nombre !== undefined) {
    const nombreTrimmed = nombre.trim();
    if (!nombreTrimmed)
      throw new AppError("El nombre es obligatorio", 400, { nombre: "El nombre es obligatorio" });
    if (nombreTrimmed.length < 3)
      throw new AppError("El nombre debe tener al menos 3 caracteres", 400, { nombre: "El nombre debe tener al menos 3 caracteres" });
    if (nombreTrimmed.length > 40)
      throw new AppError("El nombre no puede tener más de 40 caracteres", 400, { nombre: "El nombre no puede tener más de 40 caracteres" });
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombreTrimmed))
      throw new AppError("El nombre solo puede contener letras y espacios", 400, { nombre: "El nombre solo puede contener letras y espacios" });
    updateData.nombre = nombreTrimmed;
  }

  if (telefono !== undefined) {
    const telefonoTrimmed = telefono.trim();
    if (!telefonoTrimmed)
      throw new AppError("El teléfono es obligatorio", 400, { telefono: "El teléfono es obligatorio" });
    if (!/^[0-9]{7,15}$/.test(telefonoTrimmed))
      throw new AppError("El teléfono debe contener entre 7 y 15 dígitos", 400, { telefono: "El teléfono debe contener entre 7 y 15 dígitos" });
    updateData.telefono = telefonoTrimmed;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No hay cambios válidos para guardar", 400, {
      general: "No se proporcionaron campos válidos para actualizar",
    });
  }

  const usuario = await Usuario.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password -resetToken -resetTokenExp");

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return { usuario, msg: "Perfil actualizado exitosamente" };
};

module.exports = {
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstado,
  eliminarUsuario,
  getUsuario,
  getDashboard,
  getMiPerfil,
  actualizarMiPerfil,
};

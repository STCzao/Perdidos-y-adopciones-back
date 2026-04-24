const bcryptjs = require("bcryptjs");
const Usuario = require("../models/usuario");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");

const normalizarNombre = (nombre) => nombre.trim().replace(/\s+/g, " ");
const normalizarCorreo = (correo) => correo.trim().toLowerCase();
const normalizarTelefono = (telefono) => telefono.trim();
const normalizarImg = (img) => img.trim().toLowerCase();

const enmascararIp = (ip = "") => {
  if (!ip) return "No disponible";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 2).join(":")}:***`;
  const partes = ip.split(".");
  if (partes.length === 4) return `${partes[0]}.${partes[1]}.*.*`;
  return "***";
};

const resumirDispositivo = (device = "Desconocido") => device.slice(0, 80);

const construirPerfilSeguro = (usuario) => {
  const usuarioPlano = usuario.toJSON();
  const sesiones = (usuario.refreshTokens || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map((session, index) => ({
      id: `${usuario.id || usuario._id}-session-${index + 1}`,
      dispositivo: resumirDispositivo(session.device),
      ip: enmascararIp(session.ip),
      creadaEn: session.createdAt || null,
    }));

  return {
    usuario: usuarioPlano,
    seguridad: {
      sesionesActivas: sesiones.length,
      sesiones,
      passwordResetPendiente: Boolean(usuario.resetToken && usuario.resetTokenExp > new Date()),
      metodosDisponibles: {
        editarPerfil: true,
        cambiarPassword: true,
        cambiarCorreo: false,
      },
    },
  };
};

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
    nombre: normalizarNombre(nombre),
    correo: normalizarCorreo(correo),
    password,
    rol: "USER_ROLE",
    telefono: normalizarTelefono(telefono),
  });

  const salt = bcryptjs.genSaltSync();
  usuario.password = bcryptjs.hashSync(password, salt);
  await usuario.save();

  logger.info("Usuario registrado exitosamente", {
    nombre: usuario.nombre,
    correo: usuario.correo,
    ip,
  });

  return { usuario };
};

const actualizarUsuario = async ({ id, datos, usuarioActual }) => {
  if (usuarioActual.rol !== "ADMIN_ROLE" && usuarioActual._id.toString() !== id) {
    throw new AppError("No tiene permisos para modificar este usuario", 403);
  }

  const { _id, password, google, correo, nombre, telefono, img, ...resto } = datos;

  if (usuarioActual.rol !== "ADMIN_ROLE") {
    delete resto.rol;
    delete resto.estado;
  }

  if (nombre) resto.nombre = normalizarNombre(nombre);
  if (telefono) resto.telefono = normalizarTelefono(telefono);
  if (img) resto.img = normalizarImg(img);

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
      { new: true },
    );

    logger.warn("Usuario elimino su propia cuenta", {
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
    { new: true },
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

  const usuario = await Usuario.findById(id).select("nombre correo telefono rol estado img");

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
  const usuario = await Usuario.findById(userId);

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return construirPerfilSeguro(usuario);
};

const actualizarMiPerfil = async ({ userId, datos, ip }) => {
  const {
    nombre,
    telefono,
    img,
    password,
    correo,
    rol,
    refreshTokens,
    resetToken,
    resetTokenExp,
    estado,
    ...camposNoPermitidos
  } = datos;

  if (password !== undefined) {
    throw new AppError("Para cambiar la contraseña use el endpoint especifico", 400, {
      password: "La contraseña no se puede modificar desde este endpoint",
    });
  }

  const camposNoPermitidosKeys = Object.keys(camposNoPermitidos);
  if (camposNoPermitidosKeys.length > 0) {
    throw new AppError(
      `Campos no permitidos para actualizacion: ${camposNoPermitidosKeys.join(", ")}`,
      400,
      { general: "Solo se permiten actualizar nombre, telefono e imagen" },
    );
  }

  if (
    correo !== undefined ||
    rol !== undefined ||
    refreshTokens !== undefined ||
    resetToken !== undefined ||
    resetTokenExp !== undefined ||
    estado !== undefined
  ) {
    throw new AppError("No se permite modificar campos sensibles desde el perfil", 400, {
      general: "No se permite modificar correo, rol, estado ni credenciales sensibles",
    });
  }

  const updateData = {};

  if (nombre !== undefined) {
    const nombreTrimmed = nombre.trim();
    if (!nombreTrimmed) {
      throw new AppError("El nombre es obligatorio", 400, { nombre: "El nombre es obligatorio" });
    }
    if (nombreTrimmed.length < 3) {
      throw new AppError("El nombre debe tener al menos 3 caracteres", 400, {
        nombre: "El nombre debe tener al menos 3 caracteres",
      });
    }
    if (nombreTrimmed.length > 40) {
      throw new AppError("El nombre no puede tener mas de 40 caracteres", 400, {
        nombre: "El nombre no puede tener mas de 40 caracteres",
      });
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombreTrimmed)) {
      throw new AppError("El nombre solo puede contener letras y espacios", 400, {
        nombre: "El nombre solo puede contener letras y espacios",
      });
    }
    updateData.nombre = normalizarNombre(nombreTrimmed);
  }

  if (telefono !== undefined) {
    const telefonoTrimmed = telefono.trim();
    if (!telefonoTrimmed) {
      throw new AppError("El telefono es obligatorio", 400, {
        telefono: "El telefono es obligatorio",
      });
    }
    if (!/^[0-9]{7,15}$/.test(telefonoTrimmed)) {
      throw new AppError("El telefono debe contener entre 7 y 15 digitos", 400, {
        telefono: "El telefono debe contener entre 7 y 15 digitos",
      });
    }
    updateData.telefono = normalizarTelefono(telefonoTrimmed);
  }

  if (img !== undefined) {
    const imgTrimmed = img.trim();
    if (!imgTrimmed) {
      throw new AppError("La imagen es obligatoria", 400, {
        img: "La imagen no puede estar vacia",
      });
    }
    if (!/^https:\/\/res\.cloudinary\.com\/.+$/.test(imgTrimmed)) {
      throw new AppError("La URL de imagen no es valida", 400, {
        img: "La imagen debe pertenecer a Cloudinary",
      });
    }
    updateData.img = normalizarImg(imgTrimmed);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No hay cambios validos para guardar", 400, {
      general: "No se proporcionaron campos validos para actualizar",
    });
  }

  const usuario = await Usuario.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  logger.info("Perfil actualizado", {
    userId,
    camposActualizados: Object.keys(updateData),
    ip,
  });

  return { ...construirPerfilSeguro(usuario), msg: "Perfil actualizado exitosamente" };
};

const cambiarPasswordMiPerfil = async ({ userId, correo, currentPassword, newPassword, ip }) => {
  const usuario = await Usuario.findById(userId);

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const passwordValida = bcryptjs.compareSync(currentPassword, usuario.password);
  if (!passwordValida) {
    logger.warn("Intento fallido de cambio de contraseña", { userId, correo, ip });
    throw new AppError("La contraseña actual es incorrecta", 400, {
      currentPassword: "La contraseña actual es incorrecta",
    });
  }

  if (bcryptjs.compareSync(newPassword, usuario.password)) {
    throw new AppError("La nueva contraseña debe ser distinta a la actual", 400, {
      newPassword: "La nueva contraseña debe ser distinta a la actual",
    });
  }

  usuario.password = bcryptjs.hashSync(newPassword, bcryptjs.genSaltSync());
  usuario.refreshTokens = [];
  usuario.resetToken = undefined;
  usuario.resetTokenExp = undefined;
  await usuario.save();

  logger.warn("Contraseña actualizada desde perfil", {
    userId,
    correo,
    ip,
    sesionesInvalidadas: true,
  });

  return {
    msg: "Contraseña actualizada correctamente. Se invalidaron las sesiones persistidas.",
  };
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
  cambiarPasswordMiPerfil,
};

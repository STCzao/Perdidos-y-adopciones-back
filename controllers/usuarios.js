const { response } = require("express");
const bcryptjs = require("bcryptjs");
const Usuario = require("../models/usuario");
const logger = require("../helpers/logger");

// ----------------- OBTENER USUARIOS ---------------------
const usuariosGet = async (req, res = response, next) => {
  try {
    const usuarios = await Usuario.find({}).select("-password");
    res.json({ success: true, total: usuarios.length, usuarios });
  } catch (error) {
    return next(error);
  }
};

// ----------------- CREAR USUARIO ------------------------
const usuariosPost = async (req, res = response, next) => {
  const { nombre, correo, password, rol, telefono } = req.body;

  try {
    // Ignorar el rol del body — todos los registros son USER_ROLE por defecto
    const usuario = new Usuario({
      nombre,
      correo,
      password,
      rol: "USER_ROLE",
      telefono,
    });

    // Hash de la contraseña
    const salt = bcryptjs.genSaltSync();
    usuario.password = bcryptjs.hashSync(password, salt);

    await usuario.save();
    
    logger.info("Usuario registrado exitosamente", {
      nombre,
      correo,
      ip: req.ip,
    });
    
    res.status(201).json({ success: true, usuario });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: `El correo ${correo} ya está registrado`,
        errors: {
          correo: `El correo ${correo} ya está registrado`,
        },
      });
    }

    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({
        success: false,
        msg: "Error de validación",
        errors,
      });
    }

    return next(error);
  }
};

// ACTUALIZAR USUARIO 
const usuariosPut = async (req, res = response, next) => {
  const { id } = req.params;
  const { _id, password, google, correo, ...resto } = req.body;

  if (req.usuario.rol !== "ADMIN_ROLE" && req.usuario._id.toString() !== id) {
    return res
      .status(403)
      .json({ success: false, msg: "No tiene permisos para modificar este usuario" });
  }

  // Evitar escalada de privilegios: solo admins pueden cambiar rol y estado
  if (req.usuario.rol !== "ADMIN_ROLE") {
    delete resto.rol;
    delete resto.estado;
  }

  try {
    if (password) {
      // La ruta valida el formato con check().isLength() — aquí solo se hashea
      resto.password = bcryptjs.hashSync(password, bcryptjs.genSaltSync());
    }

    const usuario = await Usuario.findByIdAndUpdate(id, resto, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!usuario) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ success: false, msg: "Error de validación", errors });
    }
    return next(error);
  }
};

const cambiarUsuarioEstado = async (req, res = response, next) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        msg: "Usuario no encontrado",
      });
    }

    if (usuario.rol === "ADMIN_ROLE") {
      return res.status(403).json({
        success: false,
        msg: "No se puede cambiar el estado de un administrador",
      });
    }

    usuario.estado = estado;

    // Si se desactiva usuario, invalidar todos sus tokens
    if (estado === false) {
      usuario.refreshTokens = [];
    }

    await usuario.save();

    logger.info("Estado de usuario modificado", {
      usuarioId: id,
      nuevoEstado: estado,
      modificadoPor: req.usuario.correo,
      ip: req.ip,
      tokensInvalidados: estado === false,
    });

    res.json({ success: true, usuario });
  } catch (error) {
    return next(error);
  }
};

const usuariosDelete = async (req, res = response, next) => {
  const { id } = req.params;

  // Permitir que los usuarios eliminen su propia cuenta O que los admins eliminen cualquier cuenta
  if (req.usuario.rol !== "ADMIN_ROLE" && req.usuario._id.toString() !== id) {
    return res
      .status(403)
      .json({ success: false, msg: "No tiene permisos para eliminar este usuario" });
  }

  try {
    // Si el usuario se está eliminando a sí mismo, cerrar sesión
    if (req.usuario._id.toString() === id) {
      const usuario = await Usuario.findByIdAndUpdate(
        id,
        { estado: false, refreshTokens: [] },
        { new: true }
      );

      logger.warn("Usuario eliminó su propia cuenta", {
        usuarioId: id,
        correo: req.usuario.correo,
        ip: req.ip,
        tokensInvalidados: true,
      });

      return res.json({
        success: true,
        msg: "Cuenta eliminada correctamente",
        usuario,
        logout: true,
      });
    }

    // Si es admin eliminando a otro usuario
    const usuario = await Usuario.findByIdAndUpdate(
      id,
      { estado: false, refreshTokens: [] },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    logger.warn("Usuario eliminado por administrador", {
      usuarioEliminado: id,
      eliminadoPor: req.usuario.correo,
      ip: req.ip,
      tokensInvalidados: true,
    });

    res.json({
      success: true,
      msg: "Usuario eliminado correctamente",
      usuario,
      logout: false,
    });
  } catch (error) {
    return next(error);
  }
};

// ----------------- OBTENER USUARIO POR ID ----------------
const usuarioGet = async (req, res = response, next) => {
  try {
    const { id } = req.params;

    if (req.usuario.rol !== "ADMIN_ROLE" && req.usuario._id.toString() !== id) {
      return res
        .status(403)
        .json({ success: false, msg: "No tiene permisos para ver este usuario" });
    }

    const usuario = await Usuario.findById(id).select(
      "nombre correo telefono rol estado"
    );

    if (!usuario) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario });
  } catch (error) {
    return next(error);
  }
};

// ----------------- DASHBOARD USUARIO -------------------
const usuariosDashboard = async (req, res = response, next) => {
  try {
    const { id } = req.params;

    if (req.usuario.rol !== "ADMIN_ROLE" && req.usuario._id.toString() !== id) {
      return res
        .status(403)
        .json({ success: false, msg: "No tiene permisos para acceder a este dashboard" });
    }

    const usuario = await Usuario.findById(id).select("-password");

    if (!usuario) {
      return res.status(404).json({ success: false, msg: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario });
  } catch (error) {
    return next(error);
  }
};

// ----------------- PERFIL PROPIO ----------------------
const miPerfilGet = async (req, res = response, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select("-password");

    if (!usuario) {
      return res.status(404).json({
        success: false,
        msg: "Usuario no encontrado",
      });
    }

    // Nota: validarJWT ya rechaza usuarios inactivos — este punto es siempre estado=true
    return res.json({
      success: true,
      usuario,
    });
  } catch (error) {
    return next(error);
  }
};

const miPerfilPut = async (req, res = response, next) => {
  try {
    // Solo permitir nombre y teléfono - ignorar otros campos
    const { nombre, telefono, password, correo, rol, ...camposNoPermitidos } =
      req.body;

    // Rechazar si se intenta cambiar la contraseña por esta ruta
    if (password !== undefined) {
      return res.status(400).json({
        success: false,
        msg: "Para cambiar la contraseña use el endpoint específico",
        errors: {
          password: "La contraseña no se puede modificar desde este endpoint",
        },
      });
    }

    // Rechazar si se envían campos no permitidos
    const camposNoPermitidosKeys = Object.keys(camposNoPermitidos);
    if (camposNoPermitidosKeys.length > 0) {
      return res.status(400).json({
        success: false,
        msg: `Campos no permitidos para actualización: ${camposNoPermitidosKeys.join(
          ", "
        )}`,
        errors: {
          general: `Solo se permiten actualizar nombre y teléfono`,
        },
      });
    }

    // Rechazar si se intenta modificar correo o rol
    if (correo !== undefined) {
      return res.status(400).json({
        success: false,
        msg: "No se puede modificar el correo electrónico",
        errors: {
          correo: "El correo electrónico no se puede modificar",
        },
      });
    }

    if (rol !== undefined && req.usuario.rol !== "ADMIN_ROLE") {
      return res.status(403).json({
        success: false,
        msg: "No tiene permisos para cambiar el rol",
        errors: {
          rol: "No puede cambiar su rol",
        },
      });
    }

    const updateData = {};

    // Validar y agregar nombre si se envió
    if (nombre !== undefined) {
      const nombreTrimmed = nombre.trim();

      if (!nombreTrimmed) {
        return res.status(400).json({
          success: false,
          msg: "El nombre es obligatorio",
          errors: { nombre: "El nombre es obligatorio" },
        });
      }
      if (nombreTrimmed.length < 3) {
        return res.status(400).json({
          success: false,
          msg: "El nombre debe tener al menos 3 caracteres",
          errors: { nombre: "El nombre debe tener al menos 3 caracteres" },
        });
      }
      if (nombreTrimmed.length > 40) {
        return res.status(400).json({
          success: false,
          msg: "El nombre no puede tener más de 40 caracteres",
          errors: { nombre: "El nombre no puede tener más de 40 caracteres" },
        });
      }
      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombreTrimmed)) {
        return res.status(400).json({
          success: false,
          msg: "El nombre solo puede contener letras y espacios",
          errors: { nombre: "El nombre solo puede contener letras y espacios" },
        });
      }
      updateData.nombre = nombreTrimmed;
    }

    // Validar y agregar teléfono si se envió
    if (telefono !== undefined) {
      const telefonoTrimmed = telefono.trim();

      if (!telefonoTrimmed) {
        return res.status(400).json({
          success: false,
          msg: "El teléfono es obligatorio",
          errors: { telefono: "El teléfono es obligatorio" },
        });
      }
      if (!/^[0-9]{7,15}$/.test(telefonoTrimmed)) {
        return res.status(400).json({
          success: false,
          msg: "El teléfono debe contener entre 7 y 15 dígitos",
          errors: {
            telefono: "El teléfono debe contener entre 7 y 15 dígitos",
          },
        });
      }
      updateData.telefono = telefonoTrimmed;
    }

    // Si no hay campos válidos para actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        msg: "No hay cambios válidos para guardar",
        errors: {
          general: "No se proporcionaron campos válidos para actualizar",
        },
      });
    }

    // Actualizar usuario
    const usuario = await Usuario.findByIdAndUpdate(
      req.usuario._id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password -resetToken -resetTokenExp");

    if (!usuario) {
      return res.status(404).json({
        success: false,
        msg: "Usuario no encontrado",
      });
    }

    res.json({
      success: true,
      usuario,
      msg: "Perfil actualizado exitosamente",
    });
  } catch (error) {
    // Manejar error de duplicado de correo (aunque no debería pasar)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: "El correo electrónico ya está en uso",
        errors: { correo: "El correo electrónico ya está en uso" },
      });
    }

    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({
        success: false,
        msg: "Error de validación de datos",
        errors,
      });
    }

    return next(error);
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
};

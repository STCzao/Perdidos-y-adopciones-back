const { response } = require("express");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuario");
const { generarJWT, generarAccessToken, generarRefreshToken } = require("../helpers/generar-jwt");
const { enviarEmail } = require("../helpers/enviar-mails");
const logger = require("../helpers/logger");

// ------------------------- LOGIN -------------------------
const login = async (req, res = response) => {
  const { correo, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ correo });
    if (!usuario || !usuario.estado) {
      logger.warn("Intento de login fallido - Usuario no existe o inactivo", {
        correo,
        ip: req.ip,
      });
      
      return res.status(400).json({
        msg: "Correo o contraseña incorrectos",
        errors: {
          correo: "Correo o contraseña incorrectos",
          password: "Correo o contraseña incorrectos",
        },
      });
    }

    const validPassword = bcryptjs.compareSync(password, usuario.password);
    if (!validPassword) {
      logger.warn("Intento de login fallido - Contraseña incorrecta", {
        correo,
        ip: req.ip,
      });
      
      return res.status(400).json({
        msg: "Correo o contraseña incorrectos",
        errors: {
          correo: "Correo o contraseña incorrectos",
          password: "Correo o contraseña incorrectos",
        },
      });
    }

    // Generar access token (30min) y refresh token (30 días)
    const [accessToken, refreshToken] = await Promise.all([
      generarAccessToken(usuario.id),
      generarRefreshToken(usuario.id),
    ]);

    // Guardar refresh token en DB
    usuario.refreshTokens = usuario.refreshTokens || [];
    usuario.refreshTokens.push({
      token: refreshToken,
      device: req.headers["user-agent"] || "Unknown",
      ip: req.ip,
    });

    // Limitar a 5 dispositivos activos máximo
    if (usuario.refreshTokens.length > 5) {
      usuario.refreshTokens = usuario.refreshTokens.slice(-5);
    }

    await usuario.save();
    
    logger.info("Login exitoso", {
      correo,
      nombre: usuario.nombre,
      ip: req.ip,
      dispositivosActivos: usuario.refreshTokens.length,
    });
    
    res.json({ 
      success: true,
      usuario, 
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Error en login", {
      error: error.message,
      stack: error.stack,
      correo,
      ip: req.ip,
    });
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ----------------- FORGOT PASSWORD ----------------------
const forgotPassword = async (req, res = response) => {
  const { correo } = req.body;

  try {
    const usuario = await Usuario.findOne({ correo });
    if (!usuario) {
      logger.warn("Solicitud de recuperación para correo no registrado", {
        correo,
        ip: req.ip,
      });
      
      return res.status(400).json({
        msg: "No existe un usuario con ese correo",
        errors: {
          correo: "No existe un usuario con ese correo",
        },
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    usuario.resetToken = token;
    usuario.resetTokenExp = Date.now() + 3600000; // 1 hora
    await usuario.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await enviarEmail(
      usuario.correo,
      "Recuperar contraseña",
      `<p>Hola ${usuario.nombre},</p>
       <p>Haz click en el siguiente enlace para restablecer tu contraseña:</p>
       <a href="${resetUrl}" target="_blank">${resetUrl}</a>
       <p>Este enlace expirará en 1 hora.</p>`
    );

    logger.info("Email de recuperación enviado", {
      correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      msg: "Se envió un correo para restablecer la contraseña (verifica la casilla de Spam)",
    });
  } catch (error) {
    logger.error("Error en forgotPassword", {
      error: error.message,
      stack: error.stack,
      correo,
      ip: req.ip,
    });
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ----------------- RESET PASSWORD -----------------------
const resetPassword = async (req, res = response) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const usuario = await Usuario.findOne({
      resetToken: token,
      resetTokenExp: { $gt: Date.now() },
    });

    if (!usuario) {
      logger.warn("Intento de reset con token inválido o expirado", {
        token,
        ip: req.ip,
      });
      
      return res.status(400).json({
        msg: "Token inválido o expirado",
        errors: {
          password: "Token inválido o expirado",
        },
      });
    }

    if (password.length < 6)
      return res.status(400).json({
        msg: "La contraseña debe tener al menos 6 caracteres",
        errors: {
          password: "La contraseña debe tener al menos 6 caracteres",
        },
      });

    if (password.length > 15)
      return res.status(400).json({
        msg: "La contraseña no puede tener más de 15 caracteres",
        errors: {
          password: "La contraseña no puede tener más de 15 caracteres",
        },
      });

    const salt = bcryptjs.genSaltSync(10);
    usuario.password = bcryptjs.hashSync(password, salt);

    // ✅ PARCHE: Invalidar todos los refresh tokens por seguridad
    usuario.refreshTokens = [];
    usuario.resetToken = undefined;
    usuario.resetTokenExp = undefined;
    await usuario.save();

    logger.info("Contraseña restablecida exitosamente", {
      correo: usuario.correo,
      ip: req.ip,
      tokensInvalidados: true,
    });

    res.json({ 
      success: true,
      msg: "Contraseña actualizada correctamente" 
    });
  } catch (error) {
    logger.error("Error en resetPassword", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// ----------------- REVALIDAR TOKEN / OBTENER USUARIO -----------------------
const revalidarToken = async (req, res = response) => {
  try {
    const usuario = req.usuario; // viene del middleware validarJWT
    
    logger.debug("Usuario autenticado", {
      correo: usuario.correo,
      ip: req.ip,
    });
    
    // No renovar token aquí - solo devolver usuario
    // El frontend debe usar /refresh para renovar tokens
    res.json({ 
      success: true,
      usuario 
    });
  } catch (error) {
    logger.error("Error en revalidarToken", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({ 
      success: false,
      msg: "Error en el servidor" 
    });
  }
};

// ----------------- REFRESH TOKEN -----------------------
const refreshToken = async (req, res = response) => {
  const { refreshToken } = req.body;

  try {
    // 1. Validar que viene el token
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        msg: "Refresh token no proporcionado",
      });
    }

    // 2. Verificar firma del token
    let uid;
    try {
      const { uid: userId, type } = jwt.verify(
        refreshToken,
        process.env.REFRESH_SECRET
      );

      if (type !== "refresh") {
        throw new Error("Token inválido");
      }

      uid = userId;
    } catch (error) {
      logger.warn("Intento de refresh con token inválido", {
        ip: req.ip,
        error: error.message,
      });

      return res.status(401).json({
        success: false,
        msg: "Refresh token inválido o expirado",
      });
    }

    // 3. Buscar usuario y verificar que el token existe en DB
    const usuario = await Usuario.findById(uid);

    if (!usuario) {
      return res.status(401).json({
        success: false,
        msg: "Usuario no encontrado",
      });
    }

    // ✅ PARCHE: Validar estado y limpiar tokens si está deshabilitado
    if (!usuario.estado) {
      usuario.refreshTokens = [];
      await usuario.save();
      
      logger.warn("Intento de refresh con usuario deshabilitado", {
        correo: usuario.correo,
        ip: req.ip,
      });
      
      return res.status(401).json({
        success: false,
        msg: "Usuario deshabilitado. Tokens invalidados.",
      });
    }

    const tokenExiste = usuario.refreshTokens?.some(
      (rt) => rt.token === refreshToken
    );

    if (!tokenExiste) {
      logger.warn("Refresh token no encontrado en DB - posible robo", {
        correo: usuario.correo,
        ip: req.ip,
      });

      // Invalidar TODOS los refresh tokens por seguridad
      usuario.refreshTokens = [];
      await usuario.save();

      return res.status(401).json({
        success: false,
        msg: "Refresh token inválido. Por seguridad, cierra sesión en todos tus dispositivos.",
      });
    }

    // 4. Generar NUEVOS tokens (Token Rotation)
    const [newAccessToken, newRefreshToken] = await Promise.all([
      generarAccessToken(usuario.id),
      generarRefreshToken(usuario.id),
    ]);

    // 5. Eliminar refresh token viejo y agregar nuevo
    usuario.refreshTokens = usuario.refreshTokens.filter(
      (rt) => rt.token !== refreshToken
    );

    usuario.refreshTokens.push({
      token: newRefreshToken,
      device: req.headers["user-agent"] || "Unknown",
      ip: req.ip,
    });

    await usuario.save();

    logger.info("Token renovado exitosamente", {
      correo: usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error("Error al renovar token", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      msg: "Error al renovar token",
    });
  }
};

// ----------------- LOGOUT -----------------------
const logout = async (req, res = response) => {
  try {
    const { refreshToken } = req.body;
    const usuario = await Usuario.findById(req.usuario._id);

    if (refreshToken && usuario) {
      // Eliminar solo el refresh token del dispositivo actual
      usuario.refreshTokens = usuario.refreshTokens.filter(
        (rt) => rt.token !== refreshToken
      );
      await usuario.save();
    }

    logger.info("Logout exitoso", {
      correo: req.usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      msg: "Sesión cerrada correctamente",
    });
  } catch (error) {
    logger.error("Error en logout", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({ success: false, msg: "Error al cerrar sesión" });
  }
};

// ----------------- LOGOUT ALL -----------------------
const logoutAll = async (req, res = response) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id);

    usuario.refreshTokens = [];
    await usuario.save();

    logger.warn("Logout de todos los dispositivos", {
      correo: req.usuario.correo,
      ip: req.ip,
    });

    res.json({
      success: true,
      msg: "Sesión cerrada en todos los dispositivos",
    });
  } catch (error) {
    logger.error("Error en logoutAll", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    res.status(500).json({ success: false, msg: "Error al cerrar sesiones" });
  }
};

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  revalidarToken,
  refreshToken,
  logout,
  logoutAll,
};

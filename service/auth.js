const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuario");
const { generarAccessToken, generarRefreshToken } = require("../helpers/generar-jwt");
const { enviarEmail } = require("../helpers/enviar-mails");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");

const login = async ({ correo, password, userAgent, ip }) => {
  const usuario = await Usuario.findOne({ correo });

  if (!usuario || !usuario.estado) {
    logger.warn("Intento de login fallido - Usuario no existe o inactivo", { correo, ip });
    throw new AppError("Correo o contraseña incorrectos", 400, {
      correo: "Correo o contraseña incorrectos",
      password: "Correo o contraseña incorrectos",
    });
  }

  const validPassword = bcryptjs.compareSync(password, usuario.password);
  if (!validPassword) {
    logger.warn("Intento de login fallido - Contraseña incorrecta", { correo, ip });
    throw new AppError("Correo o contraseña incorrectos", 400, {
      correo: "Correo o contraseña incorrectos",
      password: "Correo o contraseña incorrectos",
    });
  }

  const [accessToken, refreshToken] = await Promise.all([
    generarAccessToken(usuario.id),
    generarRefreshToken(usuario.id),
  ]);

  usuario.refreshTokens = usuario.refreshTokens || [];
  usuario.refreshTokens.push({
    token: refreshToken,
    device: userAgent || "Unknown",
    ip,
  });

  if (usuario.refreshTokens.length > 5) {
    usuario.refreshTokens = usuario.refreshTokens.slice(-5);
  }

  await usuario.save();

  logger.info("Login exitoso", {
    correo,
    nombre: usuario.nombre,
    ip,
    dispositivosActivos: usuario.refreshTokens.length,
  });

  return { usuario, accessToken, refreshToken };
};

const forgotPassword = async ({ correo, ip }) => {
  const RESPUESTA_GENERICA = {
    msg: "Si el correo está registrado, recibirás un enlace en los próximos minutos. Revisá también la carpeta de Spam.",
  };

  const usuario = await Usuario.findOne({ correo });

  if (!usuario) {
    logger.warn("Solicitud de recuperación para correo no registrado", { correo, ip });
    return RESPUESTA_GENERICA;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  // Enviar email ANTES de persistir el token — si falla, no queda token huérfano en DB
  await enviarEmail(
    usuario.correo,
    "Recuperar contraseña",
    `<p>Hola ${usuario.nombre},</p>
     <p>Haz click en el siguiente enlace para restablecer tu contraseña:</p>
     <a href="${resetUrl}" target="_blank">${resetUrl}</a>
     <p>Este enlace expirará en 1 hora.</p>`
  );

  usuario.resetToken = token;
  usuario.resetTokenExp = Date.now() + 3600000; // 1 hora
  await usuario.save();

  logger.info("Email de recuperación enviado", { correo, ip });

  return RESPUESTA_GENERICA;
};

const resetPassword = async ({ token, password, ip }) => {
  const usuario = await Usuario.findOne({
    resetToken: token,
    resetTokenExp: { $gt: Date.now() },
  });

  if (!usuario) {
    logger.warn("Intento de reset con token inválido o expirado", {
      tokenHint: token.slice(0, 8) + "...",
      ip,
    });
    throw new AppError("Token inválido o expirado", 400, {
      password: "Token inválido o expirado",
    });
  }

  const salt = bcryptjs.genSaltSync(10);
  usuario.password = bcryptjs.hashSync(password, salt);
  usuario.refreshTokens = [];
  usuario.resetToken = undefined;
  usuario.resetTokenExp = undefined;
  await usuario.save();

  logger.info("Contraseña restablecida exitosamente", {
    correo: usuario.correo,
    ip,
    tokensInvalidados: true,
  });

  return { msg: "Contraseña actualizada correctamente" };
};

const renovarToken = async ({ refreshToken, userAgent, ip }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token no proporcionado", 401);
  }

  let uid;
  try {
    const { uid: userId, type } = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    if (type !== "refresh") throw new Error("Token inválido");
    uid = userId;
  } catch (error) {
    logger.warn("Intento de refresh con token inválido", { ip, error: error.message });
    throw new AppError("Refresh token inválido o expirado", 401);
  }

  const usuario = await Usuario.findById(uid);
  if (!usuario) {
    throw new AppError("Usuario no encontrado", 401);
  }

  if (!usuario.estado) {
    usuario.refreshTokens = [];
    await usuario.save();
    logger.warn("Intento de refresh con usuario deshabilitado", { correo: usuario.correo, ip });
    throw new AppError("Usuario deshabilitado. Tokens invalidados.", 401);
  }

  const tokenExiste = usuario.refreshTokens?.some((rt) => rt.token === refreshToken);

  if (!tokenExiste) {
    const tokensActuales = usuario.refreshTokens?.length || 0;
    logger.warn("Refresh token no encontrado en DB", {
      correo: usuario.correo,
      ip,
      tokensActuales,
      motivo: tokensActuales === 0 ? "Usuario cerró sesión previamente" : "Posible robo de token",
    });
    usuario.refreshTokens = [];
    await usuario.save();
    throw new AppError(
      "Refresh token inválido. Por seguridad, cierra sesión en todos tus dispositivos.",
      401
    );
  }

  const [newAccessToken, newRefreshToken] = await Promise.all([
    generarAccessToken(usuario.id),
    generarRefreshToken(usuario.id),
  ]);

  usuario.refreshTokens = usuario.refreshTokens.filter((rt) => rt.token !== refreshToken);
  usuario.refreshTokens.push({
    token: newRefreshToken,
    device: userAgent || "Unknown",
    ip,
  });
  await usuario.save();

  logger.info("Token renovado exitosamente", { correo: usuario.correo, ip });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const logout = async ({ userId, refreshToken, correo, ip }) => {
  const usuario = await Usuario.findById(userId);

  if (!usuario) {
    return { msg: "Sesión cerrada correctamente" };
  }

  if (refreshToken) {
    usuario.refreshTokens = usuario.refreshTokens.filter((rt) => rt.token !== refreshToken);
    await usuario.save();
  }

  logger.info("Logout exitoso", { correo, ip });

  return { msg: "Sesión cerrada correctamente" };
};

const logoutAll = async ({ userId, correo, ip }) => {
  const usuario = await Usuario.findById(userId);

  if (!usuario) {
    return { msg: "Sesión cerrada en todos los dispositivos" };
  }

  usuario.refreshTokens = [];
  await usuario.save();

  logger.warn("Logout de todos los dispositivos", { correo, ip });

  return { msg: "Sesión cerrada en todos los dispositivos" };
};

module.exports = { login, forgotPassword, resetPassword, renovarToken, logout, logoutAll };

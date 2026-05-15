const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { generarAccessToken, generarRefreshToken } = require("../helpers/generar-jwt");
const { enviarEmail } = require("../helpers/enviar-mails");
const { cloudinary } = require("../helpers/cloudinary");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");
const authRepository = require("../repositories/authRepository");
const { buildRefreshTokenVerifyOptions } = require("../helpers/jwt-config");

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const login = async ({ correo, password, userAgent, ip }) => {
  const usuario = await authRepository.findByCorreo(correo);

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

  await authRepository.save(usuario);

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
    msg: "Si el correo esta registrado, recibiras un enlace en los proximos minutos. Revisa tambien la carpeta de Spam.",
  };

  const usuario = await authRepository.findByCorreo(correo);

  if (!usuario) {
    logger.warn("Solicitud de recuperacion para correo no registrado", { correo, ip });
    return RESPUESTA_GENERICA;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = hashResetToken(token);
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  await enviarEmail(
    usuario.correo,
    "Recuperar contrasena",
    `<p>Hola ${usuario.nombre},</p>
     <p>Haz click en el siguiente enlace para restablecer tu contrasena:</p>
     <a href="${resetUrl}" target="_blank">${resetUrl}</a>
     <p>Este enlace expirara en 1 hora.</p>`,
  );

  usuario.resetToken = resetTokenHash;
  usuario.resetTokenExp = Date.now() + 3600000;
  await authRepository.save(usuario);

  logger.info("Email de recuperacion enviado", { correo, ip });

  return RESPUESTA_GENERICA;
};

const resetPassword = async ({ token, password, ip }) => {
  const usuario = await authRepository.findByResetTokenHash(hashResetToken(token));

  if (!usuario) {
    logger.warn("Intento de reset con token invalido o expirado", {
      tokenHint: token.slice(0, 8) + "...",
      ip,
    });
    throw new AppError("Token invalido o expirado", 400, {
      password: "Token invalido o expirado",
    });
  }

  const salt = bcryptjs.genSaltSync(10);
  usuario.password = bcryptjs.hashSync(password, salt);
  usuario.refreshTokens = [];
  usuario.resetToken = undefined;
  usuario.resetTokenExp = undefined;
  await authRepository.save(usuario);

  logger.info("Contrasena restablecida exitosamente", {
    correo: usuario.correo,
    ip,
    tokensInvalidados: true,
  });

  return { msg: "Contrasena actualizada correctamente" };
};

const renovarToken = async ({ refreshToken, userAgent, ip }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token no proporcionado", 401);
  }

  let uid;
  try {
    const { uid: userId, type } = jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET,
      buildRefreshTokenVerifyOptions(),
    );
    if (type !== "refresh") throw new Error("Token invalido");
    uid = userId;
  } catch (error) {
    logger.warn("Intento de refresh con token invalido", { ip, error: error.message });
    throw new AppError("Refresh token invalido o expirado", 401);
  }

  const usuario = await authRepository.findById(uid);
  if (!usuario) {
    throw new AppError("Usuario no encontrado", 401);
  }

  if (!usuario.estado) {
    usuario.refreshTokens = [];
    await authRepository.save(usuario);
    logger.warn("Intento de refresh con usuario deshabilitado", { correo: usuario.correo, ip });
    throw new AppError("Usuario deshabilitado. Tokens invalidados.", 401);
  }

  const tokenExiste = usuario.refreshTokens?.some((rt) => rt.token === refreshToken);

  if (!tokenExiste) {
    const tokensActuales = usuario.refreshTokens?.length || 0;
    const isProduction = process.env.NODE_ENV === "production";
    logger.warn("Refresh token no encontrado en DB", {
      correo: usuario.correo,
      ip,
      tokensActuales,
      motivo: tokensActuales === 0 ? "Usuario cerro sesion previamente" : "Posible robo de token",
    });
    if (isProduction) {
      usuario.refreshTokens = [];
      await authRepository.save(usuario);
      throw new AppError(
        "Refresh token invalido. Por seguridad, cierra sesion en todos tus dispositivos.",
        401,
      );
    }
    throw new AppError("Refresh token invalido o expirado", 401);
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
  await authRepository.save(usuario);

  logger.info("Token renovado exitosamente", { correo: usuario.correo, ip });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, usuario };
};

const logout = async ({ userId, refreshToken, correo, ip }) => {
  const usuario = await authRepository.findById(userId);

  if (!usuario) {
    return { msg: "Sesion cerrada correctamente" };
  }

  if (refreshToken) {
    usuario.refreshTokens = usuario.refreshTokens.filter((rt) => rt.token !== refreshToken);
    await authRepository.save(usuario);
  }

  logger.info("Logout exitoso", { correo, ip });

  return { msg: "Sesion cerrada correctamente" };
};

const logoutAll = async ({ userId, correo, ip }) => {
  const usuario = await authRepository.findById(userId);

  if (!usuario) {
    return { msg: "Sesion cerrada en todos los dispositivos" };
  }

  usuario.refreshTokens = [];
  await authRepository.save(usuario);

  logger.warn("Logout de todos los dispositivos", { correo, ip });

  return { msg: "Sesion cerrada en todos los dispositivos" };
};

const generarCloudinarySignature = async () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError("Cloudinary no esta configurado", 500);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp }, CLOUDINARY_API_SECRET);

  return {
    signature,
    timestamp,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
  };
};

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  renovarToken,
  logout,
  logoutAll,
  generarCloudinarySignature,
};

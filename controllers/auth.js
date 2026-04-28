const authService = require("../service/auth");

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

const omitRefreshToken = ({ refreshToken, ...payload }) => payload;

const login = async (req, res, next) => {
  try {
    const result = await authService.login({
      correo: req.body.correo,
      password: req.body.password,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    res.cookie("refreshToken", result.refreshToken, buildRefreshCookieOptions());
    res.json({ success: true, ...omitRefreshToken(result) });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword({
      correo: req.body.correo,
      ip: req.ip,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword({
      token: req.params.token,
      password: req.body.password,
      ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const result = await authService.renovarToken({
      refreshToken: req.body.refreshToken || req.cookies?.refreshToken,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    res.cookie("refreshToken", result.refreshToken, buildRefreshCookieOptions());
    res.json({ success: true, ...omitRefreshToken(result) });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout({
      userId: req.usuario._id,
      refreshToken: req.body.refreshToken || req.cookies?.refreshToken,
      correo: req.usuario.correo,
      ip: req.ip,
    });
    res.clearCookie("refreshToken", buildRefreshCookieOptions());
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    const result = await authService.logoutAll({
      userId: req.usuario._id,
      correo: req.usuario.correo,
      ip: req.ip,
    });
    res.clearCookie("refreshToken", buildRefreshCookieOptions());
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
};

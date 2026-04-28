const crypto = require("crypto");
const logger = require("../helpers/logger");
const AppError = require("../helpers/AppError");

const ALLOWED_CLOUDINARY_FOLDERS = ["publicaciones", "comunidad", "usuarios"];

const buildCloudinarySignaturePayload = ({ carpeta, timestamp }) => {
  const params = { folder: carpeta, timestamp };
  const paramsToSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(`${paramsToSign}${process.env.CLOUDINARY_API_SECRET}`)
    .digest("hex");

  return { paramsToSign, signature };
};

const assertValidCloudinaryFolder = (carpeta) => {
  if (!ALLOWED_CLOUDINARY_FOLDERS.includes(carpeta)) {
    throw new AppError("Carpeta de Cloudinary no valida", 400);
  }
};

const obtenerFirma = async (req, res, next) => {
  try {
    const { carpeta } = req.query;
    assertValidCloudinaryFolder(carpeta);

    const timestamp = Math.round(Date.now() / 1000);
    const { signature } = buildCloudinarySignaturePayload({ carpeta, timestamp });

    logger.info("Firma de Cloudinary generada", {
      uid: req.usuario?._id?.toString?.() || null,
      carpeta,
      ip: req.ip,
    });

    res.json({
      success: true,
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  assertValidCloudinaryFolder,
  buildCloudinarySignaturePayload,
  obtenerFirma,
};

const crypto = require("crypto");
const logger = require("../helpers/logger");

const buildCloudinarySignaturePayload = ({ carpeta, timestamp }) => {
  const paramsToSign = `folder=${carpeta}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(`${paramsToSign}${process.env.CLOUDINARY_API_SECRET}`)
    .digest("hex");

  return { paramsToSign, signature };
};

const assertValidCloudinaryFolder = (carpeta) => {
  const allowedFolders = ["publicaciones", "comunidad", "usuarios"];

  if (!allowedFolders.includes(carpeta)) {
    throw new Error("Carpeta de Cloudinary no valida");
  }
};

const obtenerFirma = async (req, res, next) => {
  try {
    const { carpeta } = req.query;
    assertValidCloudinaryFolder(carpeta);

    const timestamp = Math.floor(Date.now() / 1000);
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

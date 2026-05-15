const cloudinary = require("cloudinary").v2;
const logger = require("./logger");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const extraerPublicId = (url) => {
  const match = url?.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
  return match ? match[1] : null;
};

const eliminarImagen = async (url) => {
  if (!url) return;

  const publicId = extraerPublicId(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn("No se pudo eliminar imagen de Cloudinary", {
      publicId,
      error: err.message,
    });
  }
};

module.exports = {
  cloudinary,
  extraerPublicId,
  eliminarImagen,
};

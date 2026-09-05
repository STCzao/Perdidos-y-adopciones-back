// Factories para crear datos de test directamente en la DB (integration / E2E)
const bcryptjs = require("bcryptjs");
const Usuario = require("../../models/usuario");
const Publicacion = require("../../models/publicacion");
const Comunidad = require("../../models/comunidad");
const { generarAccessToken, generarRefreshToken } = require("../../helpers/generar-jwt");

let counter = 0;
const unique = () => `${Date.now()}_${++counter}`;

const createUser = async (overrides = {}) => {
  const rawPass = overrides.rawPassword || "password123";
  const user = new Usuario({
    nombre: "Usuario Test",
    correo: `test_${unique()}@test.com`,
    password: bcryptjs.hashSync(rawPass, bcryptjs.genSaltSync()),
    telefono: "3812345678",
    rol: "USER_ROLE",
    estado: true,
    ...overrides,
  });
  // rawPassword no es un campo de Mongoose — eliminarlo antes de guardar
  delete user.rawPassword;
  return user.save();
};

const createAdmin = async (overrides = {}) =>
  createUser({ ...overrides, rol: "ADMIN_ROLE" });

const getTokens = async (userId) => {
  const [accessToken, refreshToken] = await Promise.all([
    generarAccessToken(userId.toString()),
    generarRefreshToken(userId.toString()),
  ]);
  return { accessToken, refreshToken };
};

const PUBLICACION_BASE = {
  tipo: "PERDIDO",
  especie: "PERRO",
  raza: "LABRADOR RETRIEVER",
  nombreanimal: "FIRULAIS",
  sexo: "MACHO",
  tamaño: "GRANDE",
  color: "NEGRO",
  edad: "ADULTO",
  localidad: "SAN MIGUEL DE TUCUMAN",
  lugar: "PARQUE 9 DE JULIO",
  fecha: "2026-03-19",
  whatsapp: "3812345678901",
  imgs: ["https://res.cloudinary.com/demo/image/upload/test.jpg"],
  img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
  estado: "SE BUSCA",
};

const createPublicacion = async (usuarioId, overrides = {}) => {
  const data = {
    ...PUBLICACION_BASE,
    usuario: usuarioId,
    ...overrides,
  };

  if (overrides.img && overrides.imgs === undefined) {
    data.imgs = [overrides.img];
  }

  const pub = new Publicacion({
    ...data,
  });
  return pub.save();
};

const createComunidad = async (usuarioId, overrides = {}) => {
  const post = new Comunidad({
    titulo: "POST DE PRUEBA",
    contenido: "Contenido de prueba para la comunidad.",
    categoria: "HISTORIA",
    img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
    usuario: usuarioId,
    ...overrides,
  });
  return post.save();
};

module.exports = {
  createUser,
  createAdmin,
  getTokens,
  createPublicacion,
  createComunidad,
  PUBLICACION_BASE,
};

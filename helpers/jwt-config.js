const JWT_ISSUER = process.env.JWT_ISSUER || "perdidos-y-adopciones-back";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "perdidos-y-adopciones-clients";
const JWT_ALGORITHMS = ["HS256"];

const buildAccessTokenSignOptions = () => ({
  expiresIn: "30m",
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithm: JWT_ALGORITHMS[0],
});

const buildRefreshTokenSignOptions = () => ({
  expiresIn: "30d",
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithm: JWT_ALGORITHMS[0],
});

const buildAccessTokenVerifyOptions = () => ({
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithms: JWT_ALGORITHMS,
});

const buildRefreshTokenVerifyOptions = () => ({
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithms: JWT_ALGORITHMS,
});

module.exports = {
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_ALGORITHMS,
  buildAccessTokenSignOptions,
  buildRefreshTokenSignOptions,
  buildAccessTokenVerifyOptions,
  buildRefreshTokenVerifyOptions,
};

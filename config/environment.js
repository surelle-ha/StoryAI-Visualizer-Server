// config/environment.js

const ENV_NAME = process.env.SERVER_NAME;
const ENV_BASE = process.env.SERVER_BASE;
const ENV_PORT = process.env.SERVER_PORT;
const ENV_VER = process.env.SERVER_VERS;
const ENV_TYPE = process.env.SERVER_ENVN;

module.exports = {
    ENV_NAME,
    ENV_BASE,
    ENV_PORT,
    ENV_VER,
    ENV_TYPE
  };
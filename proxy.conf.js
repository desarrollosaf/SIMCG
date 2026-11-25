const backendHost = process.env.BACKEND_HOST || 'localhost';
const backendPort = process.env.BACKEND_PORT || '3000';
const target = `http://${backendHost}:${backendPort}`;

// El backend ya expone el prefijo global "api", por eso no se reescribe la ruta.
module.exports = {
  '/api': {
    target,
    changeOrigin: true,
  },
  '/uploads': {
    target,
    changeOrigin: true,
  },
};

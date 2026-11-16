const djangoBackend = 'http://127.0.0.1:8001';

export const devApiProxy = {
  '/api': {
    target: djangoBackend,
    changeOrigin: true,
  },
  '/alerts': {
    target: djangoBackend,
    changeOrigin: true,
  },
  '/reports': {
    target: djangoBackend,
    changeOrigin: true,
  },
};

export const environment = {
  production: true,

  // URL base del backend en produccion
  apiUrl: 'https://proyectofinalavanzadabackend-production.up.railway.app/api',

  // WebSocket
  wsUrl: 'https://proyectofinalavanzadabackend-production.up.railway.app/ws',

  // Mapbox
  mapboxToken: 'MAP_TOKEN_PROD',

  // Stripe
  stripePublicKey: 'STRIPE_PUBLIC_KEY_PROD',

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 3,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,

};

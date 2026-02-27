export const environment = {
  production: false,

  // URL base del backend
  apiUrl: 'http://localhost/api',

  // WebSocket
  wsUrl: 'http://localhost/ws',

  // Mapbox
  mapboxToken: 'MAP_TOKEN_DEV',

  // Stripe
  stripePublicKey: 'STRIPE_PUBLIC_KEY_DEV',

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 5,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,

};

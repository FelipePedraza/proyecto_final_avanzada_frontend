export const environment = {
  production: true,

  // URL base del backend
  apiUrl: 'https://vivigo-env-01.eba-mufjwmzj.us-east-2.elasticbeanstalk.com/api',

  // WebSocket
  wsUrl: 'https://vivigo-env-01.eba-mufjwmzj.us-east-2.elasticbeanstalk.com/ws',

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

export const environment = {
  production: true,

  // URL base del backend
  apiUrl: 'https://vivigo-env.eba-mufjwmzj.us-east-2.elasticbeanstalk.com/api',

  // WebSocket
  wsUrl: 'https://vivigo-env.eba-mufjwmzj.us-east-2.elasticbeanstalk.com/ws',

  // Mapbox
  mapboxToken: (window as any).__env?.mapboxToken,

  // Stripe
  stripePublicKey: (window as any).__env?.stripePublicKey,

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 3,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,

};

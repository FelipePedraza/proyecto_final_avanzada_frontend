export const environment = {
  production: false,

  // URL base del backend local
  apiUrl: 'http://localhost:8080/api',

  // WebSocket
  wsUrl: 'http://localhost:8080/ws',

  // Mapbox
  mapboxToken: 'pk.eyJ1IjoicGVkcmF6YTgzMCIsImEiOiJjbWg5OTQ0MjMxY2F6MmpxNmVibG5pc2V2In0.VrZ9nEk-zYTfqaUrE2rWwg',

  // Stripe
  stripePublicKey: 'pk_test_51T57Y9FTrFhsWQDFtni4TCqEAMO9y5omXg7QeSMccXO50w8qOljefdtfJrlBoKPVSIoWRtPkGGMmvlOSn70fItU4002EjkT7FU',

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 5,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,


};

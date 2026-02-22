export const environment = {
  production: true,

  // URL base del backend
  apiUrl: 'https://d2nwu7cgdnp7ru.cloudfront.net/api',

  // WebSocket
  wsUrl: 'https://d2nwu7cgdnp7ru.cloudfront.net/ws',

  // Mapbox
  mapboxToken: 'pk.eyJ1IjoicGVkcmF6YTgzMCIsImEiOiJjbWg5OTQ0MjMxY2F6MmpxNmVibG5pc2V2In0.VrZ9nEk-zYTfqaUrE2rWwg',

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 3,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,

};

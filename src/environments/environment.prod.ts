declare global {
  interface Window {
    __env?: {
      apiUrl?: string;
      wsUrl?: string;
      mapboxToken?: string;
      stripePublicKey?: string;
    };
  }
}

const runtimeEnv = window.__env ?? {};

export const environment = {
  production: true,

  // URL base del backend
  apiUrl: runtimeEnv.apiUrl,

  // WebSocket
  wsUrl: runtimeEnv.wsUrl,

  // Mapbox
  mapboxToken: runtimeEnv.mapboxToken,

  // Stripe
  stripePublicKey: runtimeEnv.stripePublicKey,

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 3,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,
};

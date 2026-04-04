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
  apiUrl: runtimeEnv.apiUrl ?? 'https://tu-dominio.com/api',

  // WebSocket
  wsUrl: runtimeEnv.wsUrl ?? 'https://tu-dominio.com/ws',

  // Mapbox
  mapboxToken: runtimeEnv.mapboxToken ?? 'MAP_TOKEN_PROD',

  // Stripe
  stripePublicKey: runtimeEnv.stripePublicKey ?? 'STRIPE_PUBLIC_KEY_PROD',

  // Configuración de reconexión WebSocket
  wsReconnectDelay: 5000,
  wsMaxReconnectAttempts: 3,

  // Configuración de paginación
  defaultPageSize: 10,

  // Configuración de imágenes
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImages: 10,
};

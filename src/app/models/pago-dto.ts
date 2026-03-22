export interface CreacionPagoDTO {
  reservaId: number;
}

export interface PagoIntentDTO {
  clientSecret:    string;  // Se pasa directamente a Stripe.js
  paymentIntentId: string;
  montoCentavos:   number;
  moneda:          string;
}

/**
 * PENDIENTE  → reserva creada, usuario aún no pagó
 * AUTORIZADO → usuario pagó, esperando captura (anfitrión debe aceptar)
 * CAPTURADO  → anfitrión aceptó y cobró
 * CANCELADO  → cancelado sin cobro
 * REEMBOLSADO→ cobrado y luego devuelto
 */
export enum PagoEstado {
  PENDIENTE   = 'PENDIENTE',
  AUTORIZADO  = 'AUTORIZADO',
  CAPTURADO   = 'CAPTURADO',
  CANCELADO   = 'CANCELADO',
  REEMBOLSADO = 'REEMBOLSADO'
}

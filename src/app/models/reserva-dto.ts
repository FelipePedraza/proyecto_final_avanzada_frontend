import {AlojamientoDTO} from './alojamiento-dto';
import {UsuarioDTO} from './usuario-dto';
import {PagoEstado, PagoIntentDTO} from './pago-dto';

export interface ReservaDTO {
  id: number;
  alojamiento: AlojamientoDTO;
  huesped: UsuarioDTO;
  fechaEntrada: Date;
  fechaSalida: Date;
  cantidadHuespedes: number;
  precio: number;
  estado: ReservaEstado;
  pagoEstado: PagoEstado;
}

export interface ItemReservaDTO {
  id: number;
  alojamiento: AlojamientoDTO;
  fechaEntrada: Date;
  fechaSalida: Date;
  precio: number;
  estado: ReservaEstado;
  pagoEstado: PagoEstado;
}

export interface CreacionReservaDTO {
  alojamientoId: number;
  usuarioId: string;
  fechaEntrada: Date;
  fechaSalida: Date;
  cantidadHuespedes: number;
}

// DTO que devuelve el backend al crear una reserva con pago
export interface CreacionReservaRespuestaDTO {
  reservaId: number;
  precioTotal: number;   // Monto en pesos COP
  pago: PagoIntentDTO;          // PaymentIntent client_secret de Stripe
}

export interface EstadoReservaDTO {
  estado: ReservaEstado;
}

export enum ReservaEstado {
  PENDIENTE      = 'PENDIENTE',         // reserva activa esperando (puede estar sin pago o sin aprobación del anfitrión)
  CONFIRMADA     = 'CONFIRMADA',        // anfitrión aceptó y pago capturado
  CANCELADA      = 'CANCELADA',         // Cancelada (reembolso aplicado)
  COMPLETADA     = 'COMPLETADA'         // Estadía finalizada
}

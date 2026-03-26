import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreacionReservaDTO, ItemReservaDTO, ReservaEstado } from '../models/reserva-dto';
import { RespuestaDTO } from '../models/respuesta-dto';
import { PaginatedRespuestaDTO } from '../models/pagination-dto';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private readonly API_URL = `${environment.apiUrl}/reservas`;

  constructor(private http: HttpClient) {}

  /**
   * POST /api/reservas
   * Crea una nueva reserva
   */
  crear(dto: CreacionReservaDTO): Observable<RespuestaDTO> {
    return this.http.post<RespuestaDTO>(
      this.API_URL,
      dto
    );
  }

  /**
   * PATCH /api/reservas/{id}/cancelar
   * Cancela una reserva
   */
  cancelar(id: number): Observable<RespuestaDTO> {
    return this.http.patch<RespuestaDTO>(
      `${this.API_URL}/${id}/cancelar`,
      null
    );
  }

  /**
   * PATCH /api/reservas/{id}/aceptar
   * Acepta una reserva (para anfitriones)
   */
  aceptar(id: number): Observable<RespuestaDTO> {
    return this.http.patch<RespuestaDTO>(
      `${this.API_URL}/${id}/aceptar`,
      null
    );
  }

  /**
   * PATCH /api/reservas/{id}/rechazar
   * Rechaza una reserva (para anfitriones)
   */
  rechazar(id: number): Observable<RespuestaDTO> {
    return this.http.patch<RespuestaDTO>(
      `${this.API_URL}/${id}/rechazar`,
      null
    );
  }

  // ==================== MÉTODOS DE CONSULTA PAGINADOS ====================

  /**
   * GET /api/reservas/usuario/{usuarioId}
   * Obtiene las reservas de un usuario con filtros opcionales y paginación
   *
   * @param usuarioId ID del usuario
   * @param estado Estado de la reserva (opcional)
   * @param fechaEntrada Fecha de entrada (opcional)
   * @param fechaSalida Fecha de salida (opcional)
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 10)
   * @param sort Campo y dirección de ordenamiento (default: 'fechaEntrada,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerReservasUsuario(
    usuarioId: string,
    estado?: ReservaEstado,
    fechaEntrada?: Date,
    fechaSalida?: Date,
    page: number = 0,
    size: number = 10,
    sort: string = 'fechaEntrada,desc'
  ): Observable<PaginatedRespuestaDTO<ItemReservaDTO>> {

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (estado) {
      params = params.set('estado', estado);
    }
    if (fechaEntrada) {
      params = params.set('fechaEntrada', fechaEntrada.toISOString());
    }
    if (fechaSalida) {
      params = params.set('fechaSalida', fechaSalida.toISOString());
    }

    return this.http.get<PaginatedRespuestaDTO<ItemReservaDTO>>(
      `${this.API_URL}/usuario/${usuarioId}`,
      { params }
    );
  }

  /**
   * GET /api/reservas/alojamiento/{alojamientoId}
   * Obtiene las reservas de un alojamiento con filtros opcionales y paginación
   *
   * @param alojamientoId ID del alojamiento
   * @param estado Estado de la reserva (opcional)
   * @param fechaEntrada Fecha de entrada (opcional)
   * @param fechaSalida Fecha de salida (opcional)
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 10)
   * @param sort Campo y dirección de ordenamiento (default: 'fechaEntrada,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerReservasAlojamiento(
    alojamientoId: number,
    estado?: ReservaEstado,
    fechaEntrada?: Date,
    fechaSalida?: Date,
    page: number = 0,
    size: number = 10,
    sort: string = 'fechaEntrada,desc'
  ): Observable<PaginatedRespuestaDTO<ItemReservaDTO>> {

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (estado) {
      params = params.set('estado', estado);
    }
    if (fechaEntrada) {
      params = params.set('fechaEntrada', fechaEntrada.toISOString());
    }
    if (fechaSalida) {
      params = params.set('fechaSalida', fechaSalida.toISOString());
    }

    return this.http.get<PaginatedRespuestaDTO<ItemReservaDTO>>(
      `${this.API_URL}/alojamiento/${alojamientoId}`,
      { params }
    );
  }
}

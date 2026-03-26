import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreacionAlojamientoDTO, EdicionAlojamientoDTO, AlojamientoFiltroDTO, ItemAlojamientoDTO } from '../models/alojamiento-dto';
import { ReservaEstado, ItemReservaDTO } from '../models/reserva-dto';
import { CreacionResenaDTO, CreacionRespuestaDTO, ItemResenaDTO } from '../models/resena-dto';
import { RespuestaDTO } from '../models/respuesta-dto';
import { PaginatedRespuestaDTO } from '../models/pagination-dto';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AlojamientoService {
  private readonly API_URL = `${environment.apiUrl}/alojamientos`;

  constructor(private http: HttpClient) {}

  // ==================== CRUD BÁSICO ====================

  /**
   * POST /api/alojamientos
   * Crea un nuevo alojamiento
   */
  crear(dto: CreacionAlojamientoDTO): Observable<RespuestaDTO> {
    return this.http.post<RespuestaDTO>(this.API_URL, dto);
  }
  /**
   * GET /api/alojamientos/{id}
   * Obtiene un alojamiento por ID
   */
  obtenerPorId(id: number): Observable<RespuestaDTO> {
    return this.http.get<RespuestaDTO>(`${this.API_URL}/${id}`);
  }

  /**
   * PUT /api/alojamientos/{id}
   * Edita un alojamiento existente
   */
  editar(id: number, dto: EdicionAlojamientoDTO): Observable<RespuestaDTO> {
    return this.http.put<RespuestaDTO>(`${this.API_URL}/${id}`, dto);
  }

  /**
   * DELETE /api/alojamientos/{id}
   * Elimina un alojamiento
   */
  eliminar(id: number): Observable<RespuestaDTO> {
    return this.http.delete<RespuestaDTO>(`${this.API_URL}/${id}`);
  }

  // ==================== BÚSQUEDA Y FILTROS ====================

  /**
   * GET /api/alojamientos?filtros...
   * Obtiene lista de alojamientos con filtros y paginación
   *
   * @param filtros Filtros de búsqueda
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 10)
   * @param sort Campo y dirección de ordenamiento (default: 'creadoEn,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerAlojamientos(
    filtros: Partial<AlojamientoFiltroDTO>,
    page: number = 0,
    size: number = 10,
    sort: string = 'creadoEn,desc'
  ): Observable<PaginatedRespuestaDTO<ItemAlojamientoDTO>> {

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (filtros.ciudad) {
      params = params.set('ciudad', filtros.ciudad);
    }
    if (filtros.fechaEntrada) {
      params = params.set('fechaEntrada', filtros.fechaEntrada);
    }
    if (filtros.fechaSalida) {
      params = params.set('fechaSalida', filtros.fechaSalida);
    }
    if (filtros.huespedes) {
      params = params.set('huespedes', filtros.huespedes.toString());
    }
    if (filtros.precioMin) {
      params = params.set('precioMin', filtros.precioMin.toString());
    }
    if (filtros.precioMax) {
      params = params.set('precioMax', filtros.precioMax.toString());
    }
    if (filtros.servicios && filtros.servicios.length > 0) {
      filtros.servicios.forEach(servicio => {
        params = params.append('servicios', servicio);
      });
    }

    return this.http.get<PaginatedRespuestaDTO<ItemAlojamientoDTO>>(this.API_URL, { params });
  }

  /**
   * GET /api/alojamientos/sugerencias?ciudad=...
   * Obtiene sugerencias de alojamientos por ciudad con paginación
   *
   * @param ciudad Ciudad para buscar sugerencias (requerido)
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 10)
   * @returns Observable con respuesta paginada
   */
  sugerirAlojamientos(
    ciudad: string,
    page: number = 0,
    size: number = 10
  ): Observable<PaginatedRespuestaDTO<ItemAlojamientoDTO>> {
    const params = new HttpParams()
      .set('ciudad', ciudad)
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginatedRespuestaDTO<ItemAlojamientoDTO>>(
      `${this.API_URL}/sugerencias`,
      { params }
    );
  }

  // ==================== MÉTRICAS ====================

  /**
   * GET /api/alojamientos/{id}/metricas
   * Obtiene métricas de un alojamiento
   */
  obtenerMetricas(id: number): Observable<RespuestaDTO> {
    return this.http.get<RespuestaDTO>(`${this.API_URL}/${id}/metricas`);
  }

  // ==================== RESERVAS ====================

  /**
   * GET /api/alojamientos/{id}/reservas
   * Obtiene las reservas de un alojamiento con filtros opcionales y paginación
   *
   * @param id ID del alojamiento
   * @param estado Estado de la reserva (opcional)
   * @param fechaEntrada Fecha de entrada (opcional)
   * @param fechaSalida Fecha de salida (opcional)
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 10)
   * @param sort Campo y dirección de ordenamiento (default: 'fechaEntrada,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerReservasAlojamiento(
    id: number,
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
      `${this.API_URL}/${id}/reservas`,
      { params }
    );
  }

  // ==================== RESEÑAS ====================

  /**
   * GET /api/alojamientos/{id}/resenas
   * Obtiene las reseñas de un alojamiento con paginación
   *
   * @param id ID del alojamiento
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 5)
   * @param sort Campo y dirección de ordenamiento (default: 'creadoEn,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerResenasAlojamiento(
    id: number,
    page: number = 0,
    size: number = 5,
    sort: string = 'creadoEn,desc'
  ): Observable<PaginatedRespuestaDTO<ItemResenaDTO>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<PaginatedRespuestaDTO<ItemResenaDTO>>(
      `${this.API_URL}/${id}/resenas`,
      { params }
    );
  }

  /**
   * POST /api/alojamientos/{id}/resenas
   * Crea una nueva reseña para un alojamiento
   */
  crearResena(id: number, dto: CreacionResenaDTO): Observable<RespuestaDTO> {
    return this.http.post<RespuestaDTO>(`${this.API_URL}/${id}/resenas`, dto);
  }

  /**
   * POST /api/alojamientos/{id}/resenas/{idResena}/respuesta
   * Responde a una reseña
   */
  responderResena(idAlojamiento: number, idResena: number, dto: CreacionRespuestaDTO): Observable<RespuestaDTO> {
    return this.http.post<RespuestaDTO>(
      `${this.API_URL}/${idAlojamiento}/resenas/${idResena}/respuesta`,
      dto
    );
  }

}

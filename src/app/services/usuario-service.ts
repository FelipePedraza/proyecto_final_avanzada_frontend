import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EdicionUsuarioDTO, CambioContrasenaDTO, CreacionAnfitrionDTO } from '../models/usuario-dto';
import { ReservaEstado, ItemReservaDTO } from '../models/reserva-dto';
import { ItemAlojamientoDTO } from '../models/alojamiento-dto';
import { RespuestaDTO } from '../models/respuesta-dto';
import { PaginatedRespuestaDTO } from '../models/pagination-dto';
import {environment} from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private readonly API_URL = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  /**
   * POST /api/usuarios/anfitrion
   * Convierte un usuario en anfitrión
   */
  crearAnfitrion(dto: CreacionAnfitrionDTO): Observable<RespuestaDTO> {
    return this.http.post<RespuestaDTO>(
      `${this.API_URL}/anfitrion`,
      dto
    );
  }

  /**
   * PUT /api/usuarios/{id}
   * Edita la información de un usuario
   */
  editar(id: string, dto: EdicionUsuarioDTO): Observable<RespuestaDTO> {
    return this.http.put<RespuestaDTO>(
      `${this.API_URL}/${id}`,
      dto
    );
  }

  /**
   * GET /api/usuarios/{id}
   * Obtiene la información de un usuario
   */
  obtener(id: string): Observable<RespuestaDTO> {
    return this.http.get<RespuestaDTO>(
      `${this.API_URL}/${id}`
    );
  }

  /**
   * GET /api/usuarios/{id}/anfitrion
   * Obtiene la información del perfil anfitrion
   */
  obtenerAnfitrion(id: string): Observable<RespuestaDTO> {
    return this.http.get<RespuestaDTO>(
      `${this.API_URL}/${id}/anfitrion`
    );
  }

  /**
   * DELETE /api/usuarios/{id}
   * Elimina un usuario
   */
  eliminar(id: string): Observable<RespuestaDTO> {
    return this.http.delete<RespuestaDTO>(
      `${this.API_URL}/${id}`
    );
  }

  /**
   * PATCH /api/usuarios/{id}/contrasena
   * Cambia la contraseña de un usuario
   */
  cambiarContrasena(id: string, dto: CambioContrasenaDTO): Observable<RespuestaDTO> {
    return this.http.patch<RespuestaDTO>(
      `${this.API_URL}/${id}/contrasena`,
      dto
    );
  }

  /**
   * GET /api/usuarios/{id}/alojamientos
   * Obtiene los alojamientos de un usuario con paginación
   *
   * @param id ID del usuario
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 5)
   * @param sort Campo y dirección de ordenamiento (default: 'creadoEn,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerAlojamientosUsuario(
    id: string,
    page: number = 0,
    size: number = 5,
    sort: string = 'creadoEn,desc'
  ): Observable<PaginatedRespuestaDTO<ItemAlojamientoDTO>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<PaginatedRespuestaDTO<ItemAlojamientoDTO>>(
      `${this.API_URL}/${id}/alojamientos`,
      { params }
    );
  }

  /**
   * GET /api/usuarios/{id}/reservas
   * Obtiene las reservas de un usuario con filtros opcionales y paginación
   *
   * @param id ID del usuario
   * @param estado Estado de la reserva (opcional)
   * @param fechaEntrada Fecha de entrada (opcional)
   * @param fechaSalida Fecha de salida (opcional)
   * @param page Número de página (0-based, default: 0)
   * @param size Tamaño de la página (default: 5)
   * @param sort Campo y dirección de ordenamiento (default: 'fechaEntrada,desc')
   * @returns Observable con respuesta paginada
   */
  obtenerReservasUsuario(
    id: string,
    estado?: ReservaEstado,
    fechaEntrada?: Date,
    fechaSalida?: Date,
    page: number = 0,
    size: number = 5,
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
}

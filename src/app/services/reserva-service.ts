import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreacionReservaDTO } from '../models/reserva-dto';
import { RespuestaDTO } from '../models/respuesta-dto';
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
}

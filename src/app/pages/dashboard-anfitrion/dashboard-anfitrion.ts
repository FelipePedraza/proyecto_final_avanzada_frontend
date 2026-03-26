import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, forkJoin, finalize } from 'rxjs';
import { PanelUsuario } from '../../components/panel-usuario/panel-usuario';
import Swal from 'sweetalert2';

// Servicios

import { AlojamientoService } from '../../services/alojamiento-service';
import { UsuarioService } from '../../services/usuario-service';
import { TokenService } from '../../services/token-service';
import { MensajeHandlerService } from '../../services/mensajeHandler-service';
import { FechaService } from '../../services/fecha-service';

// DTOs
import { ItemAlojamientoDTO, MetricasDTO } from '../../models/alojamiento-dto';
import { ItemResenaDTO } from '../../models/resena-dto';
import { CreacionRespuestaDTO } from '../../models/resena-dto';

// Interfaz para reseñas con info de alojamiento
interface ResenaConAlojamiento extends ItemResenaDTO {
  alojamientoId: number;
  alojamientoTitulo: string;
}

@Component({
  selector: 'app-dashboard-anfitrion',
  imports: [CommonModule, PanelUsuario, RouterLink],
  templateUrl: './dashboard-anfitrion.html',
  standalone: true,
  styleUrl: './dashboard-anfitrion.css'
})
export class DashboardAnfitrion implements OnInit, OnDestroy {

  // ==================== PROPIEDADES ====================
  tabActiva: 'metricas' | 'resenas' = 'metricas';

  // Datos de alojamientos
  alojamientos: ItemAlojamientoDTO[] = [];
  metricasPorAlojamiento = new Map<number, MetricasDTO>();

  // Métricas globales
  metricasGlobales = {
    totalAlojamientos: 0,
    totalReservas: 0,
    totalResenas: 0,
    promedioGeneral: 0
  };

  // Reseñas
  resenasRecientes: ResenaConAlojamiento[] = [];

  // Estados
  cargando = false;
  cargandoResenas = false;

  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================
  constructor(
    private alojamientoService: AlojamientoService,
    private usuarioService: UsuarioService,
    private mensajeHandlerService: MensajeHandlerService,
    public fechaService: FechaService,
    private tokenService: TokenService
  ) {}

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== CARGA DE DATOS ====================

  private cargarDatosIniciales(): void {
    const usuarioId = this.tokenService.getUserId();
    if (!usuarioId) {
      this.mensajeHandlerService.showError('No se pudo identificar al usuario');
      return;
    }

    this.cargando = true;

    // 1. Cargar alojamientos del usuario (ahora usa paginación)
    this.usuarioService.obtenerAlojamientosUsuario(usuarioId, 0)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.error && respuesta.data) {
            // Ahora data es PageResponseDTO, accedemos a content
            this.alojamientos = respuesta.data.content as ItemAlojamientoDTO[];
            this.metricasGlobales.totalAlojamientos = this.alojamientos.length;

            // 2. Cargar métricas de cada alojamiento
            this.cargarTodasLasMetricas();

            // 3. Cargar reseñas recientes sin responder
            this.cargarResenasRecientes();
          }
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  private cargarTodasLasMetricas(): void {
    const observables = this.alojamientos.map(alojamiento =>
      this.alojamientoService.obtenerMetricas(alojamiento.id)
    );

    forkJoin(observables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuestas) => {
          respuestas.forEach((respuesta, index) => {
            if (!respuesta.error) {
              const metricas = respuesta.data as MetricasDTO;
              this.metricasPorAlojamiento.set(this.alojamientos[index].id, metricas);
            }
          });

          this.calcularMetricasGlobales();
        },
        error: (error) => {
          console.error('Error al cargar métricas:', error);
        }
      });
  }

  private calcularMetricasGlobales(): void {
    let totalReservas = 0;
    let totalResenas = 0;
    let sumaCalificaciones = 0;

    this.metricasPorAlojamiento.forEach((metricas) => {
      totalReservas += metricas.totalReservas;
      totalResenas += metricas.totalResenas;
      sumaCalificaciones += metricas.promedioCalificaciones * metricas.totalResenas;
    });

    this.metricasGlobales.totalReservas = totalReservas;
    this.metricasGlobales.totalResenas = totalResenas;
    this.metricasGlobales.promedioGeneral = totalResenas > 0
      ? sumaCalificaciones / totalResenas
      : 0;
  }

  private cargarResenasRecientes(): void {
    this.cargandoResenas = true;

    const observables = this.alojamientos.map(alojamiento =>
      this.alojamientoService.obtenerResenasAlojamiento(alojamiento.id, 0)
    );

    forkJoin(observables)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoResenas = false)
      )
      .subscribe({
        next: (respuestas) => {
          const todasLasResenas: ResenaConAlojamiento[] = [];

          respuestas.forEach((respuesta, index) => {
            if (!respuesta.error && respuesta.data) {
              const resenas = respuesta.data as unknown as ItemResenaDTO[];
              const alojamiento = this.alojamientos[index];

              // Filtrar solo las que NO tienen respuesta
              const resenasSinRespuesta = resenas
                .filter(r => !r.respuesta)
                .map(r => ({
                  ...r,
                  alojamientoId: alojamiento.id,
                  alojamientoTitulo: alojamiento.titulo
                } as ResenaConAlojamiento));

              todasLasResenas.push(...resenasSinRespuesta);
            }
          });

          // Ordenar por fecha (más recientes primero)
          this.resenasRecientes = todasLasResenas
            .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
            .slice(0, 10); // Mostrar las 10 más recientes
        },
        error: (error) => {
          console.error('Error al cargar reseñas:', error);
        }
      });
  }

  // ==================== RESPONDER RESEÑA ====================

  responderResena(resena: ResenaConAlojamiento): void {
    Swal.fire({
      title: 'Responder Reseña',
      html: `
        <div style="text-align: left; margin-bottom: 1rem;">
          <p style="color: var(--text-color); margin-bottom: 0.5rem;">
            <strong>Alojamiento:</strong> ${resena.alojamientoTitulo}
          </p>
          <p style="color: var(--text-color); margin-bottom: 0.5rem;">
            <strong>Huésped:</strong> ${resena.usuario.nombre}
          </p>
          <div style="margin: 0.5rem 0;">
            ${'<i class="fa-solid fa-star" style="color: #F39C12;"></i>'.repeat(resena.calificacion)}
          </div>
          <p style="color: var(--text-color); padding: 1rem; background-color: var(--light-green); border-radius: 8px; font-style: italic;">
            "${resena.comentario}"
          </p>
        </div>

        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-green); text-align: left;">
          Tu Respuesta *
        </label>
        <textarea
          id="respuesta-mensaje"
          placeholder="Escribe tu respuesta al huésped..."
          style="width: 100%; min-height: 120px; padding: 12px; border: 2px solid var(--border-color); border-radius: 12px; resize: vertical;"
          maxlength="500"></textarea>
        <p style="text-align: right; font-size: 0.85rem; color: #7F8C8D; margin-top: 0.5rem;">
          <span id="char-count">0</span>/500
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Publicar Respuesta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e8b57',
      cancelButtonColor: '#95a5a6',
      width: '600px',
      didOpen: () => {
        const textarea = document.getElementById('respuesta-mensaje') as HTMLTextAreaElement;
        const charCount = document.getElementById('char-count');

        textarea?.addEventListener('input', () => {
          if (charCount) {
            charCount.textContent = textarea.value.length.toString();
          }
        });
      },
      preConfirm: () => {
        const mensaje = (document.getElementById('respuesta-mensaje') as HTMLTextAreaElement).value;

        if (!mensaje || mensaje.trim().length < 10) {
          Swal.showValidationMessage('La respuesta debe tener al menos 10 caracteres');
          return false;
        }

        if (mensaje.length > 500) {
          Swal.showValidationMessage('La respuesta no puede exceder 500 caracteres');
          return false;
        }

        return { mensaje: mensaje.trim() };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.procesarRespuesta(resena.alojamientoId, resena.id, result.value.mensaje);
      }
    });
  }

  private procesarRespuesta(idAlojamiento: number, idResena: number, mensaje: string): void {
    this.mensajeHandlerService.showLoading('Publicando respuesta...')

    const dto: CreacionRespuestaDTO = { mensaje };

    this.alojamientoService.responderResena(idAlojamiento, idResena, dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showSuccess('Tu respuesta ha sido publicada exitosamente', '¡Respuesta publicada!')

          // Recargar reseñas
          this.cargarResenasRecientes();
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== NAVEGACIÓN ====================

  cambiarTab(tab: 'metricas' | 'resenas'): void {
    this.tabActiva = tab;
  }

}

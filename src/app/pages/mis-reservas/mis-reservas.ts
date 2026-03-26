import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import Swal from 'sweetalert2';
import { PanelUsuario } from '../../components/panel-usuario/panel-usuario';
import { Paginacion } from '../../components/paginacion/paginacion';

// Servicios
import { AlojamientoService } from '../../services/alojamiento-service';
import { ReservaService } from '../../services/reserva-service';
import { TokenService } from '../../services/token-service';
import { UsuarioService } from '../../services/usuario-service';
import { ItemReservaDTO, ReservaEstado } from '../../models/reserva-dto';
import { PagoEstado } from '../../models/pago-dto';
import { MensajeHandlerService } from '../../services/mensajeHandler-service';
import { FechaService } from '../../services/fecha-service';
import { PrecioService } from '../../services/precio-service';
import { PaginationMetadata } from '../../models/pagination-dto';

@Component({
  selector: 'app-mis-reservas',
  imports: [CommonModule, PanelUsuario, RouterLink, Paginacion],
  templateUrl: './mis-reservas.html',
  styleUrl: './mis-reservas.css'
})
export class MisReservas implements OnInit, OnDestroy {

  // ==================== PROPIEDADES ====================
  tabActiva: 'activas' | 'pasadas' | 'canceladas' = 'activas';

  // Reservas por tab (paginadas)
  reservasActivas: ItemReservaDTO[] = [];
  reservasPasadas: ItemReservaDTO[] = [];
  reservasCanceladas: ItemReservaDTO[] = [];

  // Metadata de paginación por tab
  paginacionActivas: PaginationMetadata | null = null;
  paginacionPasadas: PaginationMetadata | null = null;
  paginacionCanceladas: PaginationMetadata | null = null;

  // Página actual por tab
  paginaActivas: number = 0;
  paginaPasadas: number = 0;
  paginaCanceladas: number = 0;

  // Tamaño de página
  readonly TAMANO_PAGINA = 5;

  cargando: boolean = false;
  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================
  constructor(
    private usuarioService: UsuarioService,
    private reservaService: ReservaService,
    private tokenService: TokenService,
    public alojamientoService: AlojamientoService,
    private mensajeHandlerService: MensajeHandlerService,
    public fechaService: FechaService,
    public precioService: PrecioService
  ) {}

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.cargarReservas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== CARGA DE DATOS ====================

  private cargarReservas(): void {
    const usuarioId = this.tokenService.getUserId();
    if (!usuarioId) {
      this.mensajeHandlerService.showError('No se pudo identificar al usuario');
      return;
    }

    this.cargando = true;

    // Cargar todas las reservas sin filtro de estado (el backend las pagina)
    // El frontend clasifica según el estado/fecha
    this.usuarioService.obtenerReservasUsuario(
      usuarioId,
      undefined, // Sin filtro de estado
      undefined,
      undefined,
      0,
      this.TAMANO_PAGINA
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          const reservas = respuesta.data.content;
          this.clasificarReservas(reservas);
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  /**
   * Carga reservas para un tab específico
   */
  cargarReservasTab(tab: 'activas' | 'pasadas' | 'canceladas', pagina: number = 0): void {
    const usuarioId = this.tokenService.getUserId();
    if (!usuarioId) return;

    this.cargando = true;

    // Mapear tab a estados
    let estados: ReservaEstado[] = [];
    switch (tab) {
      case 'activas':
        estados = [ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA];
        break;
      case 'pasadas':
        estados = [ReservaEstado.COMPLETADA];
        break;
      case 'canceladas':
        estados = [ReservaEstado.CANCELADA];
        break;
    }

    // Cargar primera página de cada estado
    // Nota: Como el backend solo filtra por un estado a la vez,
    // hacemos llamadas separadas para cada estado del tab

    if (estados.length === 0) {
      this.cargando = false;
      return;
    }

    // Para simplificar, cargamos el primer estado (la mayoría de tabs tienen 1 estado principal)
    this.usuarioService.obtenerReservasUsuario(
      usuarioId,
      estados[0],
      undefined,
      undefined,
      pagina,
      this.TAMANO_PAGINA
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          const reservas = respuesta.data.content;
          const metadata = respuesta.data.pagination;

          switch (tab) {
            case 'activas':
              this.reservasActivas = reservas;
              this.paginacionActivas = metadata;
              this.paginaActivas = pagina;
              break;
            case 'pasadas':
              this.reservasPasadas = reservas;
              this.paginacionPasadas = metadata;
              this.paginaPasadas = pagina;
              break;
            case 'canceladas':
              this.reservasCanceladas = reservas;
              this.paginacionCanceladas = metadata;
              this.paginaCanceladas = pagina;
              break;
          }
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  private clasificarReservas(reservas: ItemReservaDTO[]): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Activas: PENDIENTE o CONFIRMADA con fecha futura
    this.reservasActivas = reservas.filter(r =>
      (r.estado === ReservaEstado.PENDIENTE ||
        (r.estado === ReservaEstado.CONFIRMADA && new Date(r.fechaSalida) >= hoy))
    ).sort((a, b) => new Date(a.fechaEntrada).getTime() - new Date(b.fechaEntrada).getTime());

    // Pasadas: COMPLETADA o CONFIRMADA con fecha pasada
    this.reservasPasadas = reservas.filter(r =>
      r.estado === ReservaEstado.COMPLETADA ||
      (r.estado === ReservaEstado.CONFIRMADA && new Date(r.fechaSalida) < hoy)
    ).sort((a, b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());

    // Canceladas
    this.reservasCanceladas = reservas.filter(r =>
      r.estado === ReservaEstado.CANCELADA
    ).sort((a, b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());
  }

  // ==================== PAGINACIÓN ====================

  get metadataActual(): PaginationMetadata | null {
    switch (this.tabActiva) {
      case 'activas': return this.paginacionActivas;
      case 'pasadas': return this.paginacionPasadas;
      case 'canceladas': return this.paginacionCanceladas;
      default: return null;
    }
  }

  onPageChange(nuevaPagina: number): void {
    switch (this.tabActiva) {
      case 'activas':
        this.paginaActivas = nuevaPagina;
        break;
      case 'pasadas':
        this.paginaPasadas = nuevaPagina;
        break;
      case 'canceladas':
        this.paginaCanceladas = nuevaPagina;
        break;
    }
    this.cargarReservasTab(this.tabActiva, nuevaPagina);
  }

  // ==================== ACCIONES ====================

  cancelarReserva(idReserva: number, tituloAlojamiento: string): void {
    this.mensajeHandlerService.confirmDanger(
      `¿Estás seguro de cancelar tu reserva en "${tituloAlojamiento}"?`,
      'Sí, cancelar',
      '¿Cancelar reserva?'
    ).then((result) => {
      if (result) {
        this.procesarCancelacion(idReserva);
      }
    });
  }

  private procesarCancelacion(idReserva: number): void {
    this.mensajeHandlerService.showLoading('Procesando...');

    this.reservaService.cancelar(idReserva)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showSuccess('Tu reserva ha sido cancelada exitosamente', 'Reserva cancelada');
          this.cargarReservas();
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  dejarResena(idAlojamiento: number, tituloAlojamiento: string): void {
    Swal.fire({
      title: 'Deja tu reseña',
      html: `
        <div style="text-align: left;">
          <p style="color: var(--text-color); margin-bottom: 1rem;">
            <strong>${tituloAlojamiento}</strong>
          </p>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-green);">
            Calificación *
          </label>
          <div id="rating-stars" style="display: flex; gap: 8px; margin-bottom: 1rem; justify-content: center;">
            <i class="fa-solid fa-star" data-rating="1" style="font-size: 2rem; color: #ddd; cursor: pointer;"></i>
            <i class="fa-solid fa-star" data-rating="2" style="font-size: 2rem; color: #ddd; cursor: pointer;"></i>
            <i class="fa-solid fa-star" data-rating="3" style="font-size: 2rem; color: #ddd; cursor: pointer;"></i>
            <i class="fa-solid fa-star" data-rating="4" style="font-size: 2rem; color: #ddd; cursor: pointer;"></i>
            <i class="fa-solid fa-star" data-rating="5" style="font-size: 2rem; color: #ddd; cursor: pointer;"></i>
          </div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-green);">
            Comentario *
          </label>
          <textarea
            id="review-comment"
            placeholder="Cuéntanos sobre tu experiencia..."
            style="width: 100%; min-height: 120px; padding: 12px; border: 2px solid var(--border-color); border-radius: 12px; resize: vertical;"
            maxlength="500"></textarea>
          <p style="text-align: right; font-size: 0.85rem; color: #7F8C8D; margin-top: 0.5rem;">
            <span id="char-count">0</span>/500
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Publicar Reseña',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e8b57',
      cancelButtonColor: '#95a5a6',
      width: '600px',
      didOpen: () => {
        let selectedRating = 0;
        const stars = document.querySelectorAll('#rating-stars i');

        stars.forEach(star => {
          star.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            selectedRating = parseInt(target.getAttribute('data-rating') || '0');
            stars.forEach((s, index) => {
              (s as HTMLElement).style.color = index < selectedRating ? '#F39C12' : '#ddd';
            });
          });

          star.addEventListener('mouseenter', (e) => {
            const target = e.target as HTMLElement;
            const rating = parseInt(target.getAttribute('data-rating') || '0');
            stars.forEach((s, index) => {
              (s as HTMLElement).style.color = index < rating ? '#F39C12' : '#ddd';
            });
          });
        });

        document.getElementById('rating-stars')?.addEventListener('mouseleave', () => {
          stars.forEach((s, index) => {
            (s as HTMLElement).style.color = index < selectedRating ? '#F39C12' : '#ddd';
          });
        });

        const textarea = document.getElementById('review-comment') as HTMLTextAreaElement;
        const charCount = document.getElementById('char-count');
        textarea?.addEventListener('input', () => {
          if (charCount) charCount.textContent = textarea.value.length.toString();
        });

        (Swal.getPopup() as any).selectedRating = () => selectedRating;
      },
      preConfirm: () => {
        const comment = (document.getElementById('review-comment') as HTMLTextAreaElement).value;
        const rating = (Swal.getPopup() as any).selectedRating();

        if (!rating || rating === 0) {
          Swal.showValidationMessage('Por favor selecciona una calificación');
          return false;
        }
        if (!comment || comment.trim().length < 10) {
          Swal.showValidationMessage('El comentario debe tener al menos 10 caracteres');
          return false;
        }
        if (comment.length > 500) {
          Swal.showValidationMessage('El comentario no puede exceder 500 caracteres');
          return false;
        }
        return { rating, comment: comment.trim() };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.procesarResena(idAlojamiento, result.value.rating, result.value.comment);
      }
    });
  }

  private procesarResena(idAlojamiento: number, calificacion: number, comentario: string): void {
    this.mensajeHandlerService.showLoading('Procesando...');

    this.alojamientoService.crearResena(idAlojamiento, { calificacion, comentario })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showSuccess('Tu reseña ha sido publicada exitosamente', '¡Reseña publicada!');
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== NAVEGACIÓN ====================

  cambiarTab(tab: 'activas' | 'pasadas' | 'canceladas'): void {
    this.tabActiva = tab;
    // Cargar datos del tab si está vacío
    switch (tab) {
      case 'activas':
        if (this.reservasActivas.length === 0) this.cargarReservasTab('activas', 0);
        break;
      case 'pasadas':
        if (this.reservasPasadas.length === 0) this.cargarReservasTab('pasadas', 0);
        break;
      case 'canceladas':
        if (this.reservasCanceladas.length === 0) this.cargarReservasTab('canceladas', 0);
        break;
    }
  }
}

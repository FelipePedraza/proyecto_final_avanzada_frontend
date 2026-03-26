import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {catchError, forkJoin, of, Subject, takeUntil} from 'rxjs';
import {RouterLink} from '@angular/router';
import {PanelUsuario} from '../../components/panel-usuario/panel-usuario';
// IMPORTACIONES DE ANGULAR-CALENDAR
import {CalendarEvent, CalendarModule} from 'angular-calendar';
import {addMonths, endOfDay, startOfDay, subMonths} from 'date-fns';
import {Paginacion} from '../../components/paginacion/paginacion';
import {PaginationMetadata} from '../../models/pagination-dto';

// Servicios
import {AlojamientoService} from '../../services/alojamiento-service';
import {ReservaService} from '../../services/reserva-service';
import {TokenService} from '../../services/token-service';
import {UsuarioService} from '../../services/usuario-service';
import {MensajeHandlerService} from '../../services/mensajeHandler-service';
import { FechaService } from '../../services/fecha-service';
import { PrecioService } from '../../services/precio-service';

// DTO
import {ReservaDTO, ReservaEstado} from '../../models/reserva-dto';
import {ItemAlojamientoDTO} from '../../models/alojamiento-dto';


// Define los colores para los eventos del calendario
const CALENDAR_COLORS = {
  confirmada: {
    primary: '#2e8b57', // Verde
    secondary: '#d9f0e3',
  },
  pendiente: {
    primary: '#f39c12', // Naranja
    secondary: '#fdf3e1',
  },
  completada: {
    primary: '#888880', // Gris
    secondary: '#d5c9b3',
  },
};

@Component({
  selector: 'app-gestionar-reservas',
  imports: [
    CommonModule,
    PanelUsuario,
    CalendarModule,
    RouterLink,
    Paginacion
  ],
  templateUrl: './gestionar-reservas.html',
  standalone: true,
  styleUrl: './gestionar-reservas.css'
})
export class GestionarReservas implements OnInit, OnDestroy {

  // ==================== PROPIEDADES ====================
  tabActiva: 'pendientes' | 'confirmadas' | 'historial' = 'pendientes';
  reservasPendientes: ReservaDTO[] = [];
  reservasConfirmadas: ReservaDTO[] = [];
  reservasHistorial: ReservaDTO[] = [];
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];
  locale: string = 'es';

  private todasLasReservas: ReservaDTO[] = [];
  cargando: boolean = false;
  private destroy$ = new Subject<void>();

  // Paginación por tab (cliente-side)
  readonly TAMANO_PAGINA = 5;
  paginasTab = {
    pendientes: 0,
    confirmadas: 0,
    historial: 0
  };

  // ==================== CONSTRUCTOR ====================
  constructor(
    public alojamientoService: AlojamientoService,
    private reservaService: ReservaService,
    private tokenService: TokenService,
    private mensajeHandlerService: MensajeHandlerService,
    public fechaService: FechaService,
    public precioService: PrecioService,
    private usuarioService: UsuarioService
  ) {}

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.cargarDatos(); // Llamamos a la función de carga simple
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== LÓGICA DE CARGA (SIMPLE Y CORRECTA) ====================

  private cargarDatos(): void {
    const usuarioId = this.tokenService.getUserId();
    if (!usuarioId) {
      this.mensajeHandlerService.showError('No se pudo identificar al usuario')
      return;
    }

    this.cargando = true; // <-- Inicia la carga

    // 1. Obtener alojamientos del usuario (ahora usa paginación)
    this.usuarioService.obtenerAlojamientosUsuario(usuarioId, 0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuestaAlojamientos) => {
          if (respuestaAlojamientos.error || !respuestaAlojamientos.data || respuestaAlojamientos.data.content.length === 0) {
            // No hay alojamientos
            this.cargando = false; // <-- Termina la carga
            return;
          }

          const alojamientos: ItemAlojamientoDTO[] = respuestaAlojamientos.data.content;

          // 2. Preparar todas las llamadas para las reservas
          const observablesDeReservas = alojamientos.map(alojamiento =>
            this.alojamientoService.obtenerReservasAlojamiento(alojamiento.id)
              .pipe(
                catchError(err => {
                  console.error(`Error cargando reservas para ${alojamiento.id}:`, err);
                  return of({ error: true, data: null }); // Si una falla, no daña
                })
              )
          );

          // 3. Ejecutar todas las llamadas en paralelo
          forkJoin(observablesDeReservas)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (respuestasReservas) => {

                // 4. Juntar todas las reservas en una sola lista
                const todasLasReservas: ReservaDTO[] = [];
                respuestasReservas.forEach(respuesta => {
                  if (respuesta && !respuesta.error && respuesta.data) {
                    // Ahora data es un PageResponseDTO, accedemos a content
                    todasLasReservas.push(...(respuesta.data.content as ReservaDTO[]));
                  }
                });

                // 5. Actualizar el componente
                this.todasLasReservas = todasLasReservas;
                this.clasificarReservas(this.todasLasReservas);
                this.actualizarEventosCalendario();

                this.cargando = false; // <-- FIN DE LA CARGA
              },
              error: (error) => {
                const mensaje = this.mensajeHandlerService.handleHttpError(error);
                this.mensajeHandlerService.showError(mensaje);
                this.cargando = false; // <-- FIN DE LA CARGA (con error)
              }
            });
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.cargando = false; // <-- FIN DE LA CARGA (con error)
        }
      });
  }

  // ==================== TRANSFORMACIÓN Y CLASIFICACIÓN ====================

  private actualizarEventosCalendario(): void {
    const reservas = this.todasLasReservas.filter(r =>
      r.estado === ReservaEstado.PENDIENTE || r.estado === ReservaEstado.CONFIRMADA || r.estado === ReservaEstado.COMPLETADA
    );

    this.events = reservas.map((reserva: ReservaDTO): CalendarEvent => {
      let color = CALENDAR_COLORS.confirmada;
      let cssClass = 'cal-event-confirmed';

      if (reserva.estado === ReservaEstado.PENDIENTE) {
        color = CALENDAR_COLORS.pendiente;
        cssClass = 'cal-event-pending';
      }
      else if (reserva.estado === ReservaEstado.COMPLETADA) {
        color = CALENDAR_COLORS.completada;
        cssClass = 'cal-event-completed';
      }

      return {
        title: reserva.alojamiento.titulo,
        start: startOfDay(this.toLocalDate(reserva.fechaEntrada)),
        end: endOfDay(this.toLocalDate(reserva.fechaSalida)),
        color: { ...color },
        cssClass: cssClass,
        meta: { id: reserva.id }
      };
    });
  }

  private toLocalDate(fecha: string | Date): Date {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    // Ajusta la hora eliminando el desplazamiento del huso horario
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  }


  private clasificarReservas(reservas: ReservaDTO[]): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    this.reservasPendientes = reservas.filter(r =>
      r.estado === ReservaEstado.PENDIENTE
    ).sort((a, b) => new Date(a.fechaEntrada).getTime() - new Date(b.fechaEntrada).getTime());

    this.reservasConfirmadas = reservas.filter(r =>
      r.estado === ReservaEstado.CONFIRMADA &&
      new Date(r.fechaSalida) >= hoy
    ).sort((a, b) => new Date(a.fechaEntrada).getTime() - new Date(b.fechaEntrada).getTime());

    this.reservasHistorial = reservas.filter(r =>
      r.estado === ReservaEstado.COMPLETADA ||
      r.estado === ReservaEstado.CANCELADA ||
      (r.estado === ReservaEstado.CONFIRMADA && new Date(r.fechaSalida) < hoy)
    ).sort((a, b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());
  }

  // ==================== ACCIONES DE RESERVA ====================

  aprobarReserva(idReserva: number, tituloAlojamiento: string): void {
    this.mensajeHandlerService.confirm(
      `Confirmarás la reserva para "${tituloAlojamiento}"`,
      'Sí, aprobar',
      '¿Aprobar reserva?'
    ).then((result) => {
      if (result) {
        this.procesarAprobacion(idReserva);
      }
    });
  }

  private procesarAprobacion(idReserva: number): void {

    this.mensajeHandlerService.showLoading('Procesando...');

    this.reservaService.aceptar(idReserva)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showSuccess("",'¡Reserva aprobada!')
          this.cargarDatos(); // <-- Recargamos
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  rechazarReserva(idReserva: number, tituloAlojamiento: string): void {
    this.mensajeHandlerService.confirmDanger(
      `Esta acción no se puede deshacer para "${tituloAlojamiento}"`,
      'Sí, rechazar',
      '¿Rechazar reserva?'
    ).then((result) => {
      if (result) {
        this.procesarRechazo(idReserva);
      }
    });
  }

  private procesarRechazo(idReserva: number): void {
    this.mensajeHandlerService.showLoading('Procesando...');

    this.reservaService.rechazar(idReserva)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showError("",'Reserva rechazada');
          this.cargarDatos(); // <-- Recargamos
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== CONTROLES CALENDARIO ====================

  mesAnterior(): void {
    this.viewDate = subMonths(this.viewDate, 1);
  }

  mesSiguiente(): void {
    this.viewDate = addMonths(this.viewDate, 1);
  }

  hoy(): void {
    this.viewDate = new Date();
  }

  // ==================== NAVEGACIÓN DE PESTAÑAS ====================

  cambiarTab(tab: 'pendientes' | 'confirmadas' | 'historial'): void {
    this.tabActiva = tab;
    // Reiniciar a la primera página al cambiar de tab
    this.paginasTab[tab] = 0;
  }

  // ==================== GETTERS PARA PAGINACIÓN ====================

  /**
   * Obtiene las reservas paginadas según el tab activo
   */
  get reservasPaginadas(): ReservaDTO[] {
    const pagina = this.paginasTab[this.tabActiva];
    const inicio = pagina * this.TAMANO_PAGINA;
    const fin = inicio + this.TAMANO_PAGINA;

    switch (this.tabActiva) {
      case 'pendientes':
        return this.reservasPendientes.slice(inicio, fin);
      case 'confirmadas':
        return this.reservasConfirmadas.slice(inicio, fin);
      case 'historial':
        return this.reservasHistorial.slice(inicio, fin);
      default:
        return [];
    }
  }

  /**
   * Genera la metadata de paginación para el tab activo
   */
  get metadataPaginacion(): PaginationMetadata | null {
    const totalElementos = this.getTotalElementosTab();
    const totalPaginas = Math.ceil(totalElementos / this.TAMANO_PAGINA) || 0;
    const paginaActual = this.paginasTab[this.tabActiva];

    if (totalElementos === 0) {
      return null;
    }

    return {
      currentPage: paginaActual,
      pageSize: this.TAMANO_PAGINA,
      totalElements: totalElementos,
      totalPages: totalPaginas,
      first: paginaActual === 0,
      last: paginaActual === totalPaginas - 1 || totalPaginas === 0,
      hasNext: paginaActual < totalPaginas - 1,
      hasPrevious: paginaActual > 0
    };
  }

  /**
   * Obtiene el total de elementos del tab activo
   */
  private getTotalElementosTab(): number {
    switch (this.tabActiva) {
      case 'pendientes':
        return this.reservasPendientes.length;
      case 'confirmadas':
        return this.reservasConfirmadas.length;
      case 'historial':
        return this.reservasHistorial.length;
      default:
        return 0;
    }
  }

  // ==================== MÉTODOS DE PAGINACIÓN ====================

  /**
   * Cambia la página del tab activo
   */
  onPageChange(nuevaPagina: number): void {
    this.paginasTab[this.tabActiva] = nuevaPagina;
  }
}

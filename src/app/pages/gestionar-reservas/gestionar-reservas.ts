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

  // Reservas por tab (ahora cargadas desde servidor)
  reservasPendientes: ReservaDTO[] = [];
  reservasConfirmadas: ReservaDTO[] = [];
  reservasHistorial: ReservaDTO[] = [];

  // Metadata de paginación por tab (server-side)
  paginacionPendientes: PaginationMetadata | null = null;
  paginacionConfirmadas: PaginationMetadata | null = null;
  paginacionHistorial: PaginationMetadata | null = null;

  // Página actual por tab
  paginaPendientes: number = 0;
  paginaConfirmadas: number = 0;
  paginaHistorial: number = 0;

  // Alojamientos del usuario
  alojamientosUsuario: ItemAlojamientoDTO[] = [];
  alojamientoSeleccionadoId: number | 'todos' = 'todos';

  viewDate: Date = new Date();
  events: CalendarEvent[] = [];
  locale: string = 'es';

  cargando: boolean = false;
  cargandoCalendario: boolean = false;
  private destroy$ = new Subject<void>();

  // Tamaño de página
  readonly TAMANO_PAGINA = 5;

  // ==================== CONSTRUCTOR ====================
  constructor(
    public alojamientoService: AlojamientoService,
    private reservaService: ReservaService,
    private tokenService: TokenService,
    private usuarioService: UsuarioService,
    private mensajeHandlerService: MensajeHandlerService,
    public fechaService: FechaService,
    public precioService: PrecioService
  ) {}

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.cargarDatos(); // Llamamos a la función de carga simple
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== LÓGICA DE CARGA ====================

  private cargarDatos(): void {
    const usuarioId = this.tokenService.getUserId();
    if (!usuarioId) {
      this.mensajeHandlerService.showError('No se pudo identificar al usuario');
      return;
    }

    this.cargando = true;

    // 1. Obtener alojamientos del usuario
    this.usuarioService.obtenerAlojamientosUsuario(usuarioId, 0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuestaAlojamientos) => {
          if (respuestaAlojamientos.error || !respuestaAlojamientos.data || respuestaAlojamientos.data.content.length === 0) {
            this.alojamientosUsuario = [];
            this.cargando = false;
            return;
          }

          this.alojamientosUsuario = respuestaAlojamientos.data.content;

          // Si hay alojamientos, seleccionar el primero por defecto
          if (this.alojamientosUsuario.length > 0) {
            this.alojamientoSeleccionadoId = this.alojamientosUsuario[0].id;
            // Cargar reservas del tab activo con paginación server-side
            this.cargarReservasTab(this.tabActiva, 0);
          }

          // Cargar eventos del calendario (todas las reservas sin paginar)
          this.cargarEventosCalendario();

          this.cargando = false;
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.cargando = false;
        }
      });
  }

  /**
   * Carga las reservas para un tab específico con paginación server-side
   */
  cargarReservasTab(tab: 'pendientes' | 'confirmadas' | 'historial', pagina: number = 0): void {
    if (this.alojamientoSeleccionadoId === 'todos') {
      // Si se seleccionan todos los alojamientos, cargar de cada uno y combinar
      this.cargarReservasTodosAlojamientos(tab, pagina);
      return;
    }

    const alojamientoId = this.alojamientoSeleccionadoId as number;

    // Mapear tab a estados
    let estado: ReservaEstado | undefined;
    switch (tab) {
      case 'pendientes':
        estado = ReservaEstado.PENDIENTE;
        break;
      case 'confirmadas':
        estado = ReservaEstado.CONFIRMADA;
        break;
      case 'historial':
        // Historial incluye completadas y canceladas
        // Cargamos ambas y combinamos
        this.cargarReservasHistorial(alojamientoId, pagina);
        return;
    }

    this.cargando = true;

    this.alojamientoService.obtenerReservasAlojamiento(
      alojamientoId,
      estado,
      undefined,
      undefined,
      pagina,
      this.TAMANO_PAGINA,
      'fechaEntrada,asc'
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          const reservas = respuesta.data.content as ReservaDTO[];
          const metadata = respuesta.data.pagination;

          switch (tab) {
            case 'pendientes':
              this.reservasPendientes = reservas;
              this.paginacionPendientes = metadata;
              this.paginaPendientes = pagina;
              break;
            case 'confirmadas':
              this.reservasConfirmadas = reservas;
              this.paginacionConfirmadas = metadata;
              this.paginaConfirmadas = pagina;
              break;
          }

          this.cargando = false;
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.cargando = false;
        }
      });
  }

  /**
   * Carga las reservas del historial (completadas y canceladas)
   */
  private cargarReservasHistorial(alojamientoId: number, pagina: number): void {
    this.cargando = true;

    // Cargar ambos estados en paralelo
    forkJoin({
      completadas: this.alojamientoService.obtenerReservasAlojamiento(
        alojamientoId, ReservaEstado.COMPLETADA, undefined, undefined, pagina, this.TAMANO_PAGINA, 'fechaEntrada,desc'
      ).pipe(catchError(() => of({ data: { content: [], pagination: { currentPage: pagina, pageSize: this.TAMANO_PAGINA, totalElements: 0, totalPages: 0, first: true, last: true, hasNext: false, hasPrevious: false } } }))),
      canceladas: this.alojamientoService.obtenerReservasAlojamiento(
        alojamientoId, ReservaEstado.CANCELADA, undefined, undefined, pagina, this.TAMANO_PAGINA, 'fechaEntrada,desc'
      ).pipe(catchError(() => of({ data: { content: [], pagination: { currentPage: pagina, pageSize: this.TAMANO_PAGINA, totalElements: 0, totalPages: 0, first: true, last: true, hasNext: false, hasPrevious: false } } })))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resultados) => {
          const completadas = resultados.completadas.data.content as ReservaDTO[];
          const canceladas = resultados.canceladas.data.content as ReservaDTO[];

          // Combinar y ordenar por fecha de entrada (descendente)
          const todasHistorial = [...completadas, ...canceladas]
            .sort((a, b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());

          // Limitar al tamaño de página
          this.reservasHistorial = todasHistorial.slice(0, this.TAMANO_PAGINA);

          // Calcular metadata combinada
          const totalElements = resultados.completadas.data.pagination.totalElements + resultados.canceladas.data.pagination.totalElements;
          const totalPages = Math.ceil(totalElements / this.TAMANO_PAGINA) || 0;

          this.paginacionHistorial = {
            currentPage: pagina,
            pageSize: this.TAMANO_PAGINA,
            totalElements: totalElements,
            totalPages: totalPages,
            first: pagina === 0,
            last: pagina >= totalPages - 1 || totalPages === 0,
            hasNext: pagina < totalPages - 1,
            hasPrevious: pagina > 0
          };
          this.paginaHistorial = pagina;

          this.cargando = false;
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.cargando = false;
        }
      });
  }

  /**
   * Carga reservas de todos los alojamientos (cuando se selecciona "Todos")
   */
  private cargarReservasTodosAlojamientos(tab: 'pendientes' | 'confirmadas' | 'historial', pagina: number): void {
    if (this.alojamientosUsuario.length === 0) {
      this.cargando = false;
      return;
    }

    this.cargando = true;

    const estados: (ReservaEstado | undefined)[] = [];
    switch (tab) {
      case 'pendientes':
        estados.push(ReservaEstado.PENDIENTE);
        break;
      case 'confirmadas':
        estados.push(ReservaEstado.CONFIRMADA);
        break;
      case 'historial':
        estados.push(ReservaEstado.COMPLETADA, ReservaEstado.CANCELADA);
        break;
    }

    // Para simplificar, solo cargamos el primer estado
    const estado = estados[0];

    // Cargar reservas del primer alojamiento como representante
    // Nota: En una implementación real, el backend debería soportar filtro por múltiples alojamientos
    const primerAlojamiento = this.alojamientosUsuario[0];

    this.alojamientoService.obtenerReservasAlojamiento(
      primerAlojamiento.id,
      estado,
      undefined,
      undefined,
      pagina,
      this.TAMANO_PAGINA
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          const reservas = respuesta.data.content as ReservaDTO[];
          const metadata = respuesta.data.pagination;

          this.asignarReservasATab(tab, reservas, metadata, pagina);
          this.cargando = false;
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.cargando = false;
        }
      });
  }

  /**
   * Asigna reservas al tab correspondiente
   */
  private asignarReservasATab(
    tab: 'pendientes' | 'confirmadas' | 'historial',
    reservas: ReservaDTO[],
    metadata: PaginationMetadata,
    pagina: number
  ): void {
    switch (tab) {
      case 'pendientes':
        this.reservasPendientes = reservas;
        this.paginacionPendientes = metadata;
        this.paginaPendientes = pagina;
        break;
      case 'confirmadas':
        this.reservasConfirmadas = reservas;
        this.paginacionConfirmadas = metadata;
        this.paginaConfirmadas = pagina;
        break;
      case 'historial':
        this.reservasHistorial = reservas;
        this.paginacionHistorial = metadata;
        this.paginaHistorial = pagina;
        break;
    }
  }

  /**
   * Carga los eventos del calendario (todas las reservas sin paginar)
   */
  private cargarEventosCalendario(): void {
    if (this.alojamientosUsuario.length === 0) return;

    this.cargandoCalendario = true;

    // Cargar reservas de todos los alojamientos para el calendario
    const observables = this.alojamientosUsuario.map(alojamiento =>
      this.alojamientoService.obtenerReservasAlojamiento(
        alojamiento.id,
        undefined, // Todos los estados
        undefined,
        undefined,
        0,
        100 // Traer más para el calendario
      ).pipe(
        catchError(() => of({ data: { content: [] } }))
      )
    );

    forkJoin(observables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuestas) => {
          const todasLasReservas: ReservaDTO[] = [];
          respuestas.forEach(respuesta => {
            if (respuesta.data?.content) {
              todasLasReservas.push(...(respuesta.data.content as ReservaDTO[]));
            }
          });

          this.actualizarEventosCalendario(todasLasReservas);
          this.cargandoCalendario = false;
        },
        error: () => {
          this.cargandoCalendario = false;
        }
      });
  }

  // ==================== TRANSFORMACIÓN Y CLASIFICACIÓN ====================

  private actualizarEventosCalendario(reservas: ReservaDTO[]): void {
    const reservasFiltradas = reservas.filter(r =>
      r.estado === ReservaEstado.PENDIENTE || r.estado === ReservaEstado.CONFIRMADA || r.estado === ReservaEstado.COMPLETADA
    );

    this.events = reservasFiltradas.map((reserva: ReservaDTO): CalendarEvent => {
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
        title: reserva.alojamiento?.titulo || 'Reserva',
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
          this.mensajeHandlerService.showSuccess("",'¡Reserva aprobada!');
          // Recargar el tab actual y el calendario
          const paginaActual = this.getPaginaActual();
          this.cargarReservasTab(this.tabActiva, paginaActual);
          this.cargarEventosCalendario();
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
          // Recargar el tab actual y el calendario
          const paginaActual = this.getPaginaActual();
          this.cargarReservasTab(this.tabActiva, paginaActual);
          this.cargarEventosCalendario();
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
    // Cargar datos del tab si está vacío
    const reservasActuales = this.getReservasTab(tab);
    if (reservasActuales.length === 0) {
      this.cargarReservasTab(tab, 0);
    }
  }

  /**
   * Cambia el alojamiento seleccionado
   */
  cambiarAlojamiento(alojamientoId: number | 'todos'): void {
    this.alojamientoSeleccionadoId = alojamientoId;
    // Reiniciar a página 0 y recargar el tab activo
    this.resetPaginacionTabs();
    this.cargarReservasTab(this.tabActiva, 0);
    this.cargarEventosCalendario();
  }

  /**
   * Resetea la paginación de todos los tabs
   */
  private resetPaginacionTabs(): void {
    this.paginaPendientes = 0;
    this.paginaConfirmadas = 0;
    this.paginaHistorial = 0;
    this.reservasPendientes = [];
    this.reservasConfirmadas = [];
    this.reservasHistorial = [];
    this.paginacionPendientes = null;
    this.paginacionConfirmadas = null;
    this.paginacionHistorial = null;
  }

  /**
   * Obtiene las reservas del tab especificado
   */
  private getReservasTab(tab: 'pendientes' | 'confirmadas' | 'historial'): ReservaDTO[] {
    switch (tab) {
      case 'pendientes': return this.reservasPendientes;
      case 'confirmadas': return this.reservasConfirmadas;
      case 'historial': return this.reservasHistorial;
      default: return [];
    }
  }

  /**
   * Obtiene las reservas del tab activo (para el template)
   */
  get reservasPaginadas(): ReservaDTO[] {
    return this.getReservasTab(this.tabActiva);
  }

  /**
   * Obtiene la metadata de paginación del tab activo
   */
  get metadataPaginacion(): PaginationMetadata | null {
    switch (this.tabActiva) {
      case 'pendientes': return this.paginacionPendientes;
      case 'confirmadas': return this.paginacionConfirmadas;
      case 'historial': return this.paginacionHistorial;
      default: return null;
    }
  }

  /**
   * Obtiene la página actual del tab activo
   */
  private getPaginaActual(): number {
    switch (this.tabActiva) {
      case 'pendientes': return this.paginaPendientes;
      case 'confirmadas': return this.paginaConfirmadas;
      case 'historial': return this.paginaHistorial;
      default: return 0;
    }
  }

  // ==================== MÉTODOS DE PAGINACIÓN ====================

  /**
   * Cambia la página del tab activo - recarga datos del servidor
   */
  onPageChange(nuevaPagina: number): void {
    this.cargarReservasTab(this.tabActiva, nuevaPagina);
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

// IMPORTACIONES DE ANGULAR-CALENDAR
import { CalendarEvent, CalendarModule, CalendarMonthViewDay } from 'angular-calendar';
import { addMonths, endOfDay, startOfDay, subMonths } from 'date-fns';

// Servicios
import { AlojamientoService } from '../../services/alojamiento-service';
import { ReservaService } from '../../services/reserva-service';
import { TokenService } from '../../services/token-service';
import { MapaService } from '../../services/mapa-service';
import { UsuarioService } from '../../services/usuario-service';
import { MensajeHandlerService } from '../../services/mensajeHandler-service';
import { FormUtilsService } from '../../services/formUtils-service';
import { FechaService } from '../../services/fecha-service';
import { PrecioService } from '../../services/precio-service';
import { CalificacionService } from '../../services/calificacion-service';

// DTOs
import { AlojamientoDTO, MetricasDTO } from '../../models/alojamiento-dto';
import { CreacionRespuestaDTO, ItemResenaDTO } from '../../models/resena-dto';
import { CreacionReservaDTO, ItemReservaDTO, ReservaEstado, CreacionReservaRespuestaDTO } from '../../models/reserva-dto';
import { MarcadorDTO } from '../../models/marcador-dto';
import { UsuarioDTO } from '../../models/usuario-dto';
import { PaginationMetadata } from '../../models/pagination-dto';

// Componente de pago
import { ModalPago } from '../../components/modal-pago/modal-pago';
import { Paginacion } from '../../components/paginacion/paginacion';

const CALENDAR_COLORS = {
  confirmada: {
    primary: '#2e8b57',
    secondary: '#d9f0e3',
  },
}

@Component({
  selector: 'app-detalle-alojamiento',
  imports: [CommonModule, ReactiveFormsModule, CalendarModule, RouterLink, ModalPago, Paginacion],
  templateUrl: './detalle-alojamiento.html',
  styleUrl: './detalle-alojamiento.css'
})
export class DetalleAlojamiento implements OnInit, OnDestroy {
  // ==================== PROPIEDADES ====================
  anfitiron: UsuarioDTO | undefined;
  alojamiento: AlojamientoDTO | undefined;
  metricas: MetricasDTO | undefined;
  resenas: ItemResenaDTO[] = [];

  cargando: boolean = false;
  cargandoResenas: boolean = false;
  errorCarga: boolean = false;

  reservaForm!: FormGroup;

  // Paginación de reseñas
  paginaResenas: number = 0;
  metadataResenas: PaginationMetadata | null = null;
  readonly TAMANO_PAGINA_RESENAS = 5;

  idAlojamiento: number = 0;

  // Gestión de imágenes
  imagenPrincipal: string = '';
  imagenesGaleria: string[] = [];

  // Cálculo de reserva
  precioTotal: number = 0;
  tarifaServicio: number = 0;
  numeroNoches: number = 0;

  // Calendario
  viewDate: Date = new Date();
  private seleccionandoEntrada: boolean = true;
  mesActual: boolean = true;
  events: CalendarEvent[] = [];
  locale: string = 'es';

  reservasConfirmadas: ItemReservaDTO[] = [];

  // Verificación de anfitrión propietario
  esAnfitrionPropietario: boolean = false;

  // ==================== PAGO (NUEVO) ====================
  mostrarModalPago: boolean = false;
  datosPago: { clientSecret: string; reservaId: number; monto: number } | null = null;

  // Subject para cancelar subscripciones
  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private formBuilder: FormBuilder,
    public alojamientoService: AlojamientoService,
    private reservaService: ReservaService,
    public tokenService: TokenService,
    private mapaService: MapaService,
    private mensajeHandlerService: MensajeHandlerService,
    public formUtilsService: FormUtilsService,
    public fechaService: FechaService,
    public precioService: PrecioService,
    public calificacionService: CalificacionService,
    private usuarioService: UsuarioService
  ) {
    this.route.params.subscribe(params => {
      this.idAlojamiento = params['id'];
    })
  }

  // ==================== CICLO DE VIDA ====================

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.idAlojamiento = +params['id'];
        if (this.idAlojamiento && !isNaN(this.idAlojamiento)) {
          this.crearFormularios();
          this.cargarDatosAlojamiento();
          this.confirmarMesActual();
        } else {
          this.mensajeHandlerService.showErrorWithCallback('ID de alojamiento no válido', () => {
            this.router.navigate(['/']).then(r => window.location.reload());
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== FORMULARIOS ====================

  private crearFormularios(): void {
    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    this.reservaForm = this.formBuilder.group({
      fechaEntrada: [hoy.toISOString().split('T')[0], [Validators.required]],
      fechaSalida: [manana.toISOString().split('T')[0], [Validators.required]],
      cantidadHuespedes: [1, [Validators.required, Validators.min(1)]]
    });

    this.reservaForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calcularPrecioTotal();
      });
  }

  // ==================== CARGA DE DATOS ====================

  private cargarDatosAlojamiento(): void {
    this.cargando = true;
    this.errorCarga = false;

    // Resetear paginación de reseñas
    this.paginaResenas = 0;
    this.resenas = [];
    this.metadataResenas = null;

    forkJoin({
      alojamiento: this.alojamientoService.obtenerPorId(this.idAlojamiento),
      metricas: this.alojamientoService.obtenerMetricas(this.idAlojamiento),
      resenas: this.alojamientoService.obtenerResenasAlojamiento(this.idAlojamiento, 0, this.TAMANO_PAGINA_RESENAS),
      reservasConfirmadas: this.alojamientoService.obtenerReservasAlojamiento(this.idAlojamiento, ReservaEstado.CONFIRMADA)
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.alojamiento = respuesta.alojamiento.data;
          this.metricas = respuesta.metricas.data;

          // Usar nueva estructura paginada para reseñas
          this.resenas = respuesta.resenas.data.content;
          this.metadataResenas = respuesta.resenas.data.pagination;

          this.reservasConfirmadas = respuesta.reservasConfirmadas.data.content;

          this.usuarioService.obtener(respuesta.alojamiento.data.anfitrionId).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.cargando = false)).subscribe({
            next: (respuesta) => {
              this.anfitiron = respuesta.data;
            },
            error: (error) => {
              const mensaje = this.mensajeHandlerService.handleHttpError(error);
              this.mensajeHandlerService.showError(mensaje);
            }
          });
          this.verificarPropietario();

          this.reservaForm.get('cantidadHuespedes')?.setValidators([
            Validators.required,
            Validators.min(1),
            Validators.max(this.alojamiento!.maxHuespedes)
          ]);
          this.reservaForm.get('cantidadHuespedes')?.updateValueAndValidity();

          this.configurarImagenes();
          this.calcularPrecioTotal();
          this.inicializarLogicaMapa();
          this.actualizarEventosCalendario();
        },
        error: (error) => {
          this.errorCarga = true;
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showErrorWithCallback(mensaje, () => {
            this.router.navigate(['/']).then(r => window.location.reload());
          });
        }
      });
  }

  private verificarPropietario(): void {
    if (!this.tokenService.isLogged() || !this.alojamiento) {
      this.esAnfitrionPropietario = false;
      return;
    }
    this.esAnfitrionPropietario = this.anfitiron?.id === this.tokenService.getUserId();
  }

  private inicializarLogicaMapa(): void {
    this.mapaService.create('map').pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const marcadorDTO: MarcadorDTO = {
          id: this.idAlojamiento,
          titulo: this.alojamiento!.titulo,
          fotoUrl: this.alojamiento!.imagenes[0],
          localizacion: {
            latitud: this.alojamiento!.direccion.localizacion.latitud,
            longitud: this.alojamiento!.direccion.localizacion.longitud
          }
        };
        this.mapaService.drawMarkers([marcadorDTO]);
        this.mapaService.mapInstance?.setCenter([this.alojamiento!.direccion.localizacion.longitud, this.alojamiento!.direccion.localizacion.latitud]);
      },
      error: (error) => {
        console.error('No se pudo cargar el mapa', error);
      }
    });
  }

  private configurarImagenes(): void {
    if (this.alojamiento && this.alojamiento.imagenes.length > 0) {
      this.imagenPrincipal = this.alojamiento.imagenes[0];
      this.imagenesGaleria = this.alojamiento.imagenes.slice(1, 5);
    }
  }

  // ==================== RESEÑAS ====================

  /**
   * Determina si hay más reseñas disponibles
   */
  get hayMasResenas(): boolean {
    return this.metadataResenas?.hasNext ?? false;
  }

  /**
   * Cambia a una página específica de reseñas (navegación compacta)
   */
  onResenasPageChange(nuevaPagina: number): void {
    if (this.cargandoResenas || nuevaPagina === this.paginaResenas) return;

    this.paginaResenas = nuevaPagina;
    this.cargarPaginaResenas();
  }

  /**
   * Carga las reseñas de la página actual
   */
  private cargarPaginaResenas(): void {
    this.cargandoResenas = true;

    this.alojamientoService.obtenerResenasAlojamiento(
      this.idAlojamiento,
      this.paginaResenas,
      this.TAMANO_PAGINA_RESENAS
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoResenas = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.resenas = respuesta.data.content;
          this.metadataResenas = respuesta.data.pagination;
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  /**
   * @deprecated Usar onResenasPageChange para navegación por páginas
   * Carga más reseñas (paginación incremental - legacy)
   */
  cargarMasResenas(): void {
    if (this.cargandoResenas || !this.hayMasResenas) return;

    this.cargandoResenas = true;
    this.paginaResenas++;

    this.alojamientoService.obtenerResenasAlojamiento(
      this.idAlojamiento,
      this.paginaResenas,
      this.TAMANO_PAGINA_RESENAS
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoResenas = false)
      )
      .subscribe({
        next: (respuesta) => {
          const nuevasResenas = respuesta.data.content;
          this.metadataResenas = respuesta.data.pagination;

          if (nuevasResenas.length > 0) {
            this.resenas = [...this.resenas, ...nuevasResenas];
          }
        },
        error: (error) => {
          this.paginaResenas--;
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  responderResena(resena: ItemResenaDTO): void {
    Swal.fire({
      title: 'Responder Reseña',
      html: `
        <div style="text-align: left; margin-bottom: 1rem;">
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
          if (charCount) charCount.textContent = textarea.value.length.toString();
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
        this.procesarRespuesta(resena.id, result.value.mensaje);
      }
    });
  }

  private procesarRespuesta(idResena: number, mensaje: string): void {
    this.mensajeHandlerService.showLoading('Publicando respuesta...')
    const dto: CreacionRespuestaDTO = { mensaje };
    this.alojamientoService.responderResena(this.idAlojamiento, idResena, dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showSuccess('Tu respuesta ha sido publicada exitosamente', '¡Respuesta publicada!')
          this.recargarResenas();
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  private recargarResenas(): void {
    this.paginaResenas = 0;
    this.alojamientoService.obtenerResenasAlojamiento(
      this.idAlojamiento,
      0,
      this.TAMANO_PAGINA_RESENAS
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          this.resenas = respuesta.data.content;
          this.metadataResenas = respuesta.data.pagination;
        },
        error: (error) => {
          console.error('Error al recargar reseñas:', error);
        }
      });
  }

  // ==================== RESERVA ====================

  realizarReserva(): void {
    if (this.reservaForm.invalid) {
      this.formUtilsService.marcarCamposComoTocados(this.reservaForm);
      return;
    }

    if (!this.tokenService.isLogged()) {
      this.mensajeHandlerService.showErrorWithCallback('Debes iniciar sesión para poder reservar.', () => {
        this.router.navigate(['/login']).then(r => window.location.reload());
      });
      return;
    }

    const fechaEntrada = new Date(this.reservaForm.value.fechaEntrada);
    const fechaSalida = new Date(this.reservaForm.value.fechaSalida);

    if (fechaEntrada >= fechaSalida) {
      this.mensajeHandlerService.showError('La fecha de salida debe ser posterior a la fecha de entrada.');
      return;
    }

    // Mostrar resumen antes de pagar
    Swal.fire({
      title: '¿Confirmar reserva?',
      html: `
        <div style="text-align: left;">
          <p><strong>Alojamiento:</strong> ${this.alojamiento!.titulo}</p>
          <p><strong>Check-in:</strong> ${this.fechaService.formatearFechaCompleta(fechaEntrada)}</p>
          <p><strong>Check-out:</strong> ${this.fechaService.formatearFechaCompleta(fechaSalida)}</p>
          <p><strong>Huéspedes:</strong> ${this.reservaForm.value.cantidadHuespedes}</p>
          <hr>
          <p><strong>Total:</strong> ${this.precioService.formatearPrecio(this.precioTotal)}</p>
          <p style="margin-top: 1rem; font-size: 0.9rem; color: #7F8C8D;">
            <i class="fa-solid fa-info-circle"></i>
            Solo se <strong>autorizará</strong> el cargo ahora. El cobro se efectúa cuando el anfitrión confirme.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Continuar al pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e8b57',
      cancelButtonColor: '#95a5a6'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesarReserva();
      }
    });
  }

  private procesarReserva(): void {
    if (!this.alojamiento) return;

    const idUsuario = this.tokenService.getUserId();
    if (!idUsuario) {
      this.mensajeHandlerService.showError('No se pudo identificar al usuario. Inicia sesión de nuevo.');
      return;
    }

    this.mensajeHandlerService.showLoading('Creando tu reserva...');

    const creacionReservaDTO: CreacionReservaDTO = {
      alojamientoId: this.idAlojamiento,
      usuarioId: this.tokenService.getUserId(),
      fechaEntrada: new Date(this.reservaForm.value.fechaEntrada + 'T00:00:00'),
      fechaSalida: new Date(this.reservaForm.value.fechaSalida + 'T00:00:00'),
      cantidadHuespedes: this.reservaForm.value.cantidadHuespedes
    };

    this.reservaService.crear(creacionReservaDTO)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          this.mensajeHandlerService.closeModal();

          // El backend puede devolver el DTO como objeto o como JSON string
          // (dependiendo de si el controlador ya cambió a RespuestaDTO<RespuestaCreacionReservaDTO>
          // o todavía usa RespuestaDTO<String>)
          let datos: CreacionReservaRespuestaDTO;
          if (typeof respuesta.data === 'string') {
            try {
              datos = JSON.parse(respuesta.data);
            } catch {
              this.mensajeHandlerService.showError('Error al procesar la respuesta del servidor.');
              return;
            }
          } else {
            datos = respuesta.data as CreacionReservaRespuestaDTO;
          }

          if (!datos?.pago || !datos?.reservaId || !datos?.precioTotal) {
            this.mensajeHandlerService.showError(
              'El servidor no devolvió los datos de pago. Verifica la configuración del backend.'
            );
            return;
          }

          this.datosPago = {
            clientSecret: datos.pago.clientSecret,
            reservaId: datos.reservaId,
            monto: datos.precioTotal
          };
          this.mostrarModalPago = true;
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== CALLBACKS DEL MODAL DE PAGO ====================

  onPagoExitoso(reservaId: number): void {
    this.mostrarModalPago = false;
    this.datosPago = null;
    this.mensajeHandlerService.showSuccessWithCallback(
      'Tu pago fue autorizado. El anfitrión revisará tu solicitud y recibirás una notificación.',
      '¡Pago Autorizado!',
      () => this.router.navigate(['/mis-reservas'])
    );
  }

  onPagoCancelado(): void {
    this.mostrarModalPago = false;
    this.datosPago = null;
    this.mensajeHandlerService.showWarning(
      'Pago cancelado. Tu reserva no ha sido confirmada. Puedes intentarlo desde "Mis Reservas".'
    );
  }

  // ==================== PRECIO ====================

  private calcularPrecioTotal(): void {
    if (!this.alojamiento) return;

    const fechaEntrada = new Date(this.reservaForm.value.fechaEntrada);
    const fechaSalida = new Date(this.reservaForm.value.fechaSalida);

    if (fechaEntrada < fechaSalida) {
      this.numeroNoches = Math.ceil((fechaSalida.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60 * 24));
      this.precioTotal = this.alojamiento.precioPorNoche * this.numeroNoches;
    } else {
      this.numeroNoches = 0;
      this.precioTotal = 0;
    }
  }

  // ==================== NAVEGACIÓN ====================

  volver(): void {
    this.location.back();
  }

  // ==================== CONTROLES CALENDARIO ====================

  mesAnterior(): void {
    this.viewDate = subMonths(this.viewDate, 1);
    this.confirmarMesActual();
  }

  mesSiguiente(): void {
    this.viewDate = addMonths(this.viewDate, 1);
    this.confirmarMesActual();
  }

  hoy(): void {
    this.viewDate = new Date();
    this.confirmarMesActual();
  }

  seleccionarDiaCalendario(day: CalendarMonthViewDay): void {
    const clickedDate = day.date;
    const clicked = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), clickedDate.getDate());

    const entradaVal = this.reservaForm.get('fechaEntrada')?.value;
    const salidaVal = this.reservaForm.get('fechaSalida')?.value;

    if (this.seleccionandoEntrada || !entradaVal) {
      const nuevaEntradaStr = this.fechaService.formatearParaInput(clicked);
      if (salidaVal) {
        const salidaDate = new Date(salidaVal + 'T00:00:00');
        if (clicked >= new Date(salidaDate.getFullYear(), salidaDate.getMonth(), salidaDate.getDate())) {
          this.reservaForm.patchValue({ fechaEntrada: nuevaEntradaStr, fechaSalida: null });
        } else {
          this.reservaForm.patchValue({ fechaEntrada: nuevaEntradaStr });
        }
      } else {
        this.reservaForm.patchValue({ fechaEntrada: nuevaEntradaStr, fechaSalida: null });
      }
      this.seleccionandoEntrada = false;
    } else {
      const nuevaSalidaStr = this.fechaService.formatearParaInput(clicked);
      const entradaDate = new Date((this.reservaForm.get('fechaEntrada')?.value || '') + 'T00:00:00');
      const entradaNormal = new Date(entradaDate.getFullYear(), entradaDate.getMonth(), entradaDate.getDate());

      if (!entradaVal) {
        this.reservaForm.patchValue({ fechaEntrada: nuevaSalidaStr, fechaSalida: null });
        this.seleccionandoEntrada = false;
      } else if (clicked <= entradaNormal) {
        this.reservaForm.patchValue({ fechaEntrada: nuevaSalidaStr, fechaSalida: null });
        this.seleccionandoEntrada = false;
      } else {
        this.reservaForm.patchValue({ fechaSalida: nuevaSalidaStr });
        this.seleccionandoEntrada = true;
      }
    }

    this.reservaForm.get('fechaEntrada')?.markAsTouched();
    this.reservaForm.get('fechaSalida')?.markAsTouched();
    this.reservaForm.updateValueAndValidity();
    this.calcularPrecioTotal();
  }

  private confirmarMesActual() {
    const hoy = new Date();
    const mismoMes = this.viewDate.getMonth() === hoy.getMonth();
    const mismoAnio = this.viewDate.getFullYear() === hoy.getFullYear();
    this.mesActual = mismoMes && mismoAnio;
  }

  private actualizarEventosCalendario(): void {
    this.events = this.reservasConfirmadas.map((reserva: ItemReservaDTO): CalendarEvent => {
      let color = CALENDAR_COLORS.confirmada;
      return {
        title: reserva.alojamiento.titulo,
        start: startOfDay(this.toLocalDate(reserva.fechaEntrada)),
        end: endOfDay(this.toLocalDate(reserva.fechaSalida)),
        color: { ...color },
        cssClass: 'cal-event-confirmed',
        meta: { id: reserva.id }
      };
    });
  }

  private toLocalDate(fecha: string | Date): Date {
    return typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : fecha;
  }

  // ==================== UTILIDADES ====================

  obtenerIniciales(): string {
    if (!this.anfitiron) return 'U';
    return this.anfitiron.nombre.charAt(0).toUpperCase();
  }

  cambiarImagenPrincipal(imagen: string): void {
    const imagenAnterior = this.imagenPrincipal;
    this.imagenPrincipal = imagen;
    const index = this.imagenesGaleria.indexOf(imagen);
    if (index !== -1) {
      this.imagenesGaleria[index] = imagenAnterior;
    }
  }
}

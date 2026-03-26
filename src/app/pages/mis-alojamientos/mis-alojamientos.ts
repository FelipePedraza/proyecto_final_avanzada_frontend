import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { PanelUsuario } from '../../components/panel-usuario/panel-usuario';
import { Paginacion } from '../../components/paginacion/paginacion';

//DTO
import { ItemAlojamientoDTO, MetricasDTO } from '../../models/alojamiento-dto';
import { PaginationMetadata } from '../../models/pagination-dto';

//Servicios
import { UsuarioService } from '../../services/usuario-service';
import { TokenService } from '../../services/token-service';
import { AlojamientoService } from '../../services/alojamiento-service';
import { MensajeHandlerService } from '../../services/mensajeHandler-service';
import { CalificacionService } from '../../services/calificacion-service';
import { PrecioService } from '../../services/precio-service';

@Component({
  selector: 'app-mis-alojamientos',
  imports: [ PanelUsuario, CommonModule, FormsModule, RouterLink, Paginacion],
  templateUrl: './mis-alojamientos.html',
  styleUrl: './mis-alojamientos.css'
})
export class MisAlojamientos implements OnDestroy, OnInit {

  // ==================== PROPIEDADES ====================
  alojamientos: ItemAlojamientoDTO[] = [];
  alojamientosFiltrados: ItemAlojamientoDTO[] = [];
  terminoBusqueda: string = '';
  cargando: boolean = false;
  metricasPorAlojamiento: Map<number, MetricasDTO> = new Map();
  paginaActual: number = 0;
  metadataPaginacion: PaginationMetadata | null = null;
  readonly TAMANO_PAGINA = 5;
  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================
  constructor(
    public alojamientoService: AlojamientoService,
    private usuarioService: UsuarioService,
    private mensajeHandlerService: MensajeHandlerService,
    public calificacionService: CalificacionService,
    public precioService: PrecioService,
    private tokenService: TokenService
  ) { }

  // ==================== CICLO DE VIDA ====================
  ngOnInit(): void {
    this.cargarAlojamientosIniciales();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== MÉTODOS PÚBLICOS ====================

  /**
   * Filtra alojamientos localmente según el término de búsqueda
   */
  filtrarAlojamientos(): void {
    if (!this.terminoBusqueda.trim()) {
      this.alojamientosFiltrados = [...this.alojamientos];
      return;
    }

    const terminoLower = this.terminoBusqueda.toLowerCase().trim();
    this.alojamientosFiltrados = this.alojamientos.filter(a =>
      a.titulo.toLowerCase().includes(terminoLower) ||
      a.direccion.ciudad.toLowerCase().includes(terminoLower)
    );
  }

  /**
   * Limpia la búsqueda y restaura todos los alojamientos
   */
  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.alojamientosFiltrados = [...this.alojamientos];
  }

  /**
   * Confirma y elimina un alojamiento
   */
  confirmarEliminar(id: number, titulo: string): void {
    this.mensajeHandlerService.confirmDanger(
      `Se eliminará el alojamiento "${titulo}"`,
      'Sí, eliminar',
      '¿Estás seguro?'
    ).then((result) => {
      if (result) {
        this.eliminarAlojamiento(id);
      }
    });
  }

  /**
   * Cambia a una página específica (navegación por páginas numéricas)
   */
  onPageChange(nuevaPagina: number): void {
    if (this.cargando || nuevaPagina === this.paginaActual) return;

    this.paginaActual = nuevaPagina;
    this.cargarPaginaAlojamientos();
  }

  /**
   * Cambia el tamaño de página y recarga
   */
  onPageSizeChange(nuevoTamano: number): void {
    this.paginaActual = 0;
    // El tamaño de página se maneja automáticamente por el componente de paginación
    // y el backend, pero podemos recargar con el nuevo tamaño si es necesario
    this.cargarPaginaAlojamientos();
  }

  /**
   * Carga los alojamientos de la página actual
   */
  private cargarPaginaAlojamientos(): void {
    const idUsuario = this.tokenService.getUserId();
    if (!idUsuario) return;

    this.cargando = true;

    this.usuarioService.obtenerAlojamientosUsuario(idUsuario, this.paginaActual, this.TAMANO_PAGINA)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.alojamientos = respuesta.data.content;
          this.metadataPaginacion = respuesta.data.pagination;
          this.alojamientosFiltrados = [...this.alojamientos];

          // Cargar métricas para los alojamientos de la página actual
          this.alojamientos.forEach(alojamiento => {
            this.cargarMetricas(alojamiento.id);
          });

          // Scroll al inicio de la lista
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Carga los alojamientos iniciales del usuario
   */
  private cargarAlojamientosIniciales(): void {
    const idUsuario = this.tokenService.getUserId();
    this.paginaActual = 0;
    this.cargando = true;

    this.usuarioService.obtenerAlojamientosUsuario(idUsuario, this.paginaActual, this.TAMANO_PAGINA)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.alojamientos = respuesta.data.content;
          this.metadataPaginacion = respuesta.data.pagination;
          this.alojamientosFiltrados = [...this.alojamientos];

          this.alojamientos.forEach(alojamiento => {
            this.cargarMetricas(alojamiento.id);
          });
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  /**
   * Carga las métricas de un alojamiento específico
   */
  private cargarMetricas(idAlojamiento: number): void {
    this.alojamientoService.obtenerMetricas(idAlojamiento)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          this.metricasPorAlojamiento.set(idAlojamiento, respuesta.data);
        },
        error: (error) => {
          console.error(`Error al cargar métricas para alojamiento ${idAlojamiento}:`, error);
        }
      });
  }

  /**
   * Elimina un alojamiento del sistema
   */
  private eliminarAlojamiento(id: number): void {
    this.alojamientoService.eliminar(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          this.mensajeHandlerService.showSuccess(respuesta.data, '¡Eliminado!');
          // Remover de las listas
          this.alojamientos = this.alojamientos.filter(a => a.id !== id);
          this.filtrarAlojamientos();
          this.metricasPorAlojamiento.delete(id);
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }
}

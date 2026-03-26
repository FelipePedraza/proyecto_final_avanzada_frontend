import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AlojamientoItem } from '../../components/alojamiento-item/alojamiento-item';
import { BarraBusqueda } from '../../components/barra-busqueda/barra-busqueda';
import { Paginacion } from '../../components/paginacion/paginacion';

// Servicios
import { AlojamientoService } from '../../services/alojamiento-service';

//DTOs
import { ItemAlojamientoDTO, AlojamientoFiltroDTO } from '../../models/alojamiento-dto';
import { PaginationMetadata } from '../../models/pagination-dto';

@Component({
  selector: 'app-busqueda',
  imports: [CommonModule, FormsModule, AlojamientoItem, BarraBusqueda, Paginacion],
  templateUrl: './busqueda.html',
  styleUrl: './busqueda.css'
})
export class Busqueda implements OnInit, OnDestroy {

  // ==================== PROPIEDADES ====================

  // Resultados
  alojamientos: ItemAlojamientoDTO[] = [];
  totalResultados: number = 0;

  // Filtros desde URL (se actualizan con la barra de búsqueda)
  filtrosBase: Partial<AlojamientoFiltroDTO> = {};

  // Filtros adicionales del sidebar
  precioMin: number = 0;
  precioMax: number = 0;

  // Paginación
  paginaActual: number = 0;
  metadataPaginacion: PaginationMetadata | null = null;
  readonly ITEMS_POR_PAGINA = 10;

  // Ordenamiento
  ordenamientoActual: string = 'creadoEn,desc';

  // Estados
  cargando: boolean = false;
  errorCarga: boolean = false;
  error: string = '';

  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================

  constructor(
    private route: ActivatedRoute,
    private alojamientoService: AlojamientoService,
  ) {}

  // ==================== CICLO DE VIDA ====================

  ngOnInit(): void {
    this.suscribirAQueryParams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INICIALIZACIÓN ====================

  private suscribirAQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        // Construir filtros base desde URL
        this.filtrosBase = {};

        if (params['ciudad']) {
          this.filtrosBase.ciudad = params['ciudad'];
        }

        if (params['fechaEntrada']) {
          this.filtrosBase.fechaEntrada = params['fechaEntrada'];
        }

        if (params['fechaSalida']) {
          this.filtrosBase.fechaSalida = params['fechaSalida'];
        }

        if (params['huespedes']) {
          this.filtrosBase.huespedes = +params['huespedes'];
        }

        if (params['servicios']) {
          this.filtrosBase.servicios = params['servicios'].split(',').filter((s: string) => s);
        }

        // Resetear paginación al cambiar filtros
        this.paginaActual = 0;
        this.buscarAlojamientos();
      });
  }

  // ==================== BÚSQUEDA ====================

  private buscarAlojamientos(): void {
    this.cargando = true;
    this.errorCarga = false;

    // Construir el objeto AlojamientoFiltroDTO completo
    const filtros: Partial<AlojamientoFiltroDTO> = {
      ...this.filtrosBase
    };

    // Agregar filtros adicionales del sidebar solo si tienen valor
    if (this.precioMin > 0) {
      filtros.precioMin = this.precioMin;
    }

    if (this.precioMax > 0) {
      filtros.precioMax = this.precioMax;
    }

    // Llamar al servicio con paginación
    this.alojamientoService.obtenerAlojamientos(
      filtros,
      this.paginaActual,
      this.ITEMS_POR_PAGINA,
      this.ordenamientoActual
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.alojamientos = respuesta.data.content;
          this.metadataPaginacion = respuesta.data.pagination;
          this.totalResultados = respuesta.data.pagination.totalElements;
        },
        error: (error) => {
          console.error('Error al buscar alojamientos:', error);
          this.error = error.error?.data || 'Error al cargar los alojamientos';
          this.errorCarga = true;
        }
      });
  }

  // ==================== FILTROS ====================

  aplicarFiltros(): void {
    this.paginaActual = 0;
    this.buscarAlojamientos();
  }

  limpiarFiltros(): void {
    this.precioMin = 0;
    this.precioMax = 0;
    this.aplicarFiltros();
  }

  // ==================== ORDENAMIENTO ====================

  cambiarOrdenamiento(campo: string, direccion: 'asc' | 'desc'): void {
    this.ordenamientoActual = `${campo},${direccion}`;
    this.paginaActual = 0;
    this.buscarAlojamientos();
  }

  // ==================== PAGINACIÓN ====================

  irAPagina(pagina: number): void {
    if (pagina >= 0 && this.metadataPaginacion && pagina < this.metadataPaginacion.totalPages) {
      this.paginaActual = pagina;
      this.buscarAlojamientos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onPageChange(nuevaPagina: number): void {
    this.irAPagina(nuevaPagina);
  }

  onPageSizeChange(nuevoTamano: number): void {
    // Si el backend soporta cambio de tamaño de página dinámico
    // (requeriría actualizar el servicio)
    this.paginaActual = 0;
    this.buscarAlojamientos();
  }

  // Métodos legacy para compatibilidad con template existente
  generarPaginas(): number[] {
    if (!this.metadataPaginacion) return [];

    const paginas: number[] = [];
    const rango = 2;
    const totalPages = this.metadataPaginacion.totalPages;
    const currentPage = this.metadataPaginacion.currentPage;

    for (let i = 0; i < totalPages; i++) {
      if (
        i === 0 ||
        i === totalPages - 1 ||
        (i >= currentPage - rango && i <= currentPage + rango)
      ) {
        paginas.push(i);
      }
    }

    return paginas;
  }

  mostrarEllipsis(index: number, paginas: number[]): boolean {
    if (index === 0) return false;
    return paginas[index] - paginas[index - 1] > 1;
  }

}

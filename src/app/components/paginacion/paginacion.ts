import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaginationMetadata } from '../../models/pagination-dto';

/**
 * Componente reutilizable de paginación
 * Muestra controles de navegación entre páginas y permite cambiar el tamaño de página
 */
@Component({
  selector: 'app-paginacion',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './paginacion.html',
  styleUrl: './paginacion.css'
})
export class Paginacion implements OnInit {

  // ==================== INPUTS ====================

  /**
   * Metadatos de paginación del backend
   * Si se proporciona, se usan sus valores para mostrar información
   */
  @Input() metadata: PaginationMetadata | null = null;

  /**
   * Página actual (0-based)
   * Si no se proporciona metadata, se usa este valor directamente
   */
  @Input() currentPage: number = 0;

  /**
   * Total de páginas disponibles
   * Si no se proporciona metadata, se usa este valor directamente
   */
  @Input() totalPages: number = 0;

  /**
   * Indica si hay página anterior
   * Si no se proporciona metadata, se usa este valor directamente
   */
  @Input() hasPrevious: boolean = false;

  /**
   * Indica si hay página siguiente
   * Si no se proporciona metadata, se usa este valor directamente
   */
  @Input() hasNext: boolean = false;

  /**
   * Tamaño de página actual
   */
  @Input() pageSize: number = 10;

  /**
   * Opciones de tamaño de página disponibles
   */
  @Input() pageSizeOptions: number[] = [5, 10, 20, 50];

  /**
   * Indica si debe mostrar el selector de tamaño de página
   */
  @Input() showPageSizeSelector: boolean = false;

  /**
   * Indica si debe mostrar la información de "X de Y resultados"
   */
  @Input() showInfo: boolean = true;

  /**
   * Indica si debe mostrar los botones de primera/última página
   */
  @Input() showFirstLast: boolean = true;

  /**
   * Indica si debe usar el estilo compacto (solo anterior/siguiente)
   */
  @Input() compactMode: boolean = false;

  // ==================== OUTPUTS ====================

  /**
   * Emite cuando cambia la página (valor 0-based)
   */
  @Output() pageChange = new EventEmitter<number>();

  /**
   * Emite cuando cambia el tamaño de página
   */
  @Output() pageSizeChange = new EventEmitter<number>();

  // ==================== PROPIEDADES COMPUTADAS ====================

  /**
   * Página actual basada en metadata o inputs
   */
  get paginaActual(): number {
    return this.metadata?.currentPage ?? this.currentPage;
  }

  /**
   * Total de páginas basado en metadata o inputs
   */
  get totalPaginas(): number {
    return this.metadata?.totalPages ?? this.totalPages;
  }

  /**
   * Indica si hay página anterior
   */
  get tieneAnterior(): boolean {
    return this.metadata?.hasPrevious ?? this.hasPrevious ?? this.paginaActual > 0;
  }

  /**
   * Indica si hay página siguiente
   */
  get tieneSiguiente(): boolean {
    return this.metadata?.hasNext ?? this.hasNext ?? this.paginaActual < this.totalPaginas - 1;
  }

  /**
   * Total de elementos
   */
  get totalElementos(): number {
    return this.metadata?.totalElements ?? 0;
  }

  /**
   * Texto informativo de resultados
   */
  get infoTexto(): string {
    if (!this.metadata && this.totalElementos === 0) {
      return '';
    }

    const inicio = this.paginaActual * (this.metadata?.pageSize ?? this.pageSize) + 1;
    const fin = Math.min((this.paginaActual + 1) * (this.metadata?.pageSize ?? this.pageSize), this.totalElementos);

    return `${inicio} - ${fin} de ${this.totalElementos} resultados`;
  }

  // ==================== MÉTODOS DEL CICLO DE VIDA ====================

  ngOnInit(): void {
    // Inicialización si es necesaria
  }

  // ==================== MÉTODOS PÚBLICOS ====================

  /**
   * Navega a una página específica
   */
  irAPagina(pagina: number): void {
    if (pagina >= 0 && pagina < this.totalPaginas && pagina !== this.paginaActual) {
      this.pageChange.emit(pagina);
    }
  }

  /**
   * Navega a la página anterior
   */
  paginaAnterior(): void {
    if (this.tieneAnterior) {
      this.irAPagina(this.paginaActual - 1);
    }
  }

  /**
   * Navega a la página siguiente
   */
  paginaSiguiente(): void {
    if (this.tieneSiguiente) {
      this.irAPagina(this.paginaActual + 1);
    }
  }

  /**
   * Navega a la primera página
   */
  primeraPagina(): void {
    this.irAPagina(0);
  }

  /**
   * Navega a la última página
   */
  ultimaPagina(): void {
    this.irAPagina(this.totalPaginas - 1);
  }

  /**
   * Cambia el tamaño de página
   */
  cambiarTamanoPagina(nuevoTamano: number): void {
    if (nuevoTamano !== this.pageSize) {
      this.pageSizeChange.emit(nuevoTamano);
    }
  }

  /**
   * Genera el array de números de página a mostrar
   * Usa el algoritmo de ventana deslizante con elipses
   */
  generarPaginas(): (number | string)[] {
    const paginas: (number | string)[] = [];
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const rango = 2; // Número de páginas a mostrar a cada lado de la actual

    if (total <= 7) {
      // Mostrar todas las páginas si son pocas
      for (let i = 0; i < total; i++) {
        paginas.push(i);
      }
    } else {
      // Siempre mostrar primera página
      paginas.push(0);

      // Calcular rango alrededor de la página actual
      let inicioRango = Math.max(1, actual - rango);
      let finRango = Math.min(total - 2, actual + rango);

      // Ajustar si estamos cerca del inicio
      if (actual <= rango + 1) {
        finRango = Math.min(total - 2, 4);
      }

      // Ajustar si estamos cerca del final
      if (actual >= total - rango - 2) {
        inicioRango = Math.max(1, total - 5);
      }

      // Agregar elipse si hay gap
      if (inicioRango > 1) {
        paginas.push('...');
      }

      // Agregar páginas del rango
      for (let i = inicioRango; i <= finRango; i++) {
        paginas.push(i);
      }

      // Agregar elipse si hay gap
      if (finRango < total - 2) {
        paginas.push('...');
      }

      // Siempre mostrar última página
      paginas.push(total - 1);
    }

    return paginas;
  }

  /**
   * Determina si un item es una elipse
   */
  esElipse(item: number | string): boolean {
    return item === '...';
  }
}

/**
 * Metadatos de paginación para respuestas del backend
 * Corresponde a la metadata del PageResponseDTO del backend
 */
export interface PaginationMetadata {
  currentPage: number;      // Página actual (0-based)
  pageSize: number;          // Tamaño de la página
  totalElements: number;   // Total de elementos en la base de datos
  totalPages: number;        // Total de páginas disponibles
  first: boolean;           // Indica si es la primera página
  last: boolean;             // Indica si es la última página
  hasNext: boolean;         // Indica si hay página siguiente
  hasPrevious: boolean;     // Indica si hay página anterior
}

/**
 * Respuesta paginada genérica del backend
 * Corresponde a PageResponseDTO<T> del backend
 */
export interface PageResponseDTO<T> {
  content: T[];                    // Lista de elementos
  pagination: PaginationMetadata;  // Metadatos de paginación
}

/**
 * Respuesta estándar del API con datos paginados
 * Envuelve PageResponseDTO dentro de la estructura estándar de respuesta
 */
export interface PaginatedRespuestaDTO<T> {
  error: boolean;
  data: PageResponseDTO<T>;
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AlojamientoItem } from '../../components/alojamiento-item/alojamiento-item';
import { BarraBusqueda } from '../../components/barra-busqueda/barra-busqueda';

//DTO
import { ItemAlojamientoDTO } from '../../models/alojamiento-dto';
import { PaginationMetadata } from '../../models/pagination-dto';

//Servicios
import { CiudadService} from '../../services/ciudad-service';
import { AlojamientoService } from '../../services/alojamiento-service';

@Component({
  selector: 'app-inicio',
  imports: [CommonModule, AlojamientoItem, BarraBusqueda],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css'
})
export class Inicio implements OnInit, OnDestroy {

  // Alojamientos populares (sin filtros)
  alojamientosPopulares: ItemAlojamientoDTO[] = [];
  metadataPopulares: PaginationMetadata | null = null;

  // Alojamientos sugeridos por ciudad
  alojamientosSugeridos: ItemAlojamientoDTO[] = [];
  metadataSugeridos: PaginationMetadata | null = null;
  ciudadSugerida: string = '';
  ciudades: string[] = [];

  // Estados de carga
  cargandoPopulares: boolean = false;
  cargandoSugeridos: boolean = false;
  cargandoReservas: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private alojamientoService: AlojamientoService, private ciudadService: CiudadService) { }

  ngOnInit(): void {
    this.cargarAlojamientosPopulares();
    this.cargarAlojamientosSugeridos();
    this.inicializarSlideshow();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga los alojamientos más populares (primeros resultados sin filtros)
   */
  private cargarAlojamientosPopulares(): void {
    this.cargandoPopulares = true;

    this.alojamientoService.obtenerAlojamientos({}, 0, 8, 'promedioCalificaciones,desc')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoPopulares = false)
      )
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.error) {
            this.alojamientosPopulares = respuesta.data.content.slice(0, 8); // Máximo 8
            this.metadataPopulares = respuesta.data.pagination;
          }
        },
        error: (error) => {
          console.error('Error al cargar alojamientos populares:', error);
        }
      });
  }

  /**
   * Carga alojamientos sugeridos basados en una ciudad predeterminada
   */
  private cargarAlojamientosSugeridos(): void {
    // Cargar ciudades para sugerencias rotativas
    this.ciudadService.obtenerCiudades()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.error) {
            this.ciudades = respuesta.data;
          }
        },
        error: (error) => console.error('Error al cargar ciudades:', error)
      });

    // Seleccionar ciudad aleatoria
    const ciudadAleatoria = this.ciudades[
      Math.floor(Math.random() * this.ciudades.length)
      ];

    this.ciudadSugerida = ciudadAleatoria;
    this.cargandoSugeridos = true;

    this.alojamientoService.sugerirAlojamientos(ciudadAleatoria, 0, 4)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoSugeridos = false)
      )
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.error) {
            this.alojamientosSugeridos = respuesta.data.content.slice(0, 4); // Máximo 4
            this.metadataSugeridos = respuesta.data.pagination;
          }
        },
        error: (error) => {
          console.error('Error al cargar alojamientos sugeridos:', error);
        }
      });
  }

  /**
   * Inicializa el slideshow de imágenes del hero
   */
  private inicializarSlideshow(): void {
    let currentSlide = 0;
    const totalSlides = 5;

    const showSlide = (index: number) => {
      for (let i = 1; i <= totalSlides; i++) {
        const slide = document.querySelector(`.slide-${i}`);
        if (slide) {
          slide.classList.remove('active');
        }
      }

      const activeSlide = document.querySelector(`.slide-${index + 1}`);
      if (activeSlide) {
        activeSlide.classList.add('active');
      }
    };

    const nextSlide = () => {
      currentSlide = (currentSlide + 1) % totalSlides;
      showSlide(currentSlide);
    };

    // Mostrar primer slide
    setTimeout(() => showSlide(0), 100);

    // Cambiar cada 4 segundos
    setInterval(nextSlide, 4000);
  }
}

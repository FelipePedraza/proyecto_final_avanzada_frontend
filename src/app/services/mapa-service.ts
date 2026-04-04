import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import mapboxgl, { LngLatLike, Map, Marker, MapMouseEvent } from 'mapbox-gl';
import { MarcadorDTO } from '../models/marcador-dto';
import {environment} from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MapaService implements OnDestroy {

  private map?: Map;
  private markers: Marker[] = [];
  private currentLocation: LngLatLike = [-75.6727, 4.53252];
  private readonly MAPBOX_TOKEN= environment.mapboxToken;
  private destroy$ = new Subject<void>();
  private marcadorElemento = document.createElement('div');


  constructor() {
    (mapboxgl as any).workerUrl = '/mapbox-gl-csp-worker.js';
    mapboxgl.accessToken = this.MAPBOX_TOKEN;
    this.marcadorElemento.innerHTML = `      <div class="logo-icon">
        <i class="fa-solid fa-house-chimney logo-house"></i>
      </div>`;
  }

  /** Inicializa el mapa dentro del contenedor especificado */
  public create(containerId: string = 'map'): Observable<void> {

    // Retornamos un NUEVO Observable que envuelve toda la lógica asíncrona
    return new Observable<void>((observer) => {

      if (this.map) {
        this.map.remove();
      }

      // 1. Función interna para crear el mapa
      // (La llamaremos después de la geolocalización)
      const initMap = (lngLat: LngLatLike) => {

        this.map = new mapboxgl.Map({
          container: containerId,
          style: 'mapbox://styles/mapbox/standard',
          center: lngLat, // Usa la ubicación resuelta
          zoom: 17,
          pitch: 45,
        });

        this.map.addControl(new mapboxgl.NavigationControl());
        this.map.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
          })
        );

        // 2. Escuchar el evento 'load' del mapa
        this.map.on('load', () => {
          console.log('Mapa completamente cargado y listo.');

          // 3. ¡ÉXITO! Notificar al suscriptor y completar
          observer.next();
        });

        // Manejar errores de carga del mapa
        this.map.on('error', (err) => {
          observer.error(err); // Notificar un error
        });
      };

      // 4. Intentar obtener la geolocalización
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // ÉXITO Geo: Iniciar mapa con ubicación del usuario
            const { longitude, latitude } = position.coords;
            initMap([longitude, latitude]);
          },
          (error) => {
            // ERROR Geo: Iniciar mapa con ubicación por defecto
            console.warn('Error de geolocalización, usando default:', error.message);
            initMap(this.currentLocation); // this.currentLocation es tu valor por defecto
          }
        );
      } else {
        // NO SOPORTADO: Iniciar mapa con ubicación por defecto
        console.warn('Geolocalización no soportada.');
        initMap(this.currentLocation);
      }

      // 5. Definir la limpieza (si el componente se destruye
      //    antes de que el mapa cargue)
      return () => {
        if (this.map) {
          this.map.remove();
          this.map = undefined;
        }
      };

    });
  }

  /** Dibuja varios marcadores con popup */
  public drawMarkers(places: MarcadorDTO[]): void {

    if (!this.map) return;

    this.clearMarkers();

    places.forEach(({ id, titulo, fotoUrl, localizacion }) => {
      const popupHtml = `
        <strong>${titulo}</strong>
        <div>
          <img src="${fotoUrl}" alt="Imagen" style="width: 100px; height: 100px;">
        </div>
        <a href="/alojamiento/${id}">Ver más</a>
      `;

      new mapboxgl.Marker({ element: this.marcadorElemento })
        .setLngLat([localizacion.longitud, localizacion.latitud])
        .setPopup(new mapboxgl.Popup().setHTML(popupHtml))
        .addTo(this.map!);
    });
  }

  /** Devuelve el mapa actual (si existe) */
  public get mapInstance(): Map | undefined {
    return this.map;
  }

  /** Limpieza al destruir el servicio */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  public addMarker(): Observable<mapboxgl.LngLat> {
    return new Observable((observer) => {
      if (!this.map) {
        observer.error('Mapa no inicializado');
        return;
      }

      // Limpia los marcadores existentes y agrega uno nuevo en la posición del click
      const onClick = (e: MapMouseEvent) => {
        this.clearMarkers();

        const marker = new mapboxgl.Marker({ element: this.marcadorElemento })
          .setLngLat(e.lngLat)
          .addTo(this.map!);

        this.markers.push(marker);
        // Emite las coordenadas del marcador al observador
        observer.next(marker.getLngLat());
      };

      this.map.on('click', onClick);

      // Limpieza al desuscribirse
      return () => {
        this.map?.off('click', onClick);
      };
    });

  }

  public clearMarkers(): void {
    if (this.markers.length > 0) {
      this.markers.forEach(marker => marker.remove());
      this.markers = [];
    }
  }

}

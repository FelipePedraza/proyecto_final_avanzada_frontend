import { Component} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { UsuarioService } from '../../services/usuario-service';
import { UsuarioDTO } from '../../models/usuario-dto';
import { TokenService} from '../../services/token-service';
import { FechaService } from '../../services/fecha-service';

@Component({
  selector: 'app-panel-usuario',
  imports: [RouterLink, CommonModule],
  templateUrl: './panel-usuario.html',
  standalone: true,
  styleUrl: './panel-usuario.css'
})
export class PanelUsuario {
  usuario: UsuarioDTO | null = null;
  cargando = false;

  private destroy$ = new Subject<void>();

  constructor(
    private usuarioService: UsuarioService,
    private tokenService: TokenService,
    public fechaService: FechaService,
    private router: Router
  ) {
    this.cargarUsuario()
  }


  private cargarUsuario(): void {
    const usuarioId = this.tokenService.getUserId();

    if (!usuarioId) {
      this.router.navigate(['/login']);
      return;
    }

    this.cargando = true;

    this.usuarioService.obtener(usuarioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.error) {
            this.usuario = respuesta.data;
          }
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error al cargar usuario:', error);
          this.cargando = false;
        }
      });
  }

  cerrarSesion(): void {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Estás seguro de que deseas cerrar sesión?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e8b57',
      cancelButtonColor: '#95a5a6'
    }).then((result) => {
      if (result.isConfirmed) {
        this.tokenService.logout();
        this.usuario = null;
        this.router.navigate(['/']).then(r => window.location.reload());
      }
    });
  }

  obtenerIniciales(): string {
    if (!this.usuario) return 'U';
    return this.usuario.nombre.charAt(0).toUpperCase();
  }
}

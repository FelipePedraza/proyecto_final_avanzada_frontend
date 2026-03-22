import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { PanelUsuario } from '../../components/panel-usuario/panel-usuario';
import Swal from 'sweetalert2';

// Servicios
import { UsuarioService } from '../../services/usuario-service';
import { TokenService } from '../../services/token-service';
import { ImagenService } from '../../services/imagen-service';
import { MensajeHandlerService } from '../../services/mensajeHandler-service';
import { FormUtilsService } from '../../services/formUtils-service';
import { FechaService } from '../../services/fecha-service';
// DTOs
import { UsuarioDTO, EdicionUsuarioDTO, CambioContrasenaDTO, CreacionAnfitrionDTO, AnfitrionPerfilDTO } from '../../models/usuario-dto';

@Component({
  selector: 'app-editar-perfil',
  imports: [CommonModule, ReactiveFormsModule, PanelUsuario],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.css'
})
export class EditarPerfil implements OnInit, OnDestroy {

  // ==================== PROPIEDADES ====================

  perfilForm!: FormGroup;
  seguridadForm!: FormGroup;
  anfitrionForm!: FormGroup;

  usuario: UsuarioDTO | null = null;
  anfitrionInfo: AnfitrionPerfilDTO | null = null;
  tabActiva: 'personal' | 'seguridad' | 'anfitrion' = 'personal';

  // Estados
  cargando = false;
  cargandoUsuario = false;
  cargandoAnfitrion = false;
  subiendoImagen = false;
  subiendoDocumento = false;
  mostrarContrasenaActual = false;
  mostrarNuevaContrasena = false;
  mostrarConfirmarContrasena = false;


  // Foto de perfil
  fotoPreview: string = '';
  fotoSubida: string = '';

  // Documento legal
  documentoSubido: string = '';
  nombreDocumentoSubido: string = '';

  // Validación de contraseña
  validacionContrasena = {
    tieneLongitud: false,
    tieneMayuscula: false,
    tieneNumero: false
  };

  private destroy$ = new Subject<void>();

  // ==================== CONSTRUCTOR ====================

  constructor(
    private formBuilder: FormBuilder,
    private usuarioService: UsuarioService,
    private tokenService: TokenService,
    private imagenService: ImagenService,
    private mensajeHandlerService: MensajeHandlerService,
    public formUtilsService: FormUtilsService,
    public fechaService: FechaService,
    private router: Router
  ) {}

  // ==================== CICLO DE VIDA ====================

  ngOnInit(): void {
    this.crearFormularios();
    this.cargarDatosUsuario();
    this.configurarValidacionContrasena();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INICIALIZACIÓN ====================

  private crearFormularios(): void {
    // Formulario de perfil
    this.perfilForm = this.formBuilder.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      telefono: ['', [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(10),
        Validators.pattern(/^[0-9]{10}$/)
      ]],
      fechaNacimiento: ['', [Validators.required, this.formUtilsService.edadMinimaValidador(18)]],
      foto: ['']
    });

    // Formulario de seguridad
    this.seguridadForm = this.formBuilder.group({
      contrasenaActual: ['', [Validators.required, Validators.minLength(8)]],
      contrasenaNueva: ['', [
        Validators.required,
        Validators.minLength(8),
        this.formUtilsService.contrasenaFuerteValidador()
      ]],
      confirmarContrasena: ['', [Validators.required]]
    }, { validators: this.formUtilsService.contrasenasMatchValidador() });

    // Formulario de anfitrion
    this.anfitrionForm = this.formBuilder.group({
      sobreMi: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(1000)]],
      documentoLegal: [null, [Validators.required]] // Para validar que el archivo fue seleccionado
    });
  }

  private cargarDatosUsuario(): void {
    const usuarioId = this.tokenService.getUserId();

    if (!usuarioId) {
      this.router.navigate(['/login']);
      return;
    }

    this.cargandoUsuario = true;

    this.usuarioService.obtener(usuarioId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoUsuario = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.usuario = respuesta.data;
          this.fotoPreview = this.usuario!.foto || '';
          this.fotoSubida = this.usuario!.foto || '';

          // Llenar el formulario con los datos del usuario
          this.perfilForm.patchValue({
            nombre: this.usuario!.nombre,
            telefono: this.usuario!.telefono,
            foto: this.usuario!.foto,
            fechaNacimiento: this.usuario!.fechaNacimiento
          });

          // Si es anfitrión, cargar su información
          if (this.usuario!.esAnfitrion) {
            this.cargarDatosAnfitrion(usuarioId);
          }
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  private cargarDatosAnfitrion(usuarioId: string): void {
    this.cargandoAnfitrion = true;
    this.usuarioService.obtenerAnfitrion(usuarioId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargandoAnfitrion = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.anfitrionInfo = respuesta.data;
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  private configurarValidacionContrasena(): void {
    this.seguridadForm.get('contrasenaNueva')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.validacionContrasena.tieneLongitud = value?.length >= 8;
        this.validacionContrasena.tieneMayuscula = /[A-Z]/.test(value);
        this.validacionContrasena.tieneNumero = /\d/.test(value);
      });
  }

  // ==================== NAVEGACIÓN DE TABS ====================

  cambiarTab(tab: 'personal' | 'seguridad' | 'anfitrion'): void {
    this.tabActiva = tab;

    // Resetear formulario de seguridad al cambiar de tab
    if (tab === 'personal') {
      this.seguridadForm.reset();
    }
  }

  // ==================== FOTO DE PERFIL ====================

  seleccionarImagen(event: any): void {
    const file: File = event.target.files[0];

    if (!file) return;

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.mensajeHandlerService.showError('La imagen no puede pesar más de 5MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      this.mensajeHandlerService.showError('Solo se permiten archivos de imagen');
      return;
    }

    // Preview local
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.fotoPreview = e.target.result;
    };
    reader.readAsDataURL(file);

    // Subir a Cloudinary
    this.subirImagen(file);
  }

  private subirImagen(file: File): void {
    this.subiendoImagen = true;

    this.imagenService.subirImagen(file)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.subiendoImagen = false)
      )
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.error) {
            this.fotoSubida = respuesta.data.url;
            this.perfilForm.patchValue({ foto: respuesta.data.url });
          }
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.fotoPreview = this.fotoSubida; // Restaurar preview anterior
        }
      });
  }

  // ==================== GUARDAR INFORMACIÓN PERSONAL ====================

  guardarPerfil(): void {
    if (this.perfilForm.invalid) {
      this.formUtilsService.marcarCamposComoTocados(this.perfilForm);
      return;
    }

    const usuarioId = this.tokenService.getUserId();

    if (!usuarioId) {
      this.mensajeHandlerService.showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
      this.router.navigate(['/login']);
      return;
    }

    this.cargando = true;

    const edicionUsuarioDTO = this.perfilForm.value as EdicionUsuarioDTO;

    this.usuarioService.editar(usuarioId, edicionUsuarioDTO)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.mensajeHandlerService.showSuccessWithCallback(
            respuesta.data, '¡Perfil actualizado!',
            () => {
              this.cargarDatosUsuario();
            }
          );
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== CAMBIAR CONTRASEÑA ====================

  cambiarContrasena(): void {
    if (this.seguridadForm.invalid) {
      this.formUtilsService.marcarCamposComoTocados(this.seguridadForm);
      return;
    }

    const usuarioId = this.tokenService.getUserId();

    if (!usuarioId) {
      this.mensajeHandlerService.showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
      this.router.navigate(['/login']);
      return;
    }

    this.cargando = true;

    const dto: CambioContrasenaDTO = {
      contrasenaActual: this.seguridadForm.value.contrasenaActual,
      contrasenaNueva: this.seguridadForm.value.contrasenaNueva
    };

    this.usuarioService.cambiarContrasena(usuarioId, dto)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.mensajeHandlerService.showSuccess(respuesta.data, '¡Contraseña actualizada!')
          this.tokenService.logout();
          this.usuario = null;
          this.seguridadForm.reset();
          this.router.navigate(['/login']).then(r => window.location.reload());
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

// ==================== Convertirse en anfitrion ====================

  convertirseEnAnfitrion(): void {
    if (this.anfitrionForm.invalid) {
      this.formUtilsService.marcarCamposComoTocados(this.anfitrionForm);
      return;
    }

    const usuarioId = this.tokenService.getUserId();
    if (!usuarioId) {
      this.mensajeHandlerService.showError('Sesión expirada.')
      return;
    }

    this.cargando = true;

    const dto: CreacionAnfitrionDTO = {
      usuarioId: usuarioId,
      sobreMi: this.anfitrionForm.value.sobreMi,
      documentoLegal: this.anfitrionForm.value.documentoLegal
    };

    this.usuarioService.crearAnfitrion(dto)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cargando = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.mensajeHandlerService.showSuccessWithCallback(
            respuesta.data, '¡Solicitud Enviada!',
            () => {
              this.tokenService.logout();
              this.usuario = null;
              this.seguridadForm.reset();
              this.router.navigate(['/login']).then(r => window.location.reload());
            }
          );
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  seleccionarDocumento(event: any): void {
    const file: File = event.target.files[0];

    if (!file) return;

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.mensajeHandlerService.showError('El documento no puede pesar más de 5MB');
      return;
    }

    // Validar tipo (PDF)
    if (file.type !== 'application/pdf') {
      this.mensajeHandlerService.showError('Solo se permiten archivos PDF');
      return;
    }

    this.nombreDocumentoSubido = file.name;
    this.subirDocumento(file);
  }

  private subirDocumento(file: File): void {
    this.subiendoDocumento = true;

    // Reutilizamos el imagenService asumiendo que sube cualquier archivo
    this.imagenService.subirImagen(file)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.subiendoDocumento = false)
      )
      .subscribe({
        next: (respuesta) => {
          this.documentoSubido = respuesta.data.url;
          this.anfitrionForm.patchValue({ documentoLegal: respuesta.data.url });
        },
        error: (error) => {
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
          this.nombreDocumentoSubido = ''; // Limpiar en caso de error
        }
      });
  }

  // ==================== ELIMINAR CUENTA ====================

  confirmarEliminarCuenta(): void {
    Swal.fire({
      title: '¿Eliminar cuenta?',
      html: `
        <div style="text-align: left;">
          <p style="color: var(--danger-color); font-weight: 600; margin-bottom: 1rem;">
            ⚠️ Esta acción es irreversible
          </p>
          <p style="color: var(--text-color); margin-bottom: 0.5rem;">
            Al eliminar tu cuenta:
          </p>
          <ul style="text-align: left; color: var(--text-color); padding-left: 1.5rem;">
            <li>Perderás acceso a todos tus datos</li>
            <li>Se cancelarán todas tus reservas activas</li>
            <li>Se eliminarán tus alojamientos (si eres anfitrión)</li>
            <li>No podrás recuperar tu cuenta</li>
          </ul>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar mi cuenta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#95a5a6',
      input: 'text',
      inputPlaceholder: 'Escribe "ELIMINAR" para confirmar',
      inputValidator: (value) => {
        if (value !== 'ELIMINAR') {
          return 'Debes escribir "ELIMINAR" para confirmar';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.eliminarCuenta();
      }
    });
  }

  private eliminarCuenta(): void {
    const usuarioId = this.tokenService.getUserId();

    if (!usuarioId) return;

    this.mensajeHandlerService.showLoading("'Eliminando cuenta...'")

    this.usuarioService.eliminar(usuarioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.mensajeHandlerService.showSuccessWithCallback('Tu cuenta ha sido eliminada correctamente','Cuenta eliminada', ()=> {
            this.tokenService.logout();
            this.router.navigate(['/']);
          });
        },
        error: (error) => {
          this.mensajeHandlerService.closeModal();
          const mensaje = this.mensajeHandlerService.handleHttpError(error);
          this.mensajeHandlerService.showError(mensaje);
        }
      });
  }

  // ==================== UTILIDADES ====================

  toggleContrasena(campo: 'actual' | 'nueva' | 'confirmar'): void {
    switch(campo) {
      case 'actual':
        this.mostrarContrasenaActual = !this.mostrarContrasenaActual;
        break;
      case 'nueva':
        this.mostrarNuevaContrasena = !this.mostrarNuevaContrasena;
        break;
      case 'confirmar':
        this.mostrarConfirmarContrasena = !this.mostrarConfirmarContrasena;
        break;
    }
  }

  obtenerIniciales(): string {
    if (!this.usuario) return 'U';
    return this.usuario.nombre.charAt(0).toUpperCase();
  }

}

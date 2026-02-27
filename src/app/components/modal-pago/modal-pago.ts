import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PagoService } from '../../services/pago-service';
import { ReservaService } from '../../services/reserva-service';
import { PrecioService } from '../../services/precio-service';

@Component({
  selector: 'app-modal-pago',
  imports: [CommonModule],
  templateUrl: './modal-pago.html',
  styleUrl: './modal-pago.css'
})
export class ModalPago implements AfterViewInit, OnDestroy {

  // ==================== INPUTS ====================
  @Input() clientSecret!: string;
  @Input() reservaId!: number;
  @Input() monto!: number;            // En pesos COP
  @Input() nombreAlojamiento: string = '';
  @Input() fechaEntrada: string = '';
  @Input() fechaSalida: string = '';
  @Input() noches: number = 0;

  // ==================== OUTPUTS ====================
  @Output() pagoExitoso   = new EventEmitter<number>();
  @Output() pagoCancelado = new EventEmitter<void>();

  // ==================== ESTADO INTERNO ====================
  cargandoStripe      = true;
  procesandoPago      = false;
  cancelandoPago      = false;
  errorPago: string | null = null;
  pagoCompletadoLocal = false;

  private stripe: any         = null;
  private elements: any       = null;
  private paymentElement: any = null;

  constructor(
    private pagoService: PagoService,
    private reservaService: ReservaService,
    public precioService: PrecioService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================== CICLO DE VIDA ====================

  ngAfterViewInit(): void {
    setTimeout(() => this.inicializarStripeElement(), 100);
  }

  ngOnDestroy(): void {
    if (this.paymentElement) {
      this.paymentElement.destroy();
    }
  }

  // ==================== STRIPE SETUP ====================

  private async inicializarStripeElement(): Promise<void> {
    // Inicializar Stripe (cargado en index.html)
    this.stripe = this.pagoService.inicializarStripe();

    if (!this.stripe) {
      this.errorPago = 'No se pudo cargar el sistema de pagos. Recarga la página.';
      this.cargandoStripe = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      this.elements = this.stripe.elements({
        clientSecret: this.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary:     '#2E8B57',
            colorBackground:  '#ffffff',
            colorText:        '#2C3E50',
            colorDanger:      '#E74C3C',
            fontFamily:       'Poppins, system-ui, sans-serif',
            borderRadius:     '12px',
            spacingUnit:      '4px',
          },
          rules: {
            '.Input': {
              border:    '2px solid #E5E5E5',
              boxShadow: 'none',
              padding:   '14px',
            },
            '.Input:focus': {
              border:    '2px solid #2E8B57',
              boxShadow: '0 0 0 3px rgba(46, 139, 87, 0.1)',
            },
            '.Label': {
              fontWeight:   '600',
              color:        '#1F5F3F',
              marginBottom: '8px',
            },
          }
        }
      });

      this.paymentElement = this.elements.create('payment', {
        layout: 'tabs',
        defaultValues: {
          billingDetails: { address: { country: 'CO' } }
        }
      });

      const container = document.getElementById('stripe-payment-element');
      if (container) {
        this.paymentElement.mount(container);

        this.paymentElement.on('ready', () => {
          this.cargandoStripe = false;
          this.cdr.detectChanges();
        });

        this.paymentElement.on('change', (event: any) => {
          this.errorPago = event.error ? event.error.message : null;
          this.cdr.detectChanges();
        });
      }
    } catch (error: any) {
      this.errorPago = 'Error al cargar el formulario de pago: ' + error.message;
      this.cargandoStripe = false;
      this.cdr.detectChanges();
    }
  }

  // ==================== CONFIRMAR PAGO ====================

  async confirmarPago(): Promise<void> {
    if (!this.stripe || !this.elements || this.procesandoPago) return;

    this.procesandoPago = true;
    this.errorPago = null;
    this.cdr.detectChanges();

    try {
      const { error, paymentIntent } = await this.stripe.confirmPayment({
        elements: this.elements,
        confirmParams: {
          return_url: `${window.location.origin}/mis-reservas`,
          payment_method_data: {
            billing_details: { address: { country: 'CO' } }
          }
        },
        redirect: 'if_required'
      });

      if (error) {
        this.errorPago = this.traducirErrorStripe(error);
        this.procesandoPago = false;
        this.cdr.detectChanges();

      } else if (paymentIntent &&
        (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
        // Pago autorizado: reserva pasa a PENDIENTE en el backend vía webhook
        this.pagoCompletadoLocal = true;
        this.procesandoPago = false;
        this.cdr.detectChanges();
        setTimeout(() => this.pagoExitoso.emit(this.reservaId), 2000);

      } else {
        this.errorPago = 'Estado del pago inesperado. Por favor, contacta soporte.';
        this.procesandoPago = false;
        this.cdr.detectChanges();
      }

    } catch (err: any) {
      this.errorPago = 'Error inesperado al procesar el pago: ' + err.message;
      this.procesandoPago = false;
      this.cdr.detectChanges();
    }
  }

  // ==================== CANCELAR PAGO ====================

  /**
   * Cancela la reserva en el backend (estado → CANCELADA)
   * para que el PaymentIntent se cancele y no quede huérfano.
   */
  cancelar(): void {
    if (this.procesandoPago || this.cancelandoPago) return;

    this.cancelandoPago = true;
    this.cdr.detectChanges();

    this.reservaService.cancelar(this.reservaId).subscribe({
      next: () => {
        this.cancelandoPago = false;
        this.pagoCancelado.emit();
      },
      error: () => {
        // Si falla la cancelación igualmente cerramos:
        // el job del backend / expiración del PaymentIntent la limpiará
        this.cancelandoPago = false;
        this.pagoCancelado.emit();
      }
    });
  }

  // ==================== UTILIDADES ====================

  private traducirErrorStripe(error: any): string {
    const traducciones: { [key: string]: string } = {
      'card_declined':        'Tu tarjeta fue rechazada. Verifica los datos o usa otra tarjeta.',
      'insufficient_funds':   'Fondos insuficientes en tu tarjeta.',
      'incorrect_cvc':        'El código de seguridad (CVC) es incorrecto.',
      'expired_card':         'Tu tarjeta está vencida.',
      'incorrect_number':     'El número de tarjeta es incorrecto.',
      'invalid_expiry_month': 'El mes de vencimiento es inválido.',
      'invalid_expiry_year':  'El año de vencimiento es inválido.',
      'invalid_cvc':          'El código CVC es inválido.',
      'processing_error':     'Error al procesar el pago. Intenta de nuevo.',
      'rate_limit':           'Demasiados intentos. Espera un momento e intenta de nuevo.',
    };
    return (error.code && traducciones[error.code])
      ? traducciones[error.code]
      : (error.message || 'Error al procesar el pago. Verifica tus datos.');
  }
}

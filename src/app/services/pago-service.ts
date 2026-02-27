import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PagoService {
  private stripeInstance: any = null;

  /**
   * Inicializa y retorna la instancia de Stripe.
   * Stripe.js se carga desde el CDN en index.html (obligatorio por PCI DSS).
   * La clave pública (pk_test_...) viene de environment.stripePublicKey.
   */
  inicializarStripe(): any {
    if (!this.stripeInstance) {
      const StripeGlobal = (window as any).Stripe;
      if (!StripeGlobal) {
        console.error(
          'Stripe.js no está cargado. ' +
          'Verifica que index.html tenga: <script src="https://js.stripe.com/v3/"></script>'
        );
        return null;
      }
      this.stripeInstance = StripeGlobal(environment.stripePublicKey);
    }
    return this.stripeInstance;
  }
}

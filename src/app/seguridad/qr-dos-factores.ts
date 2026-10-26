import { Component, computed, effect, input, signal } from '@angular/core';

// Código QR y clave en texto para dar de alta la cuenta en una aplicación autenticadora (Google Authenticator...). Lo usan la
// activación desde la cuenta y el registro. Recibe la URI otpauth:// y el secreto en Base32 que devuelve el backend; el QR se
// dibuja aquí, en el navegador, y la librería solo se carga cuando se muestra por primera vez.
@Component({
  selector: 'app-qr-dos-factores',
  templateUrl: './qr-dos-factores.html',
  styleUrl: './qr-dos-factores.css',
})
export class QrDosFactores {
  readonly uri = input.required<string>();
  readonly secreto = input.required<string>();

  protected readonly imagen = signal<string | null>(null);
  // El secreto en grupos de cuatro, que se lee y se escribe mejor
  protected readonly secretoAgrupado = computed(
    () => this.secreto().match(/.{1,4}/g)?.join(' ') ?? this.secreto(),
  );

  constructor() {
    effect(() => {
      void this.dibujar(this.uri());
    });
  }

  private async dibujar(uri: string): Promise<void> {
    try {
      const { toDataURL } = await import('qrcode');
      const imagen = await toDataURL(uri, { margin: 1, width: 224, errorCorrectionLevel: 'M' });
      // Si mientras tanto llegó otra URI, esta imagen ya no vale
      if (uri === this.uri()) {
        this.imagen.set(imagen);
      }
    } catch {
      // Sin imagen se sigue pudiendo dar de alta la cuenta escribiendo la clave que se muestra debajo
      this.imagen.set(null);
    }
  }
}

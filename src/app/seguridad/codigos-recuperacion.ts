import { Component, input, output, signal } from '@angular/core';

// Códigos de recuperación recién generados: se pueden copiar o descargar, y no se continúa hasta marcar que se han guardado
// (se muestran una sola vez; en el servidor solo queda su hash). Lo usan la activación desde la cuenta, la regeneración y el
// registro. Avisa al padre, con `guardados`, de si la casilla está marcada. No guarda los códigos en ningún sitio.
@Component({
  selector: 'app-codigos-recuperacion',
  templateUrl: './codigos-recuperacion.html',
  styleUrl: './codigos-recuperacion.css',
})
export class CodigosRecuperacion {
  readonly codigos = input.required<string[]>();
  readonly guardados = output<boolean>();

  protected readonly marcado = signal(false);
  protected readonly copiado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected alternarGuardados(): void {
    this.marcado.set(!this.marcado());
    this.guardados.emit(this.marcado());
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codigos().join('\n'));
      this.copiado.set(true);
      this.error.set(null);
    } catch {
      this.copiado.set(false);
      this.error.set('No se han podido copiar. Selecciónalos y cópialos a mano, o descárgalos.');
    }
  }

  protected descargar(): void {
    const texto = [
      'Códigos de recuperación de ESIBuy',
      'Cada código solo se puede usar una vez.',
      '',
      ...this.codigos(),
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'codigos-recuperacion-esibuy.txt';
    enlace.click();
    URL.revokeObjectURL(url);
  }
}

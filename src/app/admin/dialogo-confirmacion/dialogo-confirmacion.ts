import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-dialogo-confirmacion',
  templateUrl: './dialogo-confirmacion.html',
  styleUrls: ['../admin-shared.css', './dialogo-confirmacion.css'],
  host: { '(document:keydown.escape)': 'cerrar()' },
})
export class DialogoConfirmacion {
  titulo = input.required<string>();
  mensaje = input.required<string>();
  textoConfirmar = input('Confirmar');
  textoProcesando = input('Procesando…');
  procesando = input(false);

  confirmar = output<void>();
  cancelar = output<void>();

  cerrar(): void {
    if (!this.procesando()) {
      this.cancelar.emit();
    }
  }
}

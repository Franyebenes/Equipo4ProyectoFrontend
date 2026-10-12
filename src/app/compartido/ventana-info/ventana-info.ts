import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';

// Ventana emergente pequeña para mostrar información. El contenido lo pone quien la usa.
@Component({
  selector: 'app-ventana-info',
  templateUrl: './ventana-info.html',
  styleUrl: './ventana-info.css',
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
})
export class VentanaInfo implements AfterViewInit {
  titulo = input.required<string>();
  cerrar = output<void>();

  private readonly botonCerrar = viewChild.required<ElementRef<HTMLButtonElement>>('botonCerrar');

  ngAfterViewInit(): void {
    this.botonCerrar().nativeElement.focus();
  }
}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Página Home: el contenido se mueve aquí para poder enrutar login y registro.
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}

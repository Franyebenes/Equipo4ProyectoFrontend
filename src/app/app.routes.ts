import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Registro } from './registro/registro';

// Esta rama solo añade la página de registro. El login vive en feature/login.
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'registro', component: Registro },
];

import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './login/login';
import { Registro } from './registro/registro';
import { CrearCategoriaComponent } from './admin/crear-categoria/crear-categoria';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'registro', component: Registro },
  { path: 'admin/crear-categoria', component: CrearCategoriaComponent },
];
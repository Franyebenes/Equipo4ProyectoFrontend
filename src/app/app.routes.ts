import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './login/login';
import { Registro } from './registro/registro';
import { CrearCategoriaComponent } from './admin/crear-categoria/crear-categoria';
import { UserList } from './admin/user-list/user-list';
import { DarAltaAdmin } from './admin/dar-alta-admin/dar-alta-admin';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'registro', component: Registro },
  { path: 'admin/usuarios', component: UserList },
  { path: 'admin/administradores/nuevo', component: DarAltaAdmin },
  { path: 'admin/crear-categoria', component: CrearCategoriaComponent },
];
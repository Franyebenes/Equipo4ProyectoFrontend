import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './login/login';

// Esta rama solo añade la página de login. El registro vive en feature/registro.
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
];

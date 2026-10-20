import { Routes } from '@angular/router';
import { CrearCategoriaComponent } from './admin/crear-categoria/crear-categoria';
import { UserList } from './admin/user-list/user-list';
import { DarAltaAdmin } from './admin/dar-alta-admin/dar-alta-admin';
import { VerCategorias } from './admin/ver-categorias/ver-categorias';
import { EditarCategoria } from './admin/editar-categoria/editar-categoria';
import { MisProductos } from './vendedor/mis-productos/mis-productos';
import { DetalleProducto } from './vendedor/detalle-producto/detalle-producto';
import { portadaGuard, rolGuard, sinAdminGuard } from './core/rol.guard';
import { Registro } from './registro/registro';
import { Login } from './login/login';
import { Home } from './home/home';
import { Cliente } from './cliente/cliente';
import { VerCarrito } from './cliente/ver-carrito/ver-carrito';
import { CrearProducto } from './vendedor/crear-producto/crear-producto';

export const routes: Routes = [
  { path: '', component: Home, canActivate: [portadaGuard] },
  { path: 'login', component: Login },
  { path: 'registro', component: Registro },
  // Recuperación de contraseña: pública. El enlace del correo lleva a restablecer-contrasena#token=...
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('./recuperacion/solicitar-recuperacion/solicitar-recuperacion').then((m) => m.SolicitarRecuperacion),
  },
  {
    path: 'restablecer-contrasena',
    loadComponent: () =>
      import('./recuperacion/restablecer-contrasena/restablecer-contrasena').then((m) => m.RestablecerContrasena),
  },
  { path: 'cliente', component: Cliente, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'carrito', component: VerCarrito, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  {
    path: 'admin',
    canActivate: [rolGuard('ADMIN')],
    children: [
      { path: 'usuarios', component: UserList },
      { path: 'administradores/nuevo', component: DarAltaAdmin },
      { path: 'categorias', component: VerCategorias },
      { path: 'crear-categoria', component: CrearCategoriaComponent },
      { path: 'categorias/:id/editar', component: EditarCategoria },
    ],
  },
  {
    path: 'vendedor',
    canActivate: [rolGuard('VENDEDOR')],
    children: [
      { path: 'productos', component: MisProductos },
      { path: 'productos/nuevo', component: CrearProducto },
      { path: 'productos/:id', component: DetalleProducto },
    ],
  },
];
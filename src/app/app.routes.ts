import { Routes } from '@angular/router';
import { CrearCategoriaComponent } from './admin/crear-categoria/crear-categoria';
import { UserList } from './admin/user-list/user-list';
import { DarAltaAdmin } from './admin/dar-alta-admin/dar-alta-admin';
import { VerCategorias } from './admin/ver-categorias/ver-categorias';
import { EditarCategoria } from './admin/editar-categoria/editar-categoria';
import { MisProductos } from './vendedor/mis-productos/mis-productos';
import { DetalleProducto } from './vendedor/detalle-producto/detalle-producto';
import { portadaGuard, rolGuard, sinAdminGuard } from './core/rol.guard';
import { Home } from './home/home';
import { Catalogo } from './cliente/catalogo/catalogo';
import { FichaProducto } from './cliente/ficha-producto/ficha-producto';
import { VerCarrito } from './cliente/ver-carrito/ver-carrito';
import { MetodosPago } from './cliente/metodos-pago/metodos-pago';
import { Pagar } from './cliente/pagar/pagar';
import { CrearProducto } from './vendedor/crear-producto/crear-producto';

export const routes: Routes = [
  { path: '', component: Home, canActivate: [portadaGuard] },
  // El login se carga bajo demanda: con el segundo paso de la verificacion en dos pasos ya no cabe en el bundle inicial
  { path: 'login', loadComponent: () => import('./login/login').then((m) => m.Login) },
  { path: 'registro', loadComponent: () => import('./registro/registro').then((m) => m.Registro) },
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
  // Seguridad de la cuenta (verificación en dos pasos): para cualquier usuario con sesión. Carga perezosa.
  {
    path: 'cuenta/seguridad',
    canActivate: [rolGuard('CLIENTE', 'PREMIUM', 'VENDEDOR', 'ADMIN')],
    loadComponent: () => import('./seguridad/seguridad-cuenta').then((m) => m.SeguridadCuenta),
  },
  { path: 'cliente', component: Cliente, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  // HU-19: al iniciar sesión, el cliente llega al catálogo
  { path: 'cliente', component: Catalogo, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  // HU-21: ficha de un producto del catálogo
  { path: 'cliente/productos/:id', component: FichaProducto, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'carrito', component: VerCarrito, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
    { path: 'metodos-pago', component: MetodosPago, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
      { path: 'pagar', component: Pagar, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
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
      // Modificar producto: el mismo formulario del alta, con los datos del producto
      { path: 'productos/:id/editar', component: CrearProducto },
      { path: 'productos/:id', component: DetalleProducto },
    ],
  },
];
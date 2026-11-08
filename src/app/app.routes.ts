import { Routes } from '@angular/router';
import { CrearCategoriaComponent } from './admin/crear-categoria/crear-categoria';
import { UserList } from './admin/user-list/user-list';
import { DarAltaAdmin } from './admin/dar-alta-admin/dar-alta-admin';
import { VerCategorias } from './admin/ver-categorias/ver-categorias';
import { EditarCategoria } from './admin/editar-categoria/editar-categoria';
import { MisProductos } from './vendedor/mis-productos/mis-productos';
import { DetalleProducto } from './vendedor/detalle-producto/detalle-producto';
import { PedidosRecibidos } from './vendedor/pedidos-recibidos/pedidos-recibidos';
import { DetallePedidoRecibido } from './vendedor/detalle-pedido-recibido/detalle-pedido-recibido';
import { portadaGuard, rolGuard } from './core/rol.guard';
import { Home } from './home/home';
import { Catalogo } from './cliente/catalogo/catalogo';
import { FichaProducto } from './cliente/ficha-producto/ficha-producto';
import { Favoritos } from './cliente/favoritos/favoritos';
import { VerCarrito } from './cliente/ver-carrito/ver-carrito';
import { Pagar } from './cliente/pagar/pagar';
import { MisPedidos } from './cliente/mis-pedidos/mis-pedidos';
import { CrearProducto } from './vendedor/crear-producto/crear-producto';
import {VerPerfil} from './perfil/ver-perfil/ver-perfil';
import { EditarPerfil } from './perfil/editar-perfil/editar-perfil';
import { PagoPremium } from './perfil/pago-premium/pago-premium';
import { LibretaDirecciones } from './direcciones/libreta-direcciones/libreta-direcciones';
import { FormularioDireccion } from './direcciones/formulario-direccion/formulario-direccion';
import { VerProductosAdmin } from './admin/ver-productos-admin/ver-productos-admin';
import { DetalleProductoAdmin } from './admin/detalle-producto-admin/detalle-producto-admin';
import { MisListas } from './listas/mis-listas/mis-listas';


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
  // HU-19: al iniciar sesión, el cliente llega al catálogo
  { path: 'cliente', component: Catalogo, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  // HU-21: ficha de un producto del catálogo
  { path: 'cliente/productos/:id', component: FichaProducto, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  // HU-31.1: lista de favoritos del cliente de la sesión
  { path: 'favoritos', component: Favoritos, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'carrito', component: VerCarrito, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  // Los métodos de pago ahora están dentro de "Mi perfil"
  { path: 'metodos-pago', redirectTo: 'perfil' },
  { path: 'pagar', component: Pagar, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'perfil/premium', component: PagoPremium, canActivate: [rolGuard('CLIENTE')] },
  { path: 'perfil', component: VerPerfil, canActivate: [rolGuard('CLIENTE','PREMIUM','VENDEDOR','ADMIN')] },
  { path: 'perfil/editar', component: EditarPerfil, canActivate: [rolGuard('CLIENTE','PREMIUM','VENDEDOR','ADMIN')] },
  { path: 'direcciones', component: LibretaDirecciones, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'direcciones/nueva', component: FormularioDireccion, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'direcciones/:id/editar', component: FormularioDireccion, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'listas', component: MisListas, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  // Una colección abierta: la misma pantalla, que enseña los productos de la lista
  { path: 'listas/:id', component: MisListas, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  { path: 'pedidos', component: MisPedidos, canActivate: [rolGuard('CLIENTE', 'PREMIUM')] },
  {
    path: 'admin',
    canActivate: [rolGuard('ADMIN')],
    children: [
      { path: 'usuarios', component: UserList },
      { path: 'administradores/nuevo', component: DarAltaAdmin },
      { path: 'categorias', component: VerCategorias },
      { path: 'crear-categoria', component: CrearCategoriaComponent },
      { path: 'categorias/:id/editar', component: EditarCategoria },
      { path: 'productos', component: VerProductosAdmin },
      { path: 'productos/:id', component: DetalleProductoAdmin },
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
      // Ver pedidos recibidos: los pedidos de los productos del vendedor y el detalle de cada uno
      { path: 'pedidos', component: PedidosRecibidos },
      { path: 'pedidos/:id', component: DetallePedidoRecibido },
    ],
  },
];
import { Routes } from '@angular/router';
import { CrearCategoriaComponent } from './admin/crear-categoria/crear-categoria';
import { UserList } from './admin/user-list/user-list';
import { DarAltaAdmin } from './admin/dar-alta-admin/dar-alta-admin';
import { VerCategorias } from './admin/ver-categorias/ver-categorias';
import { EditarCategoria } from './admin/editar-categoria/editar-categoria';
import { MisProductos } from './vendedor/mis-productos/mis-productos';
import { DetalleProducto } from './vendedor/detalle-producto/detalle-producto';
import { rolGuard, sinAdminGuard } from './core/rol.guard';
import { Registro } from './registro/registro';
import { Login } from './login/login';
import { Home } from './home/home';

export const routes: Routes = [
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
      { path: 'productos/:id', component: DetalleProducto },
    ],
  },
  // Un administrador no usa la portada ni el login/registro: sinAdminGuard lo lleva a su panel
  { path: '', component: Home, canActivate: [sinAdminGuard] },
  { path: 'login', component: Login, canActivate: [sinAdminGuard] },
  { path: 'registro', component: Registro, canActivate: [sinAdminGuard] },
];

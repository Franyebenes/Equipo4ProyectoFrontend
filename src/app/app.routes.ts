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
import { CrearProducto } from './vendedor/crear-producto/crear-producto';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'registro', component: Registro },
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
      { path: 'productos/nuevo', component: CrearProducto },
    ],
  },
  
];

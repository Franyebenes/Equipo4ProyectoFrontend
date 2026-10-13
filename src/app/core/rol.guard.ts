import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, Rol } from './auth.service';

// Solo deja entrar a los roles indicados. Tras recargar la página la sesión aún no se ha recuperado (el arranque no espera a
// /api/auth/me), así que si no hay usuario se pregunta al backend antes de decidir.
export const rolGuard = (...roles: Rol[]): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.usuario()) {
    await auth.restaurarSesion();
  }
  const usuario = auth.usuario();
  if (usuario && roles.includes(usuario.rol)) {
    return true;
  }
  return router.parseUrl(usuario ? '/' : '/login');
};

// Páginas públicas (portada, login y registro) que no tienen sentido para un administrador: si hay una sesión de
// ADMIN, se le lleva a su panel. El resto de usuarios, con sesión o sin ella, entran con normalidad.
export const sinAdminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.usuario()) {
    await auth.restaurarSesion();
  }
  return auth.usuario()?.rol === 'ADMIN' ? router.parseUrl('/admin/usuarios') : true;
};

// La portada solo sirve para elegir entre iniciar sesión o registrarse: un cliente o un vendedor con sesión no la ve
// y va a su página.
export const portadaGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.usuario()) {
    await auth.restaurarSesion();
  }
  switch (auth.usuario()?.rol) {
    case 'CLIENTE':
    case 'PREMIUM':
      return router.parseUrl('/cliente');
    case 'VENDEDOR':
      return router.parseUrl('/vendedor/productos');
    default:
      return true;
  }
};

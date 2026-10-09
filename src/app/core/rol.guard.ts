import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, Rol } from './auth.service';

// Solo deja entrar al rol indicado. Tras recargar la página la sesión aún no se ha recuperado (el arranque no espera a
// /api/auth/me), así que si no hay usuario se pregunta al backend antes de decidir.
export const rolGuard = (rol: Rol): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.usuario()) {
    await auth.restaurarSesion();
  }
  const usuario = auth.usuario();
  if (usuario?.rol === rol) {
    return true;
  }
  return router.parseUrl(usuario ? '/' : '/login');
};
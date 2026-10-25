import { HttpErrorResponse } from '@angular/common/http';

/** Texto para el usuario a partir de un error HTTP. Los 404 y 409 de tus servicios traen un mensaje propio. */
export function mensajeDeError(
  error: unknown,
  porDefecto = 'No se ha podido completar la operación. Inténtalo de nuevo.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return porDefecto;
  }
  if ((error.status === 404 || error.status === 409) && typeof error.error?.mensaje === 'string') {
    return error.error.mensaje;
  }
  if (error.status === 400) {
    return 'Revisa los datos del formulario.';
  }
  if (error.status === 403) {
    return 'No tienes permisos para hacer esto.';
  }
  return porDefecto;
}

/** Códigos de error por campo de un 400 ({"errores": {"campo": ["CODIGO"]}}), o un objeto vacío. */
export function erroresDeCampo(error: unknown): Record<string, string[]> {
  return error instanceof HttpErrorResponse && error.status === 400 ? (error.error?.errores ?? {}) : {};
}
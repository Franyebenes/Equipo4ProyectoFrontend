import { Injectable, signal } from '@angular/core';
import { ParamMap } from '@angular/router';

export type FiltroEstado = '' | 'activos' | 'inactivos';

// Búsqueda y filtros de Mi catálogo, tal y como los elige el vendedor
export interface ValoresFiltros {
  busqueda: string;
  idCategoria: string;
  estado: FiltroEstado;
  precioMinimo: number | null;
  precioMaximo: number | null;
}

// Los filtros viajan en la dirección de la página, p. ej. /vendedor/productos?estado=inactivos:
// así se conservan al recargar y al volver desde la ficha o el formulario de un producto.
export function filtrosAParametros(filtros: ValoresFiltros): Record<string, string> {
  const valores: Record<string, string | number | null> = {
    busqueda: filtros.busqueda.trim(),
    idCategoria: filtros.idCategoria,
    estado: filtros.estado,
    precioMinimo: filtros.precioMinimo,
    precioMaximo: filtros.precioMaximo,
  };
  const parametros: Record<string, string> = {};
  for (const [nombre, valor] of Object.entries(valores)) {
    // Los filtros sin elegir no se ponen en la dirección
    if (valor !== null && valor !== '') {
      parametros[nombre] = String(valor);
    }
  }
  return parametros;
}

// Lee los filtros de la dirección. Lo que no sea válido (p. ej. escrito a mano) se ignora.
export function filtrosDeParametros(parametros: ParamMap): ValoresFiltros {
  const estado = parametros.get('estado');
  return {
    busqueda: parametros.get('busqueda') ?? '',
    idCategoria: parametros.get('idCategoria') ?? '',
    estado: estado === 'activos' || estado === 'inactivos' ? estado : '',
    precioMinimo: numero(parametros.get('precioMinimo')),
    precioMaximo: numero(parametros.get('precioMaximo')),
  };
}

export function mismosParametros(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const claves = Object.keys(a);
  const mismasClaves = claves.length === Object.keys(b).length;
  return mismasClaves && claves.every((clave) => String(b[clave]) === a[clave]);
}

function numero(texto: string | null): number | null {
  if (texto === null || texto.trim() === '') {
    return null;
  }
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

// Últimos filtros de Mi catálogo, para que «Volver a mi catálogo» desde la ficha o el formulario
// los conserve. Viven en memoria: al recargar, los conserva la propia dirección del catálogo.
@Injectable({ providedIn: 'root' })
export class FiltrosCatalogo {
  readonly ultimos = signal<Record<string, string>>({});
}

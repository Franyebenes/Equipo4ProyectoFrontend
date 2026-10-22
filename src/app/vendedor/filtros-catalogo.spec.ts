import { convertToParamMap } from '@angular/router';

import {
  ValoresFiltros,
  filtrosAParametros,
  filtrosDeParametros,
  mismosParametros,
} from './filtros-catalogo';

const SIN_FILTROS: ValoresFiltros = {
  busqueda: '',
  idCategoria: '',
  estado: '',
  precioMinimo: null,
  precioMaximo: null,
};

describe('Filtros de Mi catálogo en la dirección', () => {
  it('sin filtros no pone nada en la dirección', () => {
    expect(filtrosAParametros(SIN_FILTROS)).toEqual({});
    expect(filtrosAParametros({ ...SIN_FILTROS, busqueda: '   ' })).toEqual({});
  });

  it('guarda todos los filtros elegidos, incluido el precio 0', () => {
    const filtros: ValoresFiltros = {
      busqueda: ' lámpara ',
      idCategoria: 'c1',
      estado: 'inactivos',
      precioMinimo: 0,
      precioMaximo: 99.5,
    };
    expect(filtrosAParametros(filtros)).toEqual({
      busqueda: 'lámpara',
      idCategoria: 'c1',
      estado: 'inactivos',
      precioMinimo: '0',
      precioMaximo: '99.5',
    });
  });

  it('al leer la dirección recupera los mismos filtros', () => {
    const filtros: ValoresFiltros = {
      busqueda: 'lámpara',
      idCategoria: 'c1',
      estado: 'activos',
      precioMinimo: 10,
      precioMaximo: 99.5,
    };
    expect(filtrosDeParametros(convertToParamMap(filtrosAParametros(filtros)))).toEqual(filtros);
  });

  it('ignora lo que no es válido en una dirección escrita a mano', () => {
    const parametros = convertToParamMap({
      estado: 'todos',
      precioMinimo: 'barato',
      precioMaximo: '',
    });
    expect(filtrosDeParametros(parametros)).toEqual(SIN_FILTROS);
  });

  it('mismosParametros compara los filtros con los de la dirección actual', () => {
    expect(mismosParametros({ estado: 'activos' }, { estado: 'activos' })).toBe(true);
    expect(mismosParametros({ precioMinimo: '10' }, { precioMinimo: '10' })).toBe(true);
    expect(mismosParametros({ estado: 'activos' }, {})).toBe(false);
    expect(mismosParametros({}, { estado: 'activos' })).toBe(false);
    expect(mismosParametros({ estado: 'activos' }, { estado: 'inactivos' })).toBe(false);
  });
});

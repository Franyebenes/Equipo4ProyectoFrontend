import { FormControl, FormGroup } from '@angular/forms';
import {
  condicionesAceptadas,
  contrasenasCoinciden,
  contrasenaValida,
  emailValido,
  fechaNacimientoValida,
  haceAnios,
  hoyEnMadrid,
  telefonoOpcional,
  textoObligatorio,
} from './registro-validadores';

const errorDe = (validador: (c: FormControl) => unknown, valor: unknown) =>
  validador(new FormControl(valor));

describe('textoObligatorio', () => {
  const validar = textoObligatorio();

  it.each([[''], ['   '], [null]])('rechaza el valor vacío %j como obligatorio', (valor) => {
    expect(errorDe(validar, valor)).toEqual({ OBLIGATORIO: true });
  });

  it('acepta un texto normal, también con acentos y espacios en los extremos', () => {
    expect(errorDe(validar, '  García López ')).toBeNull();
  });

  it('acepta 100 caracteres y rechaza 101', () => {
    expect(errorDe(validar, 'a'.repeat(100))).toBeNull();
    expect(errorDe(validar, 'a'.repeat(101))).toEqual({ LONGITUD_EXCESIVA: true });
  });

  it.each([['<script>'], ['{"$gt":""}'], ['a$b'], ['a}b']])(
    'rechaza los caracteres peligrosos en %j',
    (valor) => {
      expect(errorDe(validar, valor)).toEqual({ FORMATO_INVALIDO: true });
    },
  );
});

describe('emailValido', () => {
  const validar = emailValido();

  it('acepta un correo válido, con mayúsculas y espacios en los extremos', () => {
    expect(errorDe(validar, ' Ana.Garcia@Ejemplo.ES ')).toBeNull();
  });

  it.each([['sin-arroba'], ['a@'], ['a@@b.com'], ['a b@c.com'], ['@dominio.es'], ['usuario@']])(
    'rechaza el formato de %j',
    (valor) => {
      expect(errorDe(validar, valor)).toEqual({ FORMATO_INVALIDO: true });
    },
  );

  it('exige el correo y limita su longitud a 254 caracteres', () => {
    expect(errorDe(validar, '')).toEqual({ OBLIGATORIO: true });
    expect(errorDe(validar, `${'a'.repeat(250)}@b.es`)).toEqual({ LONGITUD_EXCESIVA: true });
  });
});

describe('telefonoOpcional', () => {
  const validar = telefonoOpcional();

  it.each([[''], [null], ['   '], ['612345678'], [' 912345678 ']])('acepta %j', (valor) => {
    expect(errorDe(validar, valor)).toBeNull();
  });

  it.each([['12345678'], ['6123456789'], ['61234567a'], ['+34612345678'], ['612 345 678']])(
    'rechaza %j',
    (valor) => {
      expect(errorDe(validar, valor)).toEqual({ TELEFONO_INVALIDO: true });
    },
  );
});

describe('contrasenaValida', () => {
  const validar = contrasenaValida();

  it('exige la contraseña', () => {
    expect(errorDe(validar, '')).toEqual({ OBLIGATORIO: true });
  });

  // Cumple la composición con el mínimo: mayúscula, minúsculas, un número y un carácter especial.
  const completar = (longitud: number) => 'Aa1!' + 'a'.repeat(longitud - 4);

  it('acepta 12 caracteres y rechaza 11', () => {
    expect(errorDe(validar, completar(12))).toBeNull();
    expect(errorDe(validar, completar(11))).toEqual({ CONTRASENA_CORTA: true });
  });

  it('acepta 128 caracteres y rechaza 129', () => {
    expect(errorDe(validar, completar(128))).toBeNull();
    expect(errorDe(validar, completar(129))).toEqual({ CONTRASENA_LARGA: true });
  });

  it('cuenta los emojis como un carácter, igual que el backend', () => {
    expect(errorDe(validar, 'Aa1' + '😀'.repeat(125))).toBeNull();
    expect(errorDe(validar, 'Aa1' + '😀'.repeat(126))).toEqual({ CONTRASENA_LARGA: true });
  });

  it('los espacios forman parte de la contraseña pero no cuentan como carácter especial', () => {
    expect(errorDe(validar, 'Tren azul Lluvia 77!')).toBeNull();
    expect(errorDe(validar, 'Tren azul Lluvia 77')).toEqual({ CONTRASENA_SIN_CARACTER_ESPECIAL: true });
  });

  describe('composición', () => {
    it('exige un número', () => {
      expect(errorDe(validar, 'Tren-Azul-Lluvia-Sol')).toEqual({ CONTRASENA_SIN_NUMERO: true });
    });

    it('solo cuentan los dígitos 0-9', () => {
      expect(errorDe(validar, 'Tren-Azul-Lluvia-٣')).toEqual({ CONTRASENA_SIN_NUMERO: true });
    });

    it('exige un carácter especial', () => {
      expect(errorDe(validar, 'TrenAzulLluviaSol77')).toEqual({ CONTRASENA_SIN_CARACTER_ESPECIAL: true });
    });

    it('acepta cualquier signo de puntuación o símbolo, y un emoji también cuenta', () => {
      for (const especial of ['-', '_', '.', '!', '@', '#', '$', '%', '€', '¿', '~', '😀']) {
        expect(errorDe(validar, `TrenAzul${especial}Lluvia77`)).toBeNull();
      }
    });

    it('las letras con acento o la ñ no son caracteres especiales', () => {
      expect(errorDe(validar, 'TrenCaféÑLluvia77')).toEqual({ CONTRASENA_SIN_CARACTER_ESPECIAL: true });
    });

    it('exige una mayúscula y una minúscula, también acentuadas', () => {
      expect(errorDe(validar, 'tren-azul-lluvia-77')).toEqual({ CONTRASENA_SIN_MAYUSCULA: true });
      expect(errorDe(validar, 'TREN-AZUL-LLUVIA-77')).toEqual({ CONTRASENA_SIN_MINUSCULA: true });
      expect(errorDe(validar, 'tren-azul-lluvia-77É')).toBeNull();
      expect(errorDe(validar, 'TREN-AZUL-LLUVIA-77ñ')).toBeNull();
    });

    it('normaliza a NFC: una mayúscula acentuada descompuesta sigue contando', () => {
      expect(errorDe(validar, 'tren-azul-Éxito-77'.normalize('NFD'))).toBeNull();
    });

    it('devuelve todos los incumplimientos a la vez, como el backend', () => {
      expect(errorDe(validar, 'abc')).toEqual({
        CONTRASENA_CORTA: true,
        CONTRASENA_SIN_NUMERO: true,
        CONTRASENA_SIN_CARACTER_ESPECIAL: true,
        CONTRASENA_SIN_MAYUSCULA: true,
      });
    });

    it('un alfabeto sin mayúsculas ni minúsculas no puede cumplir la regla', () => {
      expect(errorDe(validar, '你好世界你好世界你好1!')).toEqual({
        CONTRASENA_SIN_MAYUSCULA: true,
        CONTRASENA_SIN_MINUSCULA: true,
      });
    });
  });
});

describe('contrasenasCoinciden', () => {
  const grupo = (contrasena: string, repeticion: string) =>
    new FormGroup(
      { contrasena: new FormControl(contrasena), repetirContrasena: new FormControl(repeticion) },
      { validators: [contrasenasCoinciden] },
    );

  it('acepta contraseñas idénticas', () => {
    expect(grupo('Tren-Azul-77', 'Tren-Azul-77').errors).toBeNull();
  });

  it('rechaza contraseñas distintas, también si solo cambian las mayúsculas', () => {
    expect(grupo('Tren-Azul-77', 'Tren-Azul-78').errors).toEqual({
      CONTRASENAS_NO_COINCIDEN: true,
    });
    expect(grupo('Tren-Azul-77', 'tren-azul-77').errors).toEqual({
      CONTRASENAS_NO_COINCIDEN: true,
    });
  });

  it('no avisa mientras la repetición está vacía (eso ya lo dice «obligatorio»)', () => {
    expect(grupo('Tren-Azul-77', '').errors).toBeNull();
  });
});

describe('condicionesAceptadas', () => {
  it('solo acepta la casilla marcada', () => {
    expect(errorDe(condicionesAceptadas, true)).toBeNull();
    expect(errorDe(condicionesAceptadas, false)).toEqual({ CONDICIONES_NO_ACEPTADAS: true });
  });
});

describe('fechaNacimientoValida', () => {
  // Mismos casos que ServicioRegistroEdadTest del backend.
  const conHoy = (hoy: string) => fechaNacimientoValida(() => hoy);

  it('exige la fecha', () => {
    expect(errorDe(conHoy('2026-10-01'), '')).toEqual({ OBLIGATORIO: true });
  });

  it('acepta a quien cumple 18 años hoy', () => {
    expect(errorDe(conHoy('2026-10-01'), '2008-10-01')).toBeNull();
  });

  it('rechaza como menor a quien cumple 18 años mañana', () => {
    expect(errorDe(conHoy('2026-10-01'), '2008-10-02')).toEqual({ MENOR_DE_EDAD: true });
  });

  it('rechaza como menor a un niño de 15 años', () => {
    expect(errorDe(conHoy('2026-10-01'), '2011-10-01')).toEqual({ MENOR_DE_EDAD: true });
  });

  it('rechaza una fecha futura como inválida, no como menor', () => {
    expect(errorDe(conHoy('2026-10-01'), '2026-10-02')).toEqual({ FECHA_INVALIDA: true });
  });

  it('rechaza una fecha de hace más de 120 años', () => {
    expect(errorDe(conHoy('2026-10-01'), '1850-01-01')).toEqual({ FECHA_INVALIDA: true });
    expect(errorDe(conHoy('2026-10-01'), '1906-10-01')).toBeNull();
  });

  it('trata el 29 de febrero: cumple 18 el 1 de marzo en un año no bisiesto', () => {
    expect(errorDe(conHoy('2026-02-28'), '2008-02-29')).toEqual({ MENOR_DE_EDAD: true });
    expect(errorDe(conHoy('2026-03-01'), '2008-02-29')).toBeNull();
  });

  it('acepta el 29 de febrero en un año bisiesto', () => {
    expect(errorDe(conHoy('2028-02-29'), '2008-02-29')).toBeNull();
  });
});

describe('hoyEnMadrid', () => {
  it('usa la fecha de Madrid aunque en UTC sea todavía el día anterior', () => {
    // 22:30 UTC del 1 de octubre ya es 00:30 del 2 de octubre en Madrid (UTC+2).
    expect(hoyEnMadrid(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
    expect(hoyEnMadrid(new Date('2026-10-01T21:30:00Z'))).toBe('2026-10-01');
  });
});

describe('haceAnios', () => {
  it('resta años conservando mes y día', () => {
    expect(haceAnios('2026-10-01', 18)).toBe('2008-10-01');
  });
});

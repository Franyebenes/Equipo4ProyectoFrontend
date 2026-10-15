import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserEdit } from './user-edit';

describe('UserEdit', () => {
  let component: UserEdit;
  let fixture: ComponentFixture<UserEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEdit],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEdit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('cierre del modal', () => {
    let cancelaciones: number;

    beforeEach(() => {
      cancelaciones = 0;
      component.cancelar.subscribe(() => cancelaciones++);
      fixture.componentRef.setInput('usuario', {
        id: '1', email: 'ana@ejemplo.es', nombre: 'Ana', apellidos: 'López', dni: null, telefono: null,
        nombreComercial: null, sede: null, avatar: null, fechaIncorporacion: null, roles: ['ADMIN'],
        estado: 'ACTIVO', categoriaPrincipalId: null, fechaNacimiento: null,
      });
      fixture.detectChanges();
    });

    const overlay = () => fixture.nativeElement.querySelector('.overlay') as HTMLElement;
    const modal = () => fixture.nativeElement.querySelector('.modal') as HTMLElement;
    const pulsar = (el: HTMLElement, key: string) =>
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    it('Escape con el foco dentro del modal cancela una sola vez', () => {
      pulsar(modal(), 'Escape');
      expect(cancelaciones).toBe(1);
    });

    it('Escape sobre el fondo también cancela', () => {
      pulsar(overlay(), 'Escape');
      expect(cancelaciones).toBe(1);
    });

    it('otras teclas no cancelan', () => {
      pulsar(modal(), 'Enter');
      pulsar(modal(), 'a');
      expect(cancelaciones).toBe(0);
    });

    it('un clic en el fondo cancela y un clic dentro del modal no', () => {
      modal().click();
      expect(cancelaciones).toBe(0);
      overlay().click();
      expect(cancelaciones).toBe(1);
    });
  });
});

# Equipo4ProyectoFrontend

Frontend Angular de ESIBuy (proyecto `esibuy-front`). En este corte **solo existe la página Home**, según el panel superior izquierdo del mockup de estilo.

No hay backend, autenticación ni otras rutas. Los botones de sesión y registro son solo visuales.

Este repositorio se generó con [Angular CLI](https://github.com/angular/angular-cli) 21.2.0. La Home sustituye la plantilla inicial de Angular.

## Cómo arrancar

Hace falta Node.js 22.

```bash
npm install
npm start
```

La app queda en [http://127.0.0.1:43127](http://127.0.0.1:43127) (`0.0.0.0:43127`). Equivale a `ng serve` en ese host y puerto.

## Compilar

```bash
npm run build
```

Los artefactos quedan en `dist/`.

## Pruebas

```bash
npm test
```

Usa el runner [Vitest](https://vitest.dev/) configurado por Angular CLI.

## Qué hay

- Nav ESIBuy, hero, foto, bloque «Empieza según lo que necesitas» y pie.
- Conexión SonarLint del equipo (`.sonarlint/connectedMode.json`).
- Rutas Angular vacías: no hay login, catálogo ni otras pantallas.

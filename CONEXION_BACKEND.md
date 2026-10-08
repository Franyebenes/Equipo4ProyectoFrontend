# Conexión del frontend con el backend

Cómo está conectada la app Angular al backend de ESIBuy y qué hay que saber para añadir nuevas llamadas. El contrato
completo de la API (endpoints, códigos de error, cookies, CSRF y configuración) está en el repositorio del backend:
`esibuy-backend/CONEXION_BACK_FRONT.md`. El alta del primer administrador está en
`esibuy-backend/ADMINISTRADOR_INICIAL.md`.

## 1. Cómo ejecutarlo

1. Arrancar MongoDB y el backend en `http://localhost:8080` (ver la documentación del backend).
2. `npm start` en este repositorio: sirve la app en `http://localhost:43127`.
3. Abrir **`http://localhost:43127`**, siempre con `localhost` (no `127.0.0.1` ni una IP): el CORS del backend solo
   admite ese origen.

La URL del backend está en `src/app/core/api.ts` (`API_URL`, por defecto `http://localhost:8080`). Para otro entorno
se proporciona otro valor a ese token, por ejemplo en `app.config.ts`:
`{ provide: API_URL, useValue: 'https://api.esibuy.example' }`.

## 2. Piezas

| Fichero | Qué hace |
|---------|----------|
| `src/app/core/api.ts` | Token `API_URL` con la dirección del backend |
| `src/app/core/api.interceptor.ts` | A las peticiones al backend les pone `withCredentials` (sin esto el navegador no envía ni guarda la cookie de sesión entre puertos distintos). Un 401 en cualquier ruta que no sea de autenticación se interpreta como sesión caducada: se limpia el usuario y se vuelve a `/login` |
| `src/app/core/auth.service.ts` | Estado de sesión (`usuario`, una señal), `login`, `logout`, `restaurarSesion` y el manejo del token CSRF |
| `src/app/app.config.ts` | Registra `provideHttpClient(withFetch(), withInterceptors([apiInterceptor]))` y un inicializador que llama a `restaurarSesion()` al arrancar, sin retrasar la carga |
| `src/app/login/` | Pantalla de login conectada al servicio |
| `src/app/app.ts` y `app.html` | La cabecera muestra "Hola, {nombre}" y "Cerrar sesión" si hay sesión, o "Iniciar sesión" y "Crear cuenta" si no |

## 3. Cómo funciona

- **El usuario**: `inject(AuthService).usuario()` devuelve `{ id, email, nombre, rol }` o `null`. Es una señal de solo
  lectura: úsala en plantillas y en `computed`.
- **Al arrancar** se llama a `GET /api/auth/me`: si la cookie sigue viva, el usuario se recupera tras recargar la
  página. Si no hay sesión o el backend está caído, simplemente no hay usuario.
- **Login**: pide el token CSRF, envía `{ email, contrasena }` (nada más: el backend rechaza campos extra) y guarda al
  usuario. Después **descarta el token**, porque el backend rota la sesión y el anterior deja de valer.
- **CSRF**: toda petición que modifica datos (`POST`, `PUT`, `PATCH`, `DELETE`) necesita la cabecera con el token
  (`headerName` de `/api/auth/csrf`, hoy `X-CSRF-TOKEN`). El servicio lo pide cuando hace falta y, si el servidor
  responde 403, pide uno nuevo y reintenta una vez.
- **Errores**: `login` lanza un `ErrorAutenticacion` ya traducido, con un `tipo`:

  | `tipo` | Origen | Qué hace la pantalla |
  |--------|--------|----------------------|
  | `credenciales` | 401 | Mensaje genérico: "Correo o contraseña incorrectos." |
  | `validacion` | 400 | Mensaje junto al campo afectado (códigos `OBLIGATORIO`, `FORMATO_INVALIDO`, `LONGITUD_EXCESIVA`) |
  | `bloqueado` | 429 | Cuenta atrás con los segundos de `Retry-After` y botón desactivado |
  | `servidor` | 403, 5xx | Mensaje con el `correlationId` para dárselo al soporte |
  | `red` | Sin respuesta | "No se puede conectar con el servidor" |

## 4. Añadir nuevas llamadas a la API

- **Lecturas (`GET`)**: basta con `HttpClient` y la URL `${inject(API_URL)}/api/...`. El interceptor añade las
  credenciales y gestiona el 401.
- **Escrituras (`POST`, `PUT`, `PATCH`, `DELETE`)**: necesitan el token CSRF. Ahora la lógica está en métodos privados
  de `AuthService` (`tokenCsrf` y `enviarConCsrf`). Cuando haya más de una llamada que escriba datos, lo
  recomendable es extraerla a un servicio compartido (por ejemplo `CsrfService`) en lugar de duplicarla.
- **Rutas por rol**: aún no hay guardas porque no hay rutas privadas. Para crearlas, un `CanActivateFn` que lea
  `auth.usuario()` y compruebe `rol`. Roles posibles: `CLIENTE`, `PREMIUM`, `VENDEDOR`, `ADMIN` (`PREMIUM` incluye lo
  de `CLIENTE`).
- El `registro` (`POST /api/auth/registro`) está exento de CSRF en el backend, pero sí necesita
  `Content-Type: application/json`.

## 5. Pruebas

`npm test` (o `npx ng test --watch=false`) ejecuta las pruebas con Vitest. Las de la conexión:

- `src/app/core/auth.service.spec.ts`: flujo de token y login, reintento ante 403, traducción de cada error,
  recuperación de sesión, logout (incluido el fallo del servidor) y el interceptor.
- `src/app/login/login.spec.ts`: la pantalla muestra el error que corresponde, la cuenta atrás del bloqueo y no ofrece
  "recordar dispositivo".
- `src/app/app.spec.ts`: la cabecera usa el servicio, por lo que se proporciona un `HttpClient` de pruebas.

## 6. Qué no hay (todavía)

- **"Recordar este dispositivo"**: se quitó del formulario. El backend no lo admite; la sesión caduca por inactividad
  (20 min para CLIENTE y PREMIUM, 15 min para VENDEDOR y ADMIN) y a las 8 h o 6 h como máximo.
- **"Entrar con Google"**: el botón es solo visual, no hay backend.
- **Guardas de rutas y áreas por rol**: pendientes de que existan las rutas privadas.
- **Panel de administración conectado**: `user-list` usa datos de ejemplo con valores en inglés. La equivalencia con los
  de la API está en `esibuy-backend/ADMINISTRADOR_INICIAL.md`, apartado 7.
- **Recuperar contraseña**: fuera de esta entrega.

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| "blocked by CORS policy" en la consola | Se abre el front desde otro origen | Usar `http://localhost:43127` |
| Todas las peticiones fallan sin respuesta | Backend parado o en otro puerto | Comprobar `http://localhost:8080/api/auth/csrf` y el valor de `API_URL` |
| Se entra pero al recargar se pierde la sesión | La petición a `/api/auth/me` no lleva la cookie | Comprobar que pasa por el interceptor (la URL empieza por `API_URL`) |
| La cabecera no cambia tras el login | Tras un cambio de estado fuera de una señal | Usar siempre `auth.usuario()` en las plantillas |
| Se queda en "Comprobando..." | La petición no termina | Mirar la pestaña de red del navegador |

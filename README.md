# ViviGoFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.2.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Variables de entorno en Azure (seguridad)

Este proyecto ahora genera un archivo `public/env.js` en build/start y toma sus valores para producción desde variables de entorno.

Variables soportadas:

- `API_URL`
- `WS_URL`
- `MAPBOX_TOKEN`
- `STRIPE_PUBLIC_KEY`

### Flujo local

```bash
API_URL=http://localhost/api \
WS_URL=http://localhost/ws \
MAPBOX_TOKEN=tu_token_mapbox \
STRIPE_PUBLIC_KEY=pk_test_xxx \
pnpm start
```

### Azure Static Web Apps

1. Ve a tu recurso en Azure Portal.
2. Entra a **Configuration** > **Application settings**.
3. Crea las 4 variables anteriores.
4. Guarda los cambios y vuelve a desplegar (o relanza el workflow) para que Angular reconstruya `env.js` con esos valores.

> Nota: en frontend estático, los valores que use la app se inyectan en build (no son secretos en el navegador). Mantén secretos reales solo en backend/API.

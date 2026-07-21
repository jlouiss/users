# Users

An internal admin tool for managing a directory of users (username + role
only — no PII). Sign in with Google or email/password, then add, search,
edit, enable/disable, and remove users, all backed by Firestore. Access is
restricted to a small allowlist of emails managed directly in Firestore
(see [Managing the allowlist](#managing-the-allowlist)). Live at
https://users-d64d9.web.app.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.7.

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

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Deployment

This project deploys to Firebase (project `users-d64d9`). `firebase-tools`
is a dev dependency, so the npm scripts below work with no global install
and no `npx`.

| Command | What it does |
| --- | --- |
| `npm run deploy` | Builds the app and deploys hosting + Firestore rules + auth config (everything currently deployable) |
| `npm run deploy:hosting` | Builds the app and deploys it to Firebase Hosting |
| `npm run deploy:rules` | Deploys `firestore.rules` only |
| `npm run deploy:auth` | Deploys the `auth` block in `firebase.json` (sign-in providers, authorized domains) |
| `npm run deploy:functions` | Deploys `functions/` — see note below, currently blocked |

The app is live at https://users-d64d9.web.app.

### Cloud Functions

`functions/` contains the auth-allowlist blocking functions and a legacy
`removeUser` callable. **Deploying functions requires the project to be on
the Blaze (pay-as-you-go) plan** — Cloud Functions provisions Cloud Build /
Artifact Registry / Cloud Run under the hood, which need a billing account
attached regardless of actual usage (the free quota still applies on
Blaze; you're not charged unless you exceed it). The project currently
runs on the free Spark plan, so this codebase is dormant/undeployed and
allowlist enforcement happens only via `firestore.rules`. Once upgraded,
`npm run deploy:functions` will work.

### Managing the allowlist

Who can sign in and use the app is controlled by the `emails` array field
on the `/config/allowlist` document in Firestore — edit it directly in the
[Firebase Console](https://console.firebase.google.com/project/users-d64d9/firestore/data)
(Firestore Database → Data tab). No redeploy needed; changes take effect
immediately since `firestore.rules` reads that document on every request.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

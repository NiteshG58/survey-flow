# SurveyTake

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.1.

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

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.





## Functions / Feature Overview

| Feature | Description | Key Files / Components |
|--------|-------------|------------------------|
| **Survey Questionnaire** | Drives the user through a series of dynamic questions (single‑choice, multiple‑choice, numeric, etc.). The flow is driven by the back‑end’s question list and termination logic. | `src/app/components/questionnaire/` – `QuestionnaireComponent` <br/> `src/app/services/survey.service.ts` – methods `getTargettingQuestions`, `preSurveyTerminationInQA`, etc. |
| **Routing & Navigation** | Angular router maps each question key (`screenersurvey/:questionKey`) and handles special states (closed, redirect, expire, access‑denied). | `src/app/app.routes.ts` |
| **Instruction / “Survey Final” UI** | A static informational page that shows instructions before the user reaches the real final page. It is kept for backward‑compatible flows (e.g., legacy “Instruction” screen). | `src/app/components/survey-final/` – `SurveyFinalComponent` & its HTML |
| **Process‑Finish Redirect** | After the last question the app must call the back‑end **processFinish** endpoint. A tiny Angular component (`ProcessFinishRedirectComponent`) reads the query string, builds the backend URL (`environment.prjSucRedUrl`), and performs a **hard navigation** (`window.location.href`). This leaves the SPA, lets the back‑end run its `processFinish` logic, and finally shows the legacy PHP “complete” page. | `src/app/components/process-finish-redirect/` – `ProcessFinishRedirectComponent` |
| **Supplier Redirection (Live/Test)** | When a supplier URL is required, the back‑end returns a *live* or *test* URL. The front‑end reads `supLiveTestUrl` from `vars.js` via the service and redirects the browser accordingly. | `SurveyService.getSupplierUrl` / `SurveyService.getSupplierTestUrl` |
| **Recaptcha / Fingerprint Integration** | Supports optional recaptcha verification and device‑fingerprint (TrueSample) before final submission. Errors are shown in the UI. | `src/app/components/survey-redirect/` – `SurveyRedirectComponent` (loads DeviceIQ script, handles responses). |
| **Local Storage (Answer Persistence)** | Saves partially completed answers in `localStorage` so that a user can resume a survey after a page reload or network drop‑out. | `SurveyService.saveChoicesTemporarily`, `SurveyService.getSavedAnswers` |
| **Research Defender / Verisoul (Optional Security)** | Conditional calls to external fraud‑prevention services – only executed if enabled in `SURVEY_CONFIG`. | `SurveyService.researchDfdFunction`, `SurveyService.verisoulFunction` |
| **Error Logging & Status Codes** | Centralised error handling for API calls, with configurable log levels (`exports.LOGDB_MONGO_ERROR_LEVEL`). | `admin_backend/config/vars.js`, various `catchError` branches in services. |
| **Internationalisation (i18n)** | UI strings are stored in translation files and accessed via the `translate` attribute in templates. | `src/assets/i18n/`, `translate="srvyFinal.msgPara"` etc. |
| **Responsive Design** | Uses Bootstrap‑style grid classes (`row`, `col‑md‑8`, etc.) and custom CSS (`bg_colr`, `next_btn`) to provide a mobile‑friendly layout. | CSS files in `src/styles.css` or component‑scoped styles. |
| **Testing Hooks** | Exposes observable methods that return mockable data for unit/e2e tests (e.g., `getSurveyDetails`, `preSurveyTerminationInQA`). | `survey.service.ts` methods, Jasmine/Karma test files (generated automatically). |

### How the pieces fit together (high‑level flow)

1. **App boots** → Angular router loads `screenersurvey/start`.  
2. **Question components** request target questions via `SurveyService.getTargettingQuestions`.  
3. **User answers** → answers are saved locally and posted to the back‑end.  
4. **Termination logic** (quota, fraud, etc.) may trigger an early redirect to `SurveyRedirectComponent`.  
5. **When the survey is completed**, the router lands on `/processFinish`.  
6. `ProcessFinishRedirectComponent` builds the URL from `environment.prjSucRedUrl` (including any query params) and **navigates away**.  
7. The **backend** (`admin_backend/controllers/surveyFlow.js → processFinish`) runs, decides whether to serve the static PHP “complete” page or redirect to a supplier URL, and sends the final response to the browser.  

### Quick usage checklist for developers

- **Never modify** `environment.prjSucRedUrl` to point to the Angular dev server (port 61258) – it must stay on the back‑end (port 3001).  
- **If you add new question types**: extend `SurveyService.checkTermination` and the UI component that renders the question.  
- **To change the final redirect URL**: edit `admin_backend/config/vars.js` (`exports.prjSucRedUrl`) and, if needed, the corresponding entry in `environment.ts`.  
- **When removing the legacy Angular‑JS app**: no further changes are required – the SPA now handles everything via the redirect component.  

> **Tip:** Most markdown viewers (GitHub, VS Code, GitLab, etc.) automatically place a **copy‑to‑clipboard** button on the top‑right of this fenced block. Just click that button to copy the whole section in one go.


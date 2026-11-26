import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { alCrearTransicion } from './core/router/transiciones';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import './shared/ag-grid/ag-grid-setup';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: alCrearTransicion,
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};

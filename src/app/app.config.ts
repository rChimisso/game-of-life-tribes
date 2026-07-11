import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection} from '@angular/core';
import {MAT_RIPPLE_GLOBAL_OPTIONS} from '@angular/material/core';
import {MAT_TOOLTIP_DEFAULT_OPTIONS} from '@angular/material/tooltip';
import {provideClientHydration, withEventReplay} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideRouter, withInMemoryScrolling} from '@angular/router';
import {provideEffects} from '@ngrx/effects';
import {provideStore} from '@ngrx/store';

import {routes} from './app.routes';
import {CoreEffects} from './core/redux/effects';

/**
 * Application configuration.
 *
 * @type {ApplicationConfig}
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideStore(),
    provideEffects(CoreEffects),
    provideAnimationsAsync(),
    provideClientHydration(withEventReplay()),
    provideRouter(routes, withInMemoryScrolling({scrollPositionRestoration: 'top', anchorScrolling: 'enabled'})),
    {
      provide: MAT_RIPPLE_GLOBAL_OPTIONS,
      useValue: {
        disabled: true,
        animation: {enterDuration: 0, exitDuration: 0}
      }
    },
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {
        showDelay: 1000,
        hideDelay: 0,
        touchendHideDelay: 1000,
        positionAtOrigin: false,
        disableTooltipInteractivity: true
      }
    }
  ]
};

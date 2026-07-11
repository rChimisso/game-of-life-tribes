import {ApplicationConfig, mergeApplicationConfig} from '@angular/core';
import {provideServerRendering, withRoutes} from '@angular/ssr';

import {appConfig} from './app.config';
import {serverRoutes} from './app.routes.server';

/**
 * Server-only application providers used during static prerendering.
 *
 * @type {ApplicationConfig}
 */
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))]
};

/**
 * Browser configuration merged with the server prerendering providers.
 *
 * @type {ApplicationConfig}
 */
export const config: ApplicationConfig = mergeApplicationConfig(appConfig, serverConfig);

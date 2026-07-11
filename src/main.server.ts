import {ApplicationRef} from '@angular/core';
import {BootstrapContext, bootstrapApplication} from '@angular/platform-browser';

import {App} from './app/app';
import {config} from './app/app.config.server';

/**
 * Bootstraps the Angular application in a server rendering context.
 *
 * @param {BootstrapContext} context server rendering bootstrap context.
 * @returns {Promise<ApplicationRef>} bootstrapped application reference.
 */
const bootstrap = (context: BootstrapContext): Promise<ApplicationRef> => bootstrapApplication(App, config, context);

export default bootstrap;

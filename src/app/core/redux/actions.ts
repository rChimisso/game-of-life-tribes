import {createAction, props} from '@ngrx/store';

/**
 * Opens a new tab with a precompiled issue.
 */
export const openIssue = createAction('[Core] Open issue', props<{title: string; body: string}>());

/**
 * Opens a new tab with a precompiled issue.
 */
export const openBlank = createAction('[Core] Open blank page', props<{link: string}>());

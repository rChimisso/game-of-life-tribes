import {createAction, props} from '@ngrx/store';

/**
 * Opens a new tab with a precompiled issue.
 */
export const openIssue = createAction('[Core] Open issue', props<{title: string; body: string}>());

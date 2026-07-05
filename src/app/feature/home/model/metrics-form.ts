import {FormType} from '~gol/core/model/form-type';
import {LiveMetricSectionSettings} from '~gol/feature/home/model/metrics';

/**
 * Metrics section form value.
 *
 * @typedef {MetricsFormValue}
 */
export type MetricsFormValue = LiveMetricSectionSettings;

/**
 * Metrics section form controls.
 *
 * @typedef {MetricsFormControls}
 */
export type MetricsFormControls = FormType<MetricsFormValue>;

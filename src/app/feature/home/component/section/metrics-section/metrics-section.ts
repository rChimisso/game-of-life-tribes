import {DecimalPipe, PercentPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatExpansionModule} from '@angular/material/expansion';

import {CheckboxComponent} from '../../../../../shared/component/checkbox/checkbox';
import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSection, LiveMetricSectionSettings, MetricAvailabilityStatus} from '../../../model/metrics';
import {Tribe} from '../../../model/rule';
import {MetricMessage} from '../../../model/worker-message';

/**
 * Live metrics section.
 *
 * @export
 * @class MetricsSection
 * @typedef {MetricsSection}
 */
@Component({
  selector: 'gol-metrics-section',
  standalone: true,
  imports: [
    FormsModule,
    MatExpansionModule,
    CheckboxComponent,
    DecimalPipe,
    PercentPipe
  ],
  templateUrl: './metrics-section.html',
  styleUrl: './metrics-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricsSection {
  /**
   * Latest metric payload from the worker.
   *
   * @public
   * @type {(MetricMessage | null)}
   */
  @Input({required: true})
  public metrics: MetricMessage | null = null;

  /**
   * Current tribe list used to label population values.
   *
   * @public
   * @type {readonly Tribe[]}
   */
  @Input({required: true})
  public tribes: readonly Tribe[] = [];

  /**
   * Whether live metric collection is globally enabled.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public liveMetricsEnabled = true;

  /**
   * Enabled live metric sections.
   *
   * @public
   * @type {LiveMetricSectionSettings}
   */
  @Input({required: true})
  public liveMetricSettings: LiveMetricSectionSettings = DEFAULT_LIVE_METRIC_SECTION_SETTINGS;

  /**
   * Emitter for live metric section setting changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<LiveMetricSectionSettings>}
   */
  @Output()
  public readonly settingsChange = new EventEmitter<LiveMetricSectionSettings>();

  /**
   * Whether a section is enabled by user settings.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {boolean}
   */
  public sectionEnabled(section: LiveMetricSection): boolean {
    return this.liveMetricSettings[section];
  }

  /**
   * Set one section and emit the full settings object.
   *
   * @public
   * @param {LiveMetricSection} section
   * @param {boolean} enabled
   */
  public setSection(section: LiveMetricSection, enabled: boolean): void {
    this.settingsChange.emit({
      ...this.liveMetricSettings,
      [section]: enabled
    });
  }

  /**
   * Current availability status for a live metric section.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {MetricAvailabilityStatus}
   */
  public sectionStatus(section: LiveMetricSection): MetricAvailabilityStatus {
    if (!this.liveMetricsEnabled || !this.liveMetricSettings[section]) {
      return 'disabled';
    }
    return this.metrics?.metricsAvailability?.[section] ?? 'ok';
  }

  /**
   * Whether a section has data available for display.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {boolean}
   */
  public sectionAvailable(section: LiveMetricSection): boolean {
    return this.sectionStatus(section) === 'ok';
  }

  /**
   * Human-readable availability message for a section.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {(string | null)}
   */
  public statusText(section: LiveMetricSection): string | null {
    const status = this.sectionStatus(section);
    if (status === 'disabled') {
      return this.liveMetricsEnabled ? 'Disabled' : 'Live metrics disabled';
    }
    if (status === 'tooLarge') {
      return 'Grid is too large for this metric';
    }
    return null;
  }
}

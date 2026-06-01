import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {MetricRow} from '../../element/metric-row/metric-row';

import {DEFAULT_LIVE_METRIC_SECTION_SETTINGS, LiveMetricSection, LiveMetricSectionSettings, MetricAvailabilityStatus} from '~gol/feature/home/model/metrics';
import {DEAD_TRIBE_ID, Tribe} from '~gol/feature/home/model/rule';
import {MetricMessage} from '~gol/feature/home/model/worker-message';
import {SubsectionComponent} from '~gol/shared/component/subsection/subsection';
import {ToggleButtonComponent} from '~gol/shared/component/toggle-button/toggle-button';

/**
 * Live metrics section.
 *
 * @class MetricsSection
 * @typedef {MetricsSection}
 */
@Component({
  selector: 'gol-metrics-section',
  standalone: true,
  imports: [
    FormsModule,
    SubsectionComponent,
    ToggleButtonComponent,
    MetricRow
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
   * Emitter for population subsection expansion changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly populationExpandedChange = new EventEmitter<boolean>();

  /**
   * Emitter for diversity subsection expansion changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly diversityExpandedChange = new EventEmitter<boolean>();

  /**
   * Emitter for interfaces subsection expansion changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly interfacesExpandedChange = new EventEmitter<boolean>();

  /**
   * Whether the population subsection is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public populationExpanded = true;

  /**
   * Whether the diversity subsection is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public diversityExpanded = true;

  /**
   * Whether the interfaces subsection is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input({required: true})
  public interfacesExpanded = true;

  /**
   * Tribes shown in the population subsection.
   *
   * @public
   * @readonly
   * @type {readonly Tribe[]}
   */
  public get populationTribes(): readonly Tribe[] {
    return this.tribes.filter(tribe => tribe.id !== DEAD_TRIBE_ID);
  }

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
    this.liveMetricSettings = {
      ...this.liveMetricSettings,
      [section]: enabled
    };
    this.settingsChange.emit(this.liveMetricSettings);
  }

  /**
   * Toggle label for a live metric section.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {('Enable' | 'Disable')}
   */
  public sectionToggleLabel(section: LiveMetricSection): 'Enable' | 'Disable' {
    return this.sectionEnabled(section) ? 'Disable' : 'Enable';
  }

  /**
   * Current availability status for a live metric section.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {MetricAvailabilityStatus}
   */
  public sectionStatus(section: LiveMetricSection): MetricAvailabilityStatus {
    return !this.liveMetricsEnabled || !this.liveMetricSettings[section] ? 'disabled' : this.metrics?.metricsAvailability?.[section] ?? 'ok';
  }

  /**
   * Value text to show when a metric cannot be displayed.
   *
   * @public
   * @param {LiveMetricSection} section
   * @returns {(string | null)}
   */
  public metricDisabledText(section: LiveMetricSection): string | null {
    return {
      disabled: 'disabled',
      ok: null,
      tooLarge: 'unavailable'
    }[this.sectionStatus(section)];
  }

  /**
   * Persists subsection expansion changes.
   *
   * @public
   * @param {LiveMetricSection} section
   * @param {boolean} expanded
   */
  public onSubsectionExpandedChange(section: LiveMetricSection, expanded: boolean): void {
    switch (section) {
      case 'population':
        this.populationExpanded = expanded;
        this.populationExpandedChange.emit(expanded);
        break;
      case 'diversity':
        this.diversityExpanded = expanded;
        this.diversityExpandedChange.emit(expanded);
        break;
      case 'interfaces':
        this.interfacesExpanded = expanded;
        this.interfacesExpandedChange.emit(expanded);
        break;
    }
  }
}

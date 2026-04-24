/* eslint-disable jsdoc/require-jsdoc */
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'gol-home-section',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './section.html',
  styleUrl: './section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeSection {
  @Input({required: true})
  public title = '';

  @Input({required: true})
  public description = '';

  @Input()
  public info = '';

  @Input()
  public collapsible = true;

  @Input()
  public expanded = true;

  @Output()
  public readonly expandedChange = new EventEmitter<boolean>();

  public onHeaderClick(): void {
    if (this.collapsible) {
      this.expandedChange.emit(!this.expanded);
    }
  }
}

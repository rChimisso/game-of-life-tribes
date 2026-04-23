import {Component, EventEmitter, Input, Output} from '@angular/core';
import {RouterModule} from '@angular/router';

import {Button} from '../button/button';

interface StatusPageAction {
  id: string;
  icon: string;
  label: string;
  route?: string;
}

@Component({
  selector: 'gol-status-page',
  standalone: true,
  imports: [RouterModule, Button],
  templateUrl: './status-page.html',
  styleUrl: './status-page.scss'
})
export class StatusPage {
  @Input({required: true})
  public code!: string;

  @Input({required: true})
  public description!: string;

  @Input({required: true})
  public details: string[] = [];

  @Input()
  public actionsLayout: 'between' | 'center' = 'center';

  @Input()
  public actions: StatusPageAction[] = [];

  @Output()
  public readonly actionClick = new EventEmitter<string>();

  public onActionClick(id: string): void {
    this.actionClick.emit(id);
  }
}

export type {StatusPageAction};

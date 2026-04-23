import {Component} from '@angular/core';

import {StatusPage, StatusPageAction} from '~gol/shared/component/status-page/status-page';

@Component({
  selector: 'gol-unsupported',
  standalone: true,
  imports: [StatusPage],
  templateUrl: './unsupported.html',
  styleUrl: './unsupported.scss'
})
export class UnsupportedPage {
  public readonly details = ['Your browser or device does not support WebGPU, which is required to run this project.', 'Try updating your browser or switching to a supported one.'];

  public readonly actions: StatusPageAction[] = [
    {
      id: 'check-support',
      icon: 'open_in_new',
      label: 'Check support'
    }
  ];

  public onActionClick(action: string): void {
    if (action === 'check-support') {
      this.openHelp();
    }
  }

  public openHelp(): void {
    window.open('https://caniuse.com/webgpu', '_blank', 'noopener');
  }
}

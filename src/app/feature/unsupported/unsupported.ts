import {Component} from '@angular/core';
import {RouterModule} from '@angular/router';

import {Button} from '~gol/shared/component/button/button';

@Component({
  selector: 'gol-unsupported',
  standalone: true,
  imports: [RouterModule, Button],
  templateUrl: './unsupported.html',
  styleUrl: './unsupported.scss'
})
export class UnsupportedPage {
  public openHelp(): void {
    window.open('https://caniuse.com/webgpu', '_blank', 'noopener');
  }
}

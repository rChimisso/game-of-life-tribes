import {Component} from '@angular/core';
import {RouterModule} from '@angular/router';

/**
 * Homepage.
 *
 * @export
 * @class Home
 * @typedef {HomePage}
 */
@Component({
  selector: 'gol-home',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage {}

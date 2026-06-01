import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';

/**
 * The main application component for the Game of Life Tribes.
 *
 * @class App
 * @typedef {App}
 */
@Component({
  selector: 'gol-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}

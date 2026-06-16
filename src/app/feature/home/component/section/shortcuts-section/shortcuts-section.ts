import {ChangeDetectionStrategy, Component} from '@angular/core';

import {ShortcutGroup} from '../model/shortcut';

import {CodeLabel} from '~gol/shared/component/code-label/code-label';

/**
 * Keyboard shortcuts section.
 *
 * @class ShortcutsSection
 * @typedef {ShortcutsSection}
 */
@Component({
  selector: 'gol-shortcuts-section',
  standalone: true,
  imports: [CodeLabel],
  templateUrl: './shortcuts-section.html',
  styleUrl: './shortcuts-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutsSection {
  /**
   * Shortcut groups displayed by the section.
   *
   * @public
   * @readonly
   * @type {ShortcutGroup[]}
   */
  public readonly groups: ShortcutGroup[] = [
    {
      title: 'Playback',
      values: [
        {
          code: 'Space',
          label: 'Play / Pause',
          tooltip: 'Press Space to play or pause the simulation'
        },
        {
          code: 'R',
          label: 'Restart',
          tooltip: 'Press R to restart the simulation'
        },
        {
          code: '↑ / ↓',
          label: 'Speed',
          tooltip: 'Use up and down arrows to change simulation speed'
        },
        {
          code: '← / →',
          label: 'Step',
          tooltip: 'Use left and right arrows to step backward or forward by one generation'
        },
        {
          code: 'M',
          label: 'Max speed',
          tooltip: 'Press M to toggle max simulation speed'
        },
        {
          code: 'E',
          label: 'Toggle recording',
          tooltip: 'Press E to toggle recording'
        },
        {
          code: 'W',
          label: 'Toggle live metrics',
          tooltip: 'Press W to toggle live metrics'
        }
      ]
    },
    {
      title: 'Drawing',
      values: [
        {
          code: 'LMB',
          label: 'Draw',
          tooltip: 'Hold the left mouse button to draw cells with the current selected tribes'
        },
        {
          code: 'D',
          label: 'Delete mode',
          tooltip: 'Press D to toggle delete mode'
        },
        {
          code: 'T',
          label: 'Draw tribe',
          tooltip: 'Press T to cycle the tribe selected for drawing'
        },
        {
          code: '+ / −',
          label: 'Brush size',
          tooltip: 'Use plus or minus to increase or decrease brush size'
        },
        {
          code: 'B',
          label: 'Brush shape',
          tooltip: 'Press B to cycle brush shapes'
        },
        {
          code: 'F',
          label: 'Brush mode',
          tooltip: 'Press F to cycle brush fill modes'
        }
      ]
    },
    {
      title: 'Navigation',
      values: [
        {
          code: 'S',
          label: 'Sidebar',
          tooltip: 'Press S to open or close the sidebar'
        },
        {
          code: 'RMB',
          label: 'Pan',
          tooltip: 'Hold the right mouse button to pan the view'
        },
        {
          code: 'Scroll',
          label: 'Zoom',
          tooltip: 'Use the mouse wheel to zoom in and out'
        }
      ]
    }
  ];
}

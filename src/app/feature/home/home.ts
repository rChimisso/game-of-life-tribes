import {Component, HostListener} from '@angular/core';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {DEAD_TRIBE, Ruleset, Tribe} from './model/rule';

const tribes = [
  DEAD_TRIBE,
  {
    id: 'classic',
    color: 'f0f0f0'
  }
] as const satisfies readonly Tribe[];

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
  imports: [RouterModule, Engine],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage {
  public ruleset: Ruleset<typeof tribes> = {
    cols: 100,
    rows: 100,
    tribes,
    rules: [
      {
        // Underpopulation rule.
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['classic']
            },
            {
              kind: 'count',
              interval: [0, 1],
              tribes: ['classic']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      // Survival rule.
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['classic']
            },
            {
              kind: 'count',
              interval: [2, 3],
              tribes: ['classic']
            }
          ]
        },
        tribe: 'classic'
      },
      // Overpopulation rule.
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['classic']
            },
            {
              kind: 'count',
              interval: [4, 8],
              tribes: ['classic']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      // Reproduction rule.
      {
        clause: {
          kind: 'and',
          clauses: [
            {
              kind: 'is',
              tribes: ['dead']
            },
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['classic']
            }
          ]
        },
        tribe: 'classic'
      }
    ]
  };

  public state: 'running' | 'paused' = 'paused';

  @HostListener('keydown', ['$event'])
  public test(ev: KeyboardEvent) {
    if (ev.key === ' ') {
      if (this.state === 'paused') {
        this.state = 'running';
      } else {
        this.state = 'paused';
      }
    }
  }

  public onMetrics(data: unknown) {
    console.log(data);
  }
}

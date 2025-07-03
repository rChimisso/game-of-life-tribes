import {Component, HostListener} from '@angular/core';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {AllowedTribe, ANY_TRIBE_ID, DEAD_TRIBE, Ruleset, Tribe} from './model/rule';

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
  private readonly tribes = [
    DEAD_TRIBE,
    {
      id: 'classic',
      color: 'f0f0f0'
    },
    {
      id: 'red',
      color: 'ff0000'
    },
    {
      id: 'blue',
      color: '00ff00'
    },
    {
      id: 'green',
      color: '0000ff'
    }
  ] as const satisfies readonly Tribe[];

  public ruleset: Ruleset<typeof this.tribes> = {
    cols: 100,
    rows: 100,
    tribes: this.tribes,
    rules: [
      // Underpopulation rule.
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

  public speed = 1;

  public drawTribe: Exclude<AllowedTribe<typeof this.tribes>, typeof ANY_TRIBE_ID> = 'classic';

  private drawTribeIndex = 1;

  @HostListener('keydown', ['$event'])
  public test(ev: KeyboardEvent) {
    switch (ev.key) {
      case ' ':
        if (this.state === 'paused') {
          this.state = 'running';
        } else {
          this.state = 'paused';
        }
        break;
      case 'ArrowUp':
        this.speed++;
        break;
      case 'ArrowDown':
        this.speed--;
        break;
      case 'ArrowRight':
        this.drawTribeIndex = (this.drawTribeIndex + 1) % this.tribes.length;
        this.drawTribe = this.tribes[this.drawTribeIndex]!.id;
        break;
      case 'ArrowLeft':
        this.drawTribeIndex = (this.drawTribeIndex - 1) % this.tribes.length;
        this.drawTribe = this.tribes[this.drawTribeIndex]!.id;
        break;
      case 'r':
        this.ruleset = {...this.ruleset};
    }
  }

  public onMetrics(data: unknown) {
    console.log(data);
  }
}

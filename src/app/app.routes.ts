import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('~gol/feature/home/home').then(m => m.HomePage)
  },
  {
    path: '**',
    loadComponent: () => import('~gol/feature/error/error').then(m => m.ErrorPage)
  }
];

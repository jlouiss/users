import { Routes } from '@angular/router';

import { authGuard } from './auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'login',
    loadComponent: () => import('./login').then((m) => m.Login),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () => import('./manage-users').then((m) => m.ManageUsers),
  },
  { path: '**', redirectTo: 'users' },
];

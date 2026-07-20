import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { Auth } from './auth';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // `currentUser()` is `undefined` only during the very first, still-pending
  // auth state check (e.g. a hard refresh landing directly on a protected
  // route). Once Firebase has reported a state at least once, it's `null` or
  // a `User` and reflects live changes - prefer it over the one-shot `ready`
  // promise, which stays resolved to whatever it saw first forever.
  const user = auth.currentUser() !== undefined ? auth.currentUser() : await auth.ready;
  return user ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

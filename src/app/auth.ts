import { Service, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

import { auth } from '../lib/firebase';

@Service()
export class Auth {
  private readonly currentUserSignal = signal<User | null | undefined>(undefined);

  /** `undefined` while the initial auth state is still loading, `null` when signed out. */
  readonly currentUser = this.currentUserSignal.asReadonly();

  /** Resolves once the initial auth state has been determined. */
  readonly ready: Promise<User | null>;

  constructor() {
    let resolveReady!: (user: User | null) => void;
    this.ready = new Promise<User | null>((resolve) => {
      resolveReady = resolve;
    });

    let initialStateResolved = false;
    onAuthStateChanged(auth, (user) => {
      this.currentUserSignal.set(user);
      if (!initialStateResolved) {
        initialStateResolved = true;
        resolveReady(user);
      }
    });
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async signOut(): Promise<void> {
    await signOut(auth);
  }
}

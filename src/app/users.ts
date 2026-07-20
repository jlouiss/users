import { Service, computed, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { CreateUserInput, UpdateUserInput, UserDocument } from '../models/user';

const USERS_COLLECTION = 'users';

@Service()
export class Users {
  private readonly usersCollection = collection(db, USERS_COLLECTION);

  private unsubscribe?: Unsubscribe;

  private readonly usersSignal = signal<UserDocument[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly searchTermSignal = signal('');

  readonly users = this.usersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly searchTerm = this.searchTermSignal.asReadonly();

  readonly filteredUsers = computed(() => {
    const term = this.searchTermSignal().trim().toLowerCase();
    if (!term) {
      return this.usersSignal();
    }
    return this.usersSignal().filter(
      (user) =>
        user.username.toLowerCase().includes(term) || user.role.toLowerCase().includes(term),
    );
  });

  /** Starts listening for realtime updates on the users collection. Safe to call more than once. */
  subscribe(): void {
    if (this.unsubscribe) {
      return;
    }

    this.loadingSignal.set(true);
    this.unsubscribe = onSnapshot(
      query(this.usersCollection, orderBy('createdAt', 'desc')),
      (snapshot) => {
        this.usersSignal.set(
          snapshot.docs.map(
            (docSnapshot) =>
              ({
                id: docSnapshot.id,
                ...docSnapshot.data(),
              }) as UserDocument,
          ),
        );
        this.loadingSignal.set(false);
        this.errorSignal.set(null);
      },
      (error) => {
        this.errorSignal.set(error.message);
        this.loadingSignal.set(false);
      },
    );
  }

  unsubscribeFromUsers(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  setSearchTerm(term: string): void {
    this.searchTermSignal.set(term);
  }

  async addUser(input: CreateUserInput): Promise<void> {
    await addDoc(this.usersCollection, {
      username: input.username,
      role: input.role,
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateUser(userId: string, changes: UpdateUserInput): Promise<void> {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }

  async setEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.updateUser(userId, { enabled });
  }

  async removeUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
  }
}

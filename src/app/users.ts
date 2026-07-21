import { Service, computed, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  startAt,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { CreateUserInput, UpdateUserInput, UserDocument } from '../models/user';

const USERS_COLLECTION = 'users';
const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 25;

function toUserDocument(docSnapshot: QueryDocumentSnapshot<DocumentData>): UserDocument {
  return { id: docSnapshot.id, ...docSnapshot.data() } as UserDocument;
}

@Service()
export class Users {
  private readonly usersCollection = collection(db, USERS_COLLECTION);

  private unsubscribe?: Unsubscribe;
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;
  private searchRequestId = 0;

  /** pageCursors[i] is the document to start after when loading page i; index 0 needs none. */
  private readonly pageCursors: (QueryDocumentSnapshot<DocumentData> | undefined)[] = [undefined];

  private readonly usersSignal = signal<UserDocument[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly searchInputSignal = signal('');
  private readonly searchTermSignal = signal('');
  private readonly pageIndexSignal = signal(0);
  private readonly totalCountSignal = signal(0);

  /** The users currently displayed - either the active page or, while searching, the search results. */
  readonly users = this.usersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  /** Raw, un-debounced text in the search box, for the input's own value binding. */
  readonly searchInput = this.searchInputSignal.asReadonly();
  readonly isSearchActive = computed(() => this.searchTermSignal().length > 0);

  readonly pageIndex = this.pageIndexSignal.asReadonly();
  readonly pageSize = PAGE_SIZE;
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCountSignal() / PAGE_SIZE)));
  readonly hasNextPage = computed(
    () => (this.pageIndexSignal() + 1) * PAGE_SIZE < this.totalCountSignal(),
  );
  readonly hasPrevPage = computed(() => this.pageIndexSignal() > 0);

  /** Starts listening for realtime updates on the users collection. Safe to call more than once. */
  subscribe(): void {
    if (this.unsubscribe) {
      return;
    }
    this.pageCursors.length = 1;
    this.loadPage(0);
    void this.refreshTotalCount();
  }

  unsubscribeFromUsers(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
  }

  /** Updates the search box immediately, then re-queries (paged list or backend search) after a debounce. */
  setSearchTerm(term: string): void {
    this.searchInputSignal.set(term);
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => {
      const trimmed = term.trim();
      this.searchTermSignal.set(trimmed);
      if (trimmed) {
        void this.runSearch(trimmed);
      } else {
        this.pageCursors.length = 1;
        this.loadPage(0);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  nextPage(): void {
    if (this.hasNextPage()) {
      this.loadPage(this.pageIndexSignal() + 1);
    }
  }

  prevPage(): void {
    if (this.hasPrevPage()) {
      this.loadPage(this.pageIndexSignal() - 1);
    }
  }

  private async refreshTotalCount(): Promise<void> {
    try {
      const snapshot = await getCountFromServer(this.usersCollection);
      this.totalCountSignal.set(snapshot.data().count);
    } catch {
      // Best-effort - pagination still works page-to-page without an exact total.
    }
  }

  private loadPage(index: number): void {
    this.unsubscribe?.();
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const base = query(this.usersCollection, orderBy('createdAt', 'desc'));
    const cursor = this.pageCursors[index];
    const pageQuery = cursor ? query(base, startAfter(cursor), limit(PAGE_SIZE)) : query(base, limit(PAGE_SIZE));

    this.unsubscribe = onSnapshot(
      pageQuery,
      (snapshot) => {
        const docs = snapshot.docs.map(toUserDocument);
        this.usersSignal.set(docs);
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (lastDoc) {
          this.pageCursors[index + 1] = lastDoc;
        }
        this.pageIndexSignal.set(index);
        this.loadingSignal.set(false);
        this.errorSignal.set(null);
      },
      (error) => {
        this.errorSignal.set(error.message);
        this.loadingSignal.set(false);
      },
    );
  }

  /**
   * Hybrid search: backend-indexed queries (username prefix, exact role match) reach beyond the
   * currently loaded page, unioned with a client-side "contains" match over the page already in
   * memory, which the backend range query can't express. Firestore's username range is
   * case-sensitive since matching is byte-order based and there's no normalized field to query
   * against without a security-rules change.
   */
  private async runSearch(term: string): Promise<void> {
    const requestId = ++this.searchRequestId;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const results = new Map<string, UserDocument>();

      const backendQueries = [
        getDocs(
          query(
            this.usersCollection,
            orderBy('username'),
            startAt(term),
            endAt(term + ''),
            limit(SEARCH_RESULT_LIMIT),
          ),
        ),
      ];

      const lowerTerm = term.toLowerCase();
      if (lowerTerm === 'admin' || lowerTerm === 'user') {
        backendQueries.push(
          getDocs(query(this.usersCollection, where('role', '==', lowerTerm), limit(SEARCH_RESULT_LIMIT))),
        );
      }

      const snapshots = await Promise.all(backendQueries);
      for (const snapshot of snapshots) {
        for (const docSnapshot of snapshot.docs) {
          results.set(docSnapshot.id, toUserDocument(docSnapshot));
        }
      }

      for (const user of this.usersSignal()) {
        if (
          user.username.toLowerCase().includes(lowerTerm) ||
          user.role.toLowerCase().includes(lowerTerm)
        ) {
          results.set(user.id!, user);
        }
      }

      if (requestId !== this.searchRequestId) {
        return; // a newer search superseded this one
      }
      this.usersSignal.set(
        Array.from(results.values()).sort((a, b) => a.username.localeCompare(b.username)),
      );
    } catch (error) {
      if (requestId === this.searchRequestId) {
        this.errorSignal.set((error as Error).message);
      }
    } finally {
      if (requestId === this.searchRequestId) {
        this.loadingSignal.set(false);
      }
    }
  }

  async addUser(input: CreateUserInput): Promise<void> {
    await addDoc(this.usersCollection, {
      username: input.username,
      role: input.role,
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.refreshTotalCount();
    await this.refreshCurrentView();
  }

  async updateUser(userId: string, changes: UpdateUserInput): Promise<void> {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
    await this.refreshCurrentView();
  }

  async setEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.updateUser(userId, { enabled });
  }

  async removeUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
    await this.refreshTotalCount();
    await this.refreshCurrentView();
  }

  private async refreshCurrentView(): Promise<void> {
    if (this.isSearchActive()) {
      await this.runSearch(this.searchTermSignal());
    }
    // Otherwise the paged view refreshes itself via its onSnapshot listener.
  }
}

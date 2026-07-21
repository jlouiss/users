import { TestBed } from '@angular/core/testing';

import { Users } from './users';

interface FakeQueryDocumentSnapshot {
  id: string;
  data: () => Record<string, unknown>;
}

interface FakeQuerySnapshot {
  docs: FakeQueryDocumentSnapshot[];
}

type SnapshotListener = (snapshot: FakeQuerySnapshot) => void;
type SnapshotErrorListener = (error: Error) => void;

interface FakeQueryDescriptor {
  where?: { field: string; value: unknown };
  rangeStart?: string;
  rangeEnd?: string;
}

// Backing "server" data for the getDocs-based backend search queries, independent of whatever
// is currently loaded into the component under test via onSnapshot.
const SEARCH_BACKEND_USERS = [
  { id: '1', username: 'ada', role: 'admin', enabled: true, createdAt: null, updatedAt: null },
  { id: '2', username: 'grace', role: 'user', enabled: true, createdAt: null, updatedAt: null },
];

function toDoc(user: (typeof SEARCH_BACKEND_USERS)[number]): FakeQueryDocumentSnapshot {
  return { id: user.id, data: () => user };
}

const { addDocMock, updateDocMock, deleteDocMock, onSnapshotMock, getDocsMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(() => Promise.resolve({ id: 'new-user-id' })),
  updateDocMock: vi.fn(() => Promise.resolve()),
  deleteDocMock: vi.fn(() => Promise.resolve()),
  onSnapshotMock: vi.fn(
    (_query: unknown, _onNext: SnapshotListener, _onError?: SnapshotErrorListener) => vi.fn(),
  ),
  getDocsMock: vi.fn((descriptor: FakeQueryDescriptor) => {
    let results = SEARCH_BACKEND_USERS;
    if (descriptor.where) {
      results = results.filter(
        (user) => (user as unknown as Record<string, unknown>)[descriptor.where!.field] === descriptor.where!.value,
      );
    }
    if (descriptor.rangeStart !== undefined && descriptor.rangeEnd !== undefined) {
      results = results.filter(
        (user) => user.username >= descriptor.rangeStart! && user.username <= descriptor.rangeEnd!,
      );
    }
    return Promise.resolve({ docs: results.map(toDoc) });
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string, id: string) => ({ path, id })),
  query: vi.fn((ref: FakeQueryDescriptor, ...constraints: Array<(d: FakeQueryDescriptor) => void>) => {
    const next = { ...ref };
    constraints.forEach((apply) => apply(next));
    return next;
  }),
  orderBy: vi.fn(() => () => {}),
  where: vi.fn(
    (field: string, _op: string, value: unknown) => (d: FakeQueryDescriptor) => {
      d.where = { field, value };
    },
  ),
  startAt: vi.fn((value: string) => (d: FakeQueryDescriptor) => {
    d.rangeStart = value;
  }),
  endAt: vi.fn((value: string) => (d: FakeQueryDescriptor) => {
    d.rangeEnd = value;
  }),
  startAfter: vi.fn(() => () => {}),
  limit: vi.fn(() => () => {}),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: SEARCH_BACKEND_USERS.length }) })),
  onSnapshot: onSnapshotMock,
  getDocs: getDocsMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: deleteDocMock,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

describe('Users', () => {
  let service: Users;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({});
    service = TestBed.inject(Users);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with no users and no active search term', () => {
    expect(service.users()).toEqual([]);
    expect(service.searchInput()).toBe('');
    expect(service.isSearchActive()).toBe(false);
  });

  it('subscribes to the users collection and updates state from snapshot data', () => {
    service.subscribe();

    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    const onNext = onSnapshotMock.mock.calls[0][1];

    onNext({
      docs: [
        {
          id: '1',
          data: () => ({
            username: 'ada',
            role: 'admin',
            enabled: true,
            createdAt: null,
            updatedAt: null,
          }),
        },
        {
          id: '2',
          data: () => ({
            username: 'grace',
            role: 'user',
            enabled: true,
            createdAt: null,
            updatedAt: null,
          }),
        },
      ],
    });

    expect(service.users()).toEqual([
      { id: '1', username: 'ada', role: 'admin', enabled: true, createdAt: null, updatedAt: null },
      { id: '2', username: 'grace', role: 'user', enabled: true, createdAt: null, updatedAt: null },
    ]);
    expect(service.loading()).toBe(false);
  });

  it('does not attach a second listener when already subscribed', () => {
    service.subscribe();
    service.subscribe();

    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('stops listening when unsubscribeFromUsers is called', () => {
    const unlisten = vi.fn();
    onSnapshotMock.mockReturnValueOnce(unlisten);

    service.subscribe();
    service.unsubscribeFromUsers();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('filters users by username or role', async () => {
    vi.useFakeTimers();
    try {
      service.subscribe();
      const initialSnapshot = {
        docs: SEARCH_BACKEND_USERS.map(toDoc),
      };
      onSnapshotMock.mock.calls[0][1](initialSnapshot);

      service.setSearchTerm('ADMIN');
      await vi.advanceTimersByTimeAsync(300);
      expect(service.users().map((user) => user.id)).toEqual(['1']);

      service.setSearchTerm('grace');
      await vi.advanceTimersByTimeAsync(300);
      expect(service.users().map((user) => user.id)).toEqual(['2']);

      service.setSearchTerm('');
      await vi.advanceTimersByTimeAsync(300);
      // Clearing the search re-subscribes to the paged list; replay the snapshot to simulate
      // Firestore delivering the current page again.
      const latestOnNext = onSnapshotMock.mock.calls.at(-1)![1];
      latestOnNext(initialSnapshot);
      expect(service.users()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('adds a user with default enabled state and timestamps', async () => {
    await service.addUser({ username: 'new-user', role: 'user' });

    expect(addDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        username: 'new-user',
        role: 'user',
        enabled: true,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      }),
    );
  });

  it('updates a user', async () => {
    await service.updateUser('1', { username: 'renamed' });

    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users', id: '1' }),
      expect.objectContaining({ username: 'renamed', updatedAt: 'SERVER_TIMESTAMP' }),
    );
  });

  it('toggles a user enabled state', async () => {
    await service.setEnabled('1', false);

    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users', id: '1' }),
      expect.objectContaining({ enabled: false }),
    );
  });

  it('removes a user', async () => {
    await service.removeUser('1');

    expect(deleteDocMock).toHaveBeenCalledWith(expect.objectContaining({ path: 'users', id: '1' }));
  });
});

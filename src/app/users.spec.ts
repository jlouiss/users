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

const { addDocMock, updateDocMock, deleteDocMock, onSnapshotMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(() => Promise.resolve({ id: 'new-user-id' })),
  updateDocMock: vi.fn(() => Promise.resolve()),
  deleteDocMock: vi.fn(() => Promise.resolve()),
  onSnapshotMock: vi.fn(
    (_query: unknown, _onNext: SnapshotListener, _onError?: SnapshotErrorListener) => vi.fn(),
  ),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string, id: string) => ({ path, id })),
  query: vi.fn((ref: unknown) => ref),
  orderBy: vi.fn(),
  onSnapshot: onSnapshotMock,
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
    expect(service.filteredUsers()).toEqual([]);
    expect(service.searchTerm()).toBe('');
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

  it('filters users by username or role', () => {
    service.subscribe();
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

    service.setSearchTerm('ADMIN');
    expect(service.filteredUsers().map((user) => user.id)).toEqual(['1']);

    service.setSearchTerm('grace');
    expect(service.filteredUsers().map((user) => user.id)).toEqual(['2']);

    service.setSearchTerm('');
    expect(service.filteredUsers()).toHaveLength(2);
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

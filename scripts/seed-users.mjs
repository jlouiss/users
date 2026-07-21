#!/usr/bin/env node
// Populates the `users` collection with sample data for local testing
// (pagination, search, sorting). Writes via the Admin SDK, so it bypasses
// firestore.rules entirely - only ever point this at a project you're
// happy to fill with fake data.
//
// Auth: provide credentials one of two ways -
//   1. Service account key: download one from Firebase Console > Project
//      Settings > Service Accounts, save as service-account.json in the
//      repo root (already git-ignored), and this script picks it up.
//   2. Application Default Credentials: run
//      `gcloud auth application-default login` first.
//
// Usage:
//   node scripts/seed-users.mjs            # adds 40 sample users
//   node scripts/seed-users.mjs --count 100
//   node scripts/seed-users.mjs --clear     # deletes all users first

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'users-d64d9';
const COLLECTION = 'users';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

const credential = existsSync(serviceAccountPath)
  ? cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')))
  : applicationDefault();

initializeApp({ credential, projectId: PROJECT_ID });
const db = getFirestore();

const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const countFlagIndex = args.indexOf('--count');
const count = countFlagIndex !== -1 ? Number(args[countFlagIndex + 1]) : 40;

// A few names deliberately chosen so search has something to find:
// - usernames starting with "admin" (prefix search)
// - a mix of role: admin/user independent of the username text (role search)
const PEOPLE = [
  ['admin', 'root'],
  ['admin', 'ops'],
  ['ada', 'lovelace'],
  ['alan', 'turing'],
  ['grace', 'hopper'],
  ['katherine', 'johnson'],
  ['margaret', 'hamilton'],
  ['tim', 'berners-lee'],
  ['linus', 'torvalds'],
  ['guido', 'van-rossum'],
  ['joe', 'armstrong'],
  ['jose', 'valim'],
  ['marie', 'curie'],
  ['nikola', 'tesla'],
  ['rosalind', 'franklin'],
  ['hedy', 'lamarr'],
  ['radia', 'perlman'],
  ['barbara', 'liskov'],
  ['frances', 'allen'],
  ['kyle', 'simpson'],
  ['jean', 'bartik'],
  ['mary', 'wilkes'],
  ['dennis', 'ritchie'],
  ['ken', 'thompson'],
  ['bjarne', 'stroustrup'],
  ['james', 'gosling'],
  ['brendan', 'eich'],
  ['anders', 'hejlsberg'],
  ['yukihiro', 'matsumoto'],
  ['john', 'carmack'],
  ['jeff', 'dean'],
  ['sanjay', 'ghemawat'],
  ['satoshi', 'nakamoto'],
  ['vint', 'cerf'],
  ['sophie', 'wilson'],
  ['steve', 'wozniak'],
  ['fei-fei', 'li'],
  ['andrew', 'ng'],
  ['geoffrey', 'hinton'],
  ['yann', 'lecun'],
  ['yoshua', 'bengio'],
  ['edsger', 'dijkstra'],
  ['donald', 'knuth'],
  ['leslie', 'lamport'],
];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function buildUser(first, last, now) {
  const username = `${first}.${last}`;
  const role = Math.random() < 0.2 ? 'admin' : 'user';
  const enabled = Math.random() < 0.85;
  const createdAt = Timestamp.fromMillis(now - randomBetween(0, 45) * 24 * 60 * 60 * 1000);
  const wasUpdated = Math.random() < 0.35;
  const updatedAt = wasUpdated
    ? Timestamp.fromMillis(createdAt.toMillis() + randomBetween(0, 10) * 24 * 60 * 60 * 1000)
    : createdAt;
  return { username, role, enabled, createdAt, updatedAt };
}

async function clearUsers() {
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) {
    return;
  }
  const batchSize = 400;
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    for (const docSnapshot of docs.slice(i, i + batchSize)) {
      batch.delete(docSnapshot.ref);
    }
    await batch.commit();
  }
  console.log(`Cleared ${docs.length} existing user(s).`);
}

async function seedUsers() {
  const now = Date.now();
  const people = [...PEOPLE];
  // If more users were requested than named people, pad with numbered variants.
  while (people.length < count) {
    const [first, last] = PEOPLE[people.length % PEOPLE.length];
    people.push([first, `${last}${Math.floor(people.length / PEOPLE.length) + 1}`]);
  }

  const selected = people.slice(0, count);
  const batchSize = 400;
  let written = 0;

  for (let i = 0; i < selected.length; i += batchSize) {
    const batch = db.batch();
    for (const [first, last] of selected.slice(i, i + batchSize)) {
      const ref = db.collection(COLLECTION).doc();
      batch.set(ref, buildUser(first, last, now));
      written += 1;
    }
    await batch.commit();
  }

  console.log(`Seeded ${written} user(s) into "${COLLECTION}".`);
}

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  if (shouldClear) {
    await clearUsers();
  }
  await seedUsers();
  // Admin SDK holds the process open; exit explicitly once writes are done.
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/https";
import {
  beforeUserCreated, beforeUserSignedIn,
} from "firebase-functions/identity";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

/**
 * Throws if the given email is not on the /config/allowlist document's
 * `emails` list - the same document the Firestore security rules read,
 * so editing it in the Firebase Console updates both enforcement layers.
 * @param {string | undefined} email The email to check.
 */
async function assertAllowedEmail(
  email: string | undefined
): Promise<void> {
  const normalized = email?.toLowerCase();
  const allowlistDoc = await getFirestore()
    .collection("config")
    .doc("allowlist")
    .get();
  const allowedEmails: unknown = allowlistDoc.data()?.["emails"];
  const isAllowed = !!normalized &&
    Array.isArray(allowedEmails) &&
    allowedEmails.includes(normalized);

  if (!isAllowed) {
    throw new HttpsError(
      "permission-denied",
      "This account is not authorized to access this application.",
    );
  }
}

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

initializeApp();

// Blocks account creation for any email not on the allowlist.
export const restrictSignUp = beforeUserCreated(async (event) => {
  await assertAllowedEmail(event.data?.email);
});

// Blocks sign-in for any email not on the allowlist (also covers accounts
// created before the allowlist existed, or created outside this app).
export const restrictSignIn = beforeUserSignedIn(async (event) => {
  await assertAllowedEmail(event.data?.email);
});

interface RemoveUserRequest {
  userId: string;
}

export const removeUser = onCall<RemoveUserRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to remove a user."
    );
  }
  await assertAllowedEmail(request.auth.token.email);

  const {userId} = request.data;

  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  const userRef = getFirestore().collection("users").doc(userId);
  const userSnapshot = await userRef.get();

  if (!userSnapshot.exists) {
    throw new HttpsError("not-found", `No user found with id "${userId}".`);
  }

  await userRef.delete();

  logger.info("Removed user", {userId});
});

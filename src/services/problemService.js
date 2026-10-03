/**
 * Problem Service & Data Contract
 * 
 * Manages workspace-scoped problem reporting, query feeds, and voting.
 * Compatible with future Part 5 Flask + Firebase Admin backend authorization.
 * Adheres strictly to security rules without inventing weak client rules.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const LOCAL_STORAGE_PROBLEMS_PREFIX = 'unsaid_ws_problems_';

const getLocalProblems = (workspaceId) => {
  if (!workspaceId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalProblem = (workspaceId, problem) => {
  if (!workspaceId) return;
  try {
    const existing = getLocalProblems(workspaceId);
    const updated = [problem, ...existing.filter((p) => p.id !== problem.id)];
    localStorage.setItem(
      `${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`,
      JSON.stringify(updated.slice(0, 100))
    );
  } catch (err) {
    console.warn('[UNSAID Problem Service] Local cache write failed:', err);
  }
};

const sortProblems = (list) => {
  return [...list].sort((a, b) => {
    // 1. Emergency queries strictly first
    if (Boolean(a.isEmergency) !== Boolean(b.isEmergency)) {
      return a.isEmergency ? -1 : 1;
    }
    // 2. Open queries prioritized before Solved queries
    const isSolvedA = a.status === 'solved';
    const isSolvedB = b.status === 'solved';
    if (isSolvedA !== isSolvedB) {
      return isSolvedA ? 1 : -1;
    }
    // 3. Most recent queries first
    const timeA =
      a.createdAt?.toMillis?.() ||
      (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) ||
      (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB =
      b.createdAt?.toMillis?.() ||
      (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) ||
      (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });
};

/**
 * Submits a new problem scoped strictly to a workspace.
 */
export const submitProblem = async ({
  workspaceId,
  title,
  description,
  category = 'General',
  isEmergency = false,
  workaround = '',
  shiftStatus = 'ACTIVE SHIFT',
  currentUser = null,
  userProfile = null,
  isAnonymous = false,
  pseudonym = null,
  imageUrl = null,
  imagePath = null,
}) => {
  if (!workspaceId) {
    throw new Error('Workspace identifier is required to submit a problem.');
  }
  if (!title || !title.trim()) {
    throw new Error('Please enter a descriptive problem title.');
  }
  if (!description || !description.trim()) {
    throw new Error('Please provide details for the problem description.');
  }

  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  const trimmedCategory = (category || 'General').trim();
  const trimmedWorkaround = (workaround || '').trim();

  const authorId = currentUser?.uid || 'anon_user';
  const authorName = isAnonymous
    ? (pseudonym || 'Anon Member')
    : (userProfile?.fullName || currentUser?.displayName || 'Workspace Member');
  const authorEmail = isAnonymous ? '' : (currentUser?.email || '');

  const problemData = {
    workspaceId,
    title: trimmedTitle,
    description: trimmedDesc,
    category: trimmedCategory,
    isEmergency: Boolean(isEmergency),
    priority: isEmergency ? 'emergency' : 'normal',
    workaround: trimmedWorkaround,
    shiftStatus: shiftStatus || 'ACTIVE SHIFT',
    status: 'open', // 'open' | 'solved'
    createdBy: authorId,
    authorId,
    authorName,
    authorEmail,
    isAnonymous: Boolean(isAnonymous),
    imageUrl: imageUrl || null,
    imagePath: imagePath || null,
    upvotesCount: 0,
    upvotedBy: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Client-ready representation with deterministic temporary ID
  const localId = `prob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const clientProblem = {
    ...problemData,
    id: localId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const probRef = collection(db, 'problems');
      const docRef = await addDoc(probRef, problemData);
      clientProblem.id = docRef.id;
    } catch (firestoreErr) {
      console.error('[UNSAID Problem Service] Firestore write failed:', firestoreErr);
      throw firestoreErr;
    }
  }

  saveLocalProblem(workspaceId, clientProblem);
  return clientProblem;
};

/**
 * Fetches problems scoped strictly to the given workspace.
 * Orders emergency problems first, followed by newest timestamp.
 */
export const getWorkspaceProblems = async (workspaceId) => {
  if (!workspaceId) return [];

  let firestoreList = [];

  if (db) {
    try {
      const probRef = collection(db, 'problems');
      const q = query(probRef, where('workspaceId', '==', workspaceId));
      const snap = await getDocs(q);
      firestoreList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      // Fall through to local cache if Firestore is pending backend rules
    }
  }

  const localList = getLocalProblems(workspaceId);

  // Merge unique by ID
  const seenIds = new Set();
  const merged = [];

  for (const item of [...firestoreList, ...localList]) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      merged.push(item);
    }
  }

  return sortProblems(merged);
};

/**
 * Real-time listener for workspace problems.
 * Scoped strictly to workspaceId using Firestore onSnapshot.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeToWorkspaceProblems = (workspaceId, onUpdate, onError) => {
  if (!workspaceId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  // Fast initial load from local cache if available
  const localList = getLocalProblems(workspaceId);
  if (localList.length > 0 && onUpdate) {
    onUpdate(sortProblems(localList));
  }

  if (!db) {
    if (onUpdate) onUpdate(sortProblems(localList));
    return () => {};
  }

  try {
    const probRef = collection(db, 'problems');
    const q = query(probRef, where('workspaceId', '==', workspaceId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const currentLocal = getLocalProblems(workspaceId);
        const seenIds = new Set();
        const merged = [];

        for (const item of [...firestoreList, ...currentLocal]) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            merged.push(item);
          }
        }

        if (onUpdate) {
          onUpdate(sortProblems(merged));
        }
      },
      (error) => {
        console.error('[UNSAID Problem Service Snapshot Error]', error);
        if (onError) onError(error);
        const currentLocal = getLocalProblems(workspaceId);
        if (onUpdate) onUpdate(sortProblems(currentLocal));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('[UNSAID Problem Service Subscribe Error]', err);
    if (onError) onError(err);
    const currentLocal = getLocalProblems(workspaceId);
    if (onUpdate) onUpdate(sortProblems(currentLocal));
    return () => {};
  }
};

/**
 * Updates the status of a problem (e.g. 'solved' or 'open').
 */
export const updateProblemStatus = async (problemId, status, workspaceId) => {
  if (!problemId) return;

  if (db) {
    try {
      const probRef = doc(db, 'problems', problemId);
      await updateDoc(probRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[UNSAID Problem Service] Firestore status update error:', err);
    }
  }

  if (workspaceId) {
    const local = getLocalProblems(workspaceId);
    const updated = local.map((p) => (p.id === problemId ? { ...p, status } : p));
    localStorage.setItem(
      `${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`,
      JSON.stringify(updated)
    );
  }
};

/**
 * Toggles an upvote on a problem.
 */
export const toggleProblemUpvote = async (problemId, userId, workspaceId) => {
  if (!problemId || !userId || !workspaceId) return null;

  const localList = getLocalProblems(workspaceId);
  const target = localList.find((p) => p.id === problemId);

  if (target) {
    const hasUpvoted = target.upvotedBy?.includes(userId);
    const updatedUpvotedBy = hasUpvoted
      ? (target.upvotedBy || []).filter((id) => id !== userId)
      : [...(target.upvotedBy || []), userId];
    const updatedCount = Math.max(0, updatedUpvotedBy.length);

    target.upvotedBy = updatedUpvotedBy;
    target.upvotesCount = updatedCount;
    saveLocalProblem(workspaceId, target);

    if (db) {
      try {
        const probDocRef = doc(db, 'problems', problemId);
        await updateDoc(probDocRef, {
          upvotesCount: increment(hasUpvoted ? -1 : 1),
          upvotedBy: hasUpvoted ? arrayRemove(userId) : arrayUnion(userId),
        });
      } catch {}
    }

    return { upvotesCount: updatedCount, hasUpvoted: !hasUpvoted };
  }

  return null;
};

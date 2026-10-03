/**
 * 10-Day History & Archive Service
 * 
 * Provides rolling daily snapshots for workspaces.
 * Each day: totalQueries, resolvedQueries, averagePulse, emergencyCount, dateKey, workspaceId.
 * FIFO behavior: Keep only latest 10 days. When day 11 arrives, remove oldest snapshot.
 * User problems are NEVER deleted when rotating snapshots.
 * Does not generate fake placeholder history.
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const LOCAL_SNAPSHOTS_PREFIX = 'unsaid_ws_snapshots_';

/**
 * Fetches up to 10 recent daily snapshots for a workspace (newest first).
 * 
 * @param {string} workspaceId 
 * @returns {Promise<Array>} List of snapshots
 */
export const getWorkspace10DayHistory = async (workspaceId) => {
  if (!workspaceId) return [];

  let snapshots = [];

  if (db) {
    try {
      const snapRef = collection(db, 'dailySnapshots');
      const q = query(snapRef, where('workspaceId', '==', workspaceId));
      const firestoreSnap = await getDocs(q);
      snapshots = firestoreSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.info('[UNSAID History Service] Firestore snapshots query deferred:', err.message);
    }
  }

  // Fallback / merge local workspace session snapshots
  if (snapshots.length === 0) {
    try {
      const raw = localStorage.getItem(`${LOCAL_SNAPSHOTS_PREFIX}${workspaceId}`);
      if (raw) {
        snapshots = JSON.parse(raw);
      }
    } catch {}
  }

  // Sort newest first by dateKey or date and limit to 10
  snapshots.sort((a, b) => {
    const keyA = a.dateKey || a.date || '';
    const keyB = b.dateKey || b.date || '';
    return keyB.localeCompare(keyA);
  });

  return snapshots.slice(0, 10);
};

/**
 * Records or updates a daily snapshot for a workspace, enforcing FIFO 10-day retention.
 * 
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.dateKey YYYY-MM-DD
 * @param {number} params.totalQueries
 * @param {number} params.resolvedQueries
 * @param {string|number} params.averagePulse
 * @param {number} params.emergencyCount
 */
export const recordDailySnapshot = async ({
  workspaceId,
  dateKey,
  totalQueries = 0,
  resolvedQueries = 0,
  averagePulse = '--',
  emergencyCount = 0,
}) => {
  if (!workspaceId || !dateKey) return;

  const snapshotDocId = `${workspaceId}_${dateKey}`;
  const snapshotData = {
    workspaceId,
    dateKey,
    date: dateKey,
    totalQueries: Number(totalQueries) || 0,
    resolvedQueries: Number(resolvedQueries) || 0,
    resolvedCount: Number(resolvedQueries) || 0,
    averagePulse: averagePulse || '--',
    pulseAverage: averagePulse || '--',
    emergencyCount: Number(emergencyCount) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (db) {
    try {
      const snapDocRef = doc(db, 'dailySnapshots', snapshotDocId);
      await setDoc(snapDocRef, snapshotData, { merge: true });

      // Enforce FIFO 10-day retention: fetch all snapshots for this workspace
      const snapRef = collection(db, 'dailySnapshots');
      const q = query(snapRef, where('workspaceId', '==', workspaceId));
      const firestoreSnap = await getDocs(q);

      const allSnaps = firestoreSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort oldest first
      allSnaps.sort((a, b) => {
        const keyA = a.dateKey || a.date || '';
        const keyB = b.dateKey || b.date || '';
        return keyA.localeCompare(keyB);
      });

      // If more than 10 snapshots exist, remove oldest ones (FIFO)
      if (allSnaps.length > 10) {
        const excess = allSnaps.slice(0, allSnaps.length - 10);
        for (const oldDoc of excess) {
          try {
            await deleteDoc(doc(db, 'dailySnapshots', oldDoc.id));
          } catch (delErr) {
            console.warn('[UNSAID History Service] Failed to prune old snapshot doc:', delErr);
          }
        }
      }
    } catch (err) {
      console.info('[UNSAID History Service] Firestore snapshot write deferred:', err.message);
    }
  }

  // Update local session snapshots cache
  try {
    const raw = localStorage.getItem(`${LOCAL_SNAPSHOTS_PREFIX}${workspaceId}`);
    const existing = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((s) => (s.dateKey || s.date) !== dateKey);
    const updated = [{ ...snapshotData, id: snapshotDocId }, ...filtered];
    updated.sort((a, b) => {
      const keyA = a.dateKey || a.date || '';
      const keyB = b.dateKey || b.date || '';
      return keyB.localeCompare(keyA);
    });
    localStorage.setItem(
      `${LOCAL_SNAPSHOTS_PREFIX}${workspaceId}`,
      JSON.stringify(updated.slice(0, 10))
    );
  } catch (err) {
    console.warn('[UNSAID History Service] Local snapshot write failed:', err);
  }
};

/**
 * Aggregates current workspace metrics and updates today's snapshot document.
 */
export const syncDailySnapshotFromMetrics = async ({
  workspaceId,
  problems = [],
  averagePulse = '--',
}) => {
  if (!workspaceId) return;
  const d = new Date();
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const totalQueries = problems.length;
  const resolvedQueries = problems.filter((p) => p.status === 'solved').length;
  const emergencyCount = problems.filter((p) => p.isEmergency).length;

  await recordDailySnapshot({
    workspaceId,
    dateKey,
    totalQueries,
    resolvedQueries,
    averagePulse,
    emergencyCount,
  });
};

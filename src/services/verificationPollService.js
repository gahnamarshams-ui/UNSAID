import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';

export const VERIFICATION_POLLS_COLLECTION = 'verificationPolls';
export const VERIFICATION_VOTES_COLLECTION = 'verificationVotes';

export const VERIFICATION_OPTIONS = {
  SOLVED: 'SOLVED',
  PARTIALLY_SOLVED: 'PARTIALLY_SOLVED',
  NOT_SOLVED: 'NOT_SOLVED',
};

export const VERIFICATION_OPTION_LABELS = {
  SOLVED: 'Solved',
  PARTIALLY_SOLVED: 'Partially solved',
  NOT_SOLVED: 'Not solved',
};

const LOCAL_STORAGE_PROBLEMS_PREFIX = 'unsaid_ws_problems_';
const LOCAL_STORAGE_POLLS_PREFIX = 'unsaid_local_polls_';
const LOCAL_STORAGE_VOTES_PREFIX = 'unsaid_local_votes_';

const getLocalList = (prefix, key) => {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(`${prefix}${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalList = (prefix, key, list) => {
  if (!key) return;
  try {
    localStorage.setItem(`${prefix}${key}`, JSON.stringify(list));
  } catch {}
};

/**
 * Creates or retrieves the deterministic verification poll for a problem and resolution cycle.
 * Idempotent: doc ID is `${problemId}_c${cycleNumber}`.
 * Snapshots the exact affected user IDs at this moment so verification remains logically consistent.
 */
export const createVerificationPoll = async ({
  problem,
  workspaceId,
  resolutionText,
  actionTaken = '',
  adminUser,
  adminProfile,
}) => {
  if (!problem?.id) {
    throw new Error('Problem is required to create a verification poll.');
  }
  const text = (resolutionText || '').trim();
  if (!text) {
    throw new Error('Resolution explanation is required.');
  }

  const effectiveWorkspaceId = workspaceId || problem.workspaceId;
  const currentCycle = Number(problem.resolutionCycle) || 0;
  const nextCycle = currentCycle + 1;
  const pollId = `${problem.id}_c${nextCycle}`;
  const resolutionId = `${problem.id}_res_${nextCycle}`;

  // Snapshot the affected users for this resolution cycle (Requirements 4 & 5)
  const rawAffected = Array.isArray(problem.affectedUserIds) && problem.affectedUserIds.length > 0
    ? problem.affectedUserIds
    : [problem.authorId || problem.createdBy].filter(Boolean);

  const eligibleUserIds = Array.from(new Set(rawAffected));
  const eligibleUserCount = Math.max(1, eligibleUserIds.length);

  // Preserve snapshot of reporter identities
  const eligibleReporters = Array.isArray(problem.reporters) && problem.reporters.length > 0
    ? problem.reporters.filter((r) => r && eligibleUserIds.includes(r.userId))
    : eligibleUserIds.map((uid) => ({
        userId: uid,
        userName: uid === problem.authorId ? (problem.authorName || 'Reporter') : 'Affected User',
        isAnonymous: Boolean(problem.isAnonymous && uid === problem.authorId),
        pseudonym: problem.pseudonym || null,
      }));

  const resolverName = adminProfile?.fullName || adminUser?.displayName || 'Workspace Admin';
  const resolverId = adminUser?.uid || 'admin';
  const resolvedAt = new Date().toISOString();

  const officialResolution = {
    resolutionId,
    resolutionText: text,
    summary: text,
    actionTaken: (actionTaken || '').trim(),
    resolvedBy: resolverId,
    resolvedByName: resolverName,
    resolvedAt,
    resolutionCycle: nextCycle,
    pollId,
    workspaceId: effectiveWorkspaceId,
    problemId: problem.id,
    isOfficial: true,
  };

  const pollData = {
    id: pollId,
    problemId: problem.id,
    problemTitle: problem.title || 'Untitled Problem',
    workspaceId: effectiveWorkspaceId,
    cycleNumber: nextCycle,
    resolutionId,
    resolutionText: text,
    actionTaken: (actionTaken || '').trim(),
    resolvedBy: resolverId,
    resolvedByName: resolverName,
    resolvedAt,
    question: 'Is this problem resolved?',
    status: 'active', // 'active' | 'solved' | 'reopened'
    eligibleUserIds,
    eligibleUserCount,
    eligibleReporters,
    stats: {
      solved: 0,
      partiallySolved: 0,
      notSolved: 0,
      unresolved: 0,
      totalVotes: 0,
      eligibleCount: eligibleUserCount,
      cycleNumber: nextCycle,
      unresolvedUsers: [],
      votes: {},
    },
    unresolvedUsers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Local Cache Sync
  const localPolls = getLocalList(LOCAL_STORAGE_POLLS_PREFIX, problem.id);
  const updatedPolls = [...localPolls.filter((p) => p.id !== pollId), pollData];
  saveLocalList(LOCAL_STORAGE_POLLS_PREFIX, problem.id, updatedPolls);

  if (effectiveWorkspaceId) {
    const localProblems = getLocalList(LOCAL_STORAGE_PROBLEMS_PREFIX, effectiveWorkspaceId);
    const updatedProblems = localProblems.map((p) =>
      p.id === problem.id
        ? {
            ...p,
            status: 'awaiting_verification',
            resolutionPendingVerification: true,
            isReopened: false,
            resolutionCycle: nextCycle,
            currentPollId: pollId,
            officialResolution,
            stillReportingCount: 0,
            unresolvedUsers: [],
            verificationStats: pollData.stats,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    saveLocalList(LOCAL_STORAGE_PROBLEMS_PREFIX, effectiveWorkspaceId, updatedProblems);
  }

  // 2. Firestore Sync
  if (db) {
    // Primary authoritative write: update the official resolution and verification state on the problem document
    try {
      const probRef = doc(db, 'problems', problem.id);
      await updateDoc(probRef, {
        status: 'awaiting_verification',
        resolutionPendingVerification: true,
        isReopened: false,
        resolutionCycle: nextCycle,
        currentPollId: pollId,
        officialResolution,
        stillReportingCount: 0,
        unresolvedUsers: [],
        verificationStats: pollData.stats,
        updatedAt: serverTimestamp(),
      });
    } catch (probErr) {
      console.error('[UNSAID Problem Resolution Update Error]', probErr);
      if (probErr?.code === 'permission-denied') {
        throw new Error('Permission denied: You do not have administrator permissions to publish resolutions in this workspace.');
      }
      throw probErr;
    }

    // Secondary write: synchronize dedicated verificationPolls collection if supported
    try {
      const pollRef = doc(db, VERIFICATION_POLLS_COLLECTION, pollId);
      await setDoc(
        pollRef,
        {
          ...pollData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (pollErr) {
      console.warn('[UNSAID Verification Poll Collection Sync Notice]', pollErr?.message || pollErr);
    }
  }

  return { poll: pollData, officialResolution };
};

/**
 * Subscribes to the specific verification poll in real-time.
 * Features automatic fallback to problems/{problemId} if verificationPolls collection is not available.
 */
export const subscribeToVerificationPoll = (pollId, onUpdate, onError, problemId) => {
  if (!pollId && !problemId) {
    if (onUpdate) onUpdate(null);
    return () => {};
  }

  const effectiveProblemId = problemId || (pollId ? pollId.split('_c')[0] : null);

  if (!db) {
    // Local fallback
    if (effectiveProblemId) {
      const local = getLocalList(LOCAL_STORAGE_POLLS_PREFIX, effectiveProblemId);
      const found = local.find((p) => p.id === pollId) || null;
      if (onUpdate) onUpdate(found);
    }
    return () => {};
  }

  // Primary subscription to problem document to ensure resolution state is always synchronized
  let unsubProblem = null;
  if (effectiveProblemId) {
    try {
      const probRef = doc(db, 'problems', effectiveProblemId);
      unsubProblem = onSnapshot(
        probRef,
        (probSnap) => {
          if (probSnap.exists()) {
            const probData = probSnap.data();
            const currentCycle = Number(probData.resolutionCycle) || 1;
            const expectedPollId = pollId || probData.currentPollId || `${effectiveProblemId}_c${currentCycle}`;

            if (probData.officialResolution) {
              const res = probData.officialResolution;
              const rawAffected = Array.isArray(probData.affectedUserIds) && probData.affectedUserIds.length > 0
                ? probData.affectedUserIds
                : [probData.authorId || probData.createdBy].filter(Boolean);
              const eligibleUserIds = res.eligibleUserIds || Array.from(new Set(rawAffected));
              const eligibleUserCount = res.eligibleUserCount || Math.max(1, eligibleUserIds.length);
              const eligibleReporters = res.eligibleReporters || (Array.isArray(probData.reporters) && probData.reporters.length > 0
                ? probData.reporters.filter((r) => r && eligibleUserIds.includes(r.userId))
                : eligibleUserIds.map((uid) => ({
                    userId: uid,
                    userName: uid === probData.authorId ? (probData.authorName || 'Reporter') : 'Affected User',
                    isAnonymous: Boolean(probData.isAnonymous && uid === probData.authorId),
                    pseudonym: probData.pseudonym || null,
                  })));

              const derivedPoll = {
                id: expectedPollId,
                problemId: effectiveProblemId,
                problemTitle: probData.title || 'Untitled Problem',
                workspaceId: probData.workspaceId,
                cycleNumber: currentCycle,
                resolutionId: res.resolutionId || `${effectiveProblemId}_res_${currentCycle}`,
                resolutionText: res.resolutionText || res.summary || '',
                actionTaken: res.actionTaken || '',
                resolvedBy: res.resolvedBy,
                resolvedByName: res.resolvedByName,
                resolvedAt: res.resolvedAt,
                question: 'Is this problem resolved?',
                status: probData.status === 'solved' ? 'solved' : probData.status === 'reopened' ? 'reopened' : 'active',
                eligibleUserIds,
                eligibleUserCount,
                eligibleReporters,
                stats: probData.verificationStats || {
                  solved: 0,
                  partiallySolved: 0,
                  notSolved: 0,
                  unresolved: 0,
                  totalVotes: 0,
                  eligibleCount: eligibleUserCount,
                },
                unresolvedUsers: probData.verificationStats?.unresolvedUsers || probData.unresolvedUsers || [],
                createdAt: probData.createdAt,
                updatedAt: probData.updatedAt,
              };

              if (onUpdate) onUpdate(derivedPoll);
            }
          }
        },
        (err) => {
          console.warn('[UNSAID Problem Subscription for Poll Fallback Error]', err);
        }
      );
    } catch (e) {
      console.warn('[UNSAID Problem Listener Setup Failed]', e);
    }
  }

  // Secondary subscription to dedicated verificationPolls doc if available
  let unsubPoll = null;
  if (pollId) {
    try {
      const pollRef = doc(db, VERIFICATION_POLLS_COLLECTION, pollId);
      unsubPoll = onSnapshot(
        pollRef,
        (snapshot) => {
          if (snapshot.exists()) {
            if (onUpdate) onUpdate({ id: snapshot.id, ...snapshot.data() });
          }
        },
        (err) => {
          // Expected when verificationPolls collection rules are not deployed
          if (err?.code !== 'permission-denied') {
            console.warn('[UNSAID Verification Poll Subscription Error]', err);
          }
        }
      );
    } catch {
      // Ignore
    }
  }

  return () => {
    if (typeof unsubProblem === 'function') unsubProblem();
    if (typeof unsubPoll === 'function') unsubPoll();
  };
};

/**
 * Subscribes to all votes for a specific verification poll in real-time.
 * Computes exact counts, percentages, and unresolved user entries.
 * Listens authoritative problem doc verificationStats.votes first.
 */
export const subscribeToVerificationVotes = (pollId, onUpdate, onError, problemId) => {
  if (!pollId && !problemId) {
    if (onUpdate) {
      onUpdate({
        votes: [],
        counts: { SOLVED: 0, PARTIALLY_SOLVED: 0, NOT_SOLVED: 0 },
        percentages: { SOLVED: 0, PARTIALLY_SOLVED: 0, NOT_SOLVED: 0 },
        totalVotes: 0,
        unresolvedUsers: [],
      });
    }
    return () => {};
  }

  const effectiveProblemId = problemId || (pollId ? pollId.split('_c')[0] : null);

  if (!db) {
    if (pollId) {
      const votes = getLocalList(LOCAL_STORAGE_VOTES_PREFIX, pollId);
      const processed = computeVoteMetrics(votes);
      if (onUpdate) onUpdate(processed);
    }
    return () => {};
  }

  let unsubProblem = null;
  let unsubVotes = null;

  // Primary listener: problem document's verificationStats.votes
  if (effectiveProblemId) {
    try {
      const probRef = doc(db, 'problems', effectiveProblemId);
      unsubProblem = onSnapshot(
        probRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const currentCycle = Number(data.resolutionCycle) || 1;
            const stats = data.verificationStats || {};
            const rawVotesMap = stats.votes || {};
            const cycleVotes = Object.values(rawVotesMap).filter(
              (v) => (Number(v.cycleNumber) || 1) === currentCycle
            );

            if (cycleVotes.length > 0) {
              const processed = computeVoteMetrics(cycleVotes);
              if (onUpdate) onUpdate(processed);
            }
          }
        },
        (err) => {
          console.warn('[UNSAID Verification Votes from Problem Error]', err);
        }
      );
    } catch (e) {
      console.warn('[UNSAID Problem Votes Listener Failed]', e);
    }
  }

  // Secondary listener: verificationVotes collection if available
  if (pollId) {
    try {
      const votesRef = collection(db, VERIFICATION_VOTES_COLLECTION);
      const q = query(votesRef, where('pollId', '==', pollId));

      unsubVotes = onSnapshot(
        q,
        (snapshot) => {
          const votes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (votes.length > 0) {
            const processed = computeVoteMetrics(votes);
            if (onUpdate) onUpdate(processed);
          }
        },
        (err) => {
          // If permission-denied, do not wipe votes - problem document is source of truth
          if (err?.code !== 'permission-denied') {
            console.warn('[UNSAID Verification Votes Subscription Error]', err);
          }
        }
      );
    } catch {
      // Ignore
    }
  }

  return () => {
    if (typeof unsubProblem === 'function') unsubProblem();
    if (typeof unsubVotes === 'function') unsubVotes();
  };
};

/**
 * Helper to compute vote statistics and unresolved breakdowns
 */
export const computeVoteMetrics = (votes = []) => {
  const counts = {
    SOLVED: 0,
    PARTIALLY_SOLVED: 0,
    NOT_SOLVED: 0,
  };

  const unresolvedUsers = [];

  for (const v of votes) {
    const opt = (v.option || '').toUpperCase();
    if (opt === 'SOLVED') {
      counts.SOLVED += 1;
    } else if (opt === 'PARTIALLY_SOLVED') {
      counts.PARTIALLY_SOLVED += 1;
      unresolvedUsers.push({
        userId: v.userId,
        userName: v.userName || 'Member',
        option: 'PARTIALLY_SOLVED',
        label: 'Partially solved',
      });
    } else if (opt === 'NOT_SOLVED') {
      counts.NOT_SOLVED += 1;
      unresolvedUsers.push({
        userId: v.userId,
        userName: v.userName || 'Member',
        option: 'NOT_SOLVED',
        label: 'Not solved',
      });
    }
  }

  const totalVotes = votes.length;
  const percentages = {
    SOLVED: totalVotes > 0 ? Math.round((counts.SOLVED / totalVotes) * 100) : 0,
    PARTIALLY_SOLVED: totalVotes > 0 ? Math.round((counts.PARTIALLY_SOLVED / totalVotes) * 100) : 0,
    NOT_SOLVED: totalVotes > 0 ? Math.round((counts.NOT_SOLVED / totalVotes) * 100) : 0,
  };

  return {
    votes,
    counts,
    percentages,
    totalVotes,
    unresolvedUsers,
  };
};

/**
 * Submits a vote on a resolution verification poll.
 * STRICT REQUIREMENTS:
 * 1. Only affected/eligible users can vote (verified via UID).
 * 2. Deterministic doc ID guarantees 1 user = 1 vote.
 * 3. Changing vote replaces prior choice and updates counts.
 * 4. UNANIMOUS RULE:
 *    - EVERY affected user must vote SOLVED for FINAL SOLVED.
 *    - If ANY affected user votes PARTIALLY_SOLVED or NOT_SOLVED -> REOPEN IMMEDIATELY!
 * 5. Uses authoritative problems/{problemId} document write compatible with deployed rules.
 */
export const submitVerificationVote = async ({
  pollId,
  problemId,
  workspaceId,
  option, // 'SOLVED' | 'PARTIALLY_SOLVED' | 'NOT_SOLVED'
  currentUser,
  userProfile,
}) => {
  if (!problemId || !option) {
    throw new Error('Problem ID and voting option are required.');
  }
  if (!currentUser?.uid) {
    throw new Error('You must be signed in to verify this resolution.');
  }

  const normalizedOption = option.toUpperCase();
  if (![VERIFICATION_OPTIONS.SOLVED, VERIFICATION_OPTIONS.PARTIALLY_SOLVED, VERIFICATION_OPTIONS.NOT_SOLVED].includes(normalizedOption)) {
    throw new Error('Invalid verification option selected.');
  }

  // 1. Fetch current problem document from Firestore or local cache
  let problemData = null;
  if (db) {
    try {
      const probSnap = await getDoc(doc(db, 'problems', problemId));
      if (probSnap.exists()) {
        problemData = { id: probSnap.id, ...probSnap.data() };
      }
    } catch (probErr) {
      console.warn('[UNSAID Fetch Problem Error]', probErr?.code, probErr?.message);
    }
  }

  if (!problemData && workspaceId) {
    const local = getLocalList(LOCAL_STORAGE_PROBLEMS_PREFIX, workspaceId);
    problemData = local.find((p) => p.id === problemId);
  }

  if (!problemData) {
    throw new Error('Query not found for resolution verification.');
  }

  // 2. Derive current resolution cycle and effective poll ID
  const currentCycle = Number(problemData.resolutionCycle) || 1;
  const effectivePollId = pollId || problemData.currentPollId || `${problemId}_c${currentCycle}`;

  // 3. Inspect voter eligibility (Requirements 2, 4, 24)
  // Check against snapshot in officialResolution, affectedUserIds, reporters, authorId, or createdBy
  const officialRes = problemData.officialResolution || {};
  let eligibleIds = [];
  if (Array.isArray(officialRes.eligibleUserIds) && officialRes.eligibleUserIds.length > 0) {
    eligibleIds = officialRes.eligibleUserIds;
  } else if (Array.isArray(problemData.affectedUserIds) && problemData.affectedUserIds.length > 0) {
    eligibleIds = problemData.affectedUserIds;
  } else {
    eligibleIds = [problemData.authorId || problemData.createdBy].filter(Boolean);
  }

  const isReporter = Array.isArray(problemData.reporters) &&
    problemData.reporters.some((r) => (r?.userId || r?.id) === currentUser.uid);
  const isAuthor = problemData.authorId === currentUser.uid || problemData.createdBy === currentUser.uid;
  const isDirectlyEligible = eligibleIds.includes(currentUser.uid) || isReporter || isAuthor;

  if (!isDirectlyEligible) {
    throw new Error('Only users who reported or are affected by this query can vote in this resolution verification poll.');
  }

  // Check if resolution cycle is already finalized and locked
  if (problemData.status === 'solved' && !problemData.isReopened && !problemData.resolutionPendingVerification) {
    throw new Error('This resolution cycle has already been finalized.');
  }

  // 4. Build deterministic vote record: 1 user = 1 vote
  const effectiveWorkspaceId = workspaceId || problemData.workspaceId || officialRes.workspaceId;
  const voteDocId = `${effectivePollId}_${currentUser.uid}`;
  const voterName = userProfile?.fullName || currentUser.displayName || 'Affected Member';
  const nowIso = new Date().toISOString();

  // Read existing votes from problemData.verificationStats
  const existingStats = problemData.verificationStats || {};
  const existingVotesMap = { ...(existingStats.votes || {}) };
  const prevVote = existingVotesMap[currentUser.uid];

  const voteRecord = {
    id: voteDocId,
    pollId: effectivePollId,
    problemId,
    workspaceId: effectiveWorkspaceId,
    cycleNumber: currentCycle,
    userId: currentUser.uid,
    userName: voterName,
    userAvatar: userProfile?.avatarUrl || null,
    option: normalizedOption,
    votedAt: prevVote?.votedAt || nowIso,
    updatedAt: nowIso,
  };

  // Upsert the user's vote into the map (updates prior choice seamlessly)
  existingVotesMap[currentUser.uid] = voteRecord;

  // 5. UNANIMOUS VERIFICATION CALCULATION
  const currentCycleVotes = Object.values(existingVotesMap).filter(
    (v) => (Number(v.cycleNumber) || 1) === currentCycle
  );

  const metrics = computeVoteMetrics(currentCycleVotes);
  const solvedCount = metrics.counts.SOLVED;
  const partiallySolvedCount = metrics.counts.PARTIALLY_SOLVED;
  const notSolvedCount = metrics.counts.NOT_SOLVED;
  const unresolvedList = metrics.unresolvedUsers;

  const eligibleCount = Math.max(
    1,
    Number(officialRes.eligibleUserCount || problemData.affectedUserCount || eligibleIds.length || 1)
  );

  let nextProblemStatus = 'awaiting_verification';
  let isReopened = false;
  let isFinalSolved = false;

  // RULE 1: If ANY affected user votes Partially Solved or Not Solved -> REOPEN!
  if (unresolvedList.length > 0) {
    nextProblemStatus = 'reopened';
    isReopened = true;
  }
  // RULE 2: ONLY if EVERY affected user voted SOLVED -> FINAL SOLVED!
  else if (
    currentCycleVotes.length >= eligibleCount &&
    solvedCount === eligibleCount &&
    partiallySolvedCount === 0 &&
    notSolvedCount === 0
  ) {
    nextProblemStatus = 'solved';
    isFinalSolved = true;
  }
  // RULE 3: Otherwise still awaiting remaining responses
  else {
    nextProblemStatus = 'awaiting_verification';
  }

  const pollStatus = isFinalSolved ? 'solved' : isReopened ? 'reopened' : 'active';

  const verificationStats = {
    solved: solvedCount,
    partiallySolved: partiallySolvedCount,
    notSolved: notSolvedCount,
    unresolved: unresolvedList.length,
    totalVotes: currentCycleVotes.length,
    eligibleCount,
    cycleNumber: currentCycle,
    unresolvedUsers: unresolvedList,
    votes: existingVotesMap,
  };

  // 6. Authoritative Primary Write: Update problems/{problemId} document
  // Strict compliance with deployed rules: only keys permitted by hasOnly
  if (db) {
    const fsProblemUpdate = {
      status: nextProblemStatus,
      isReopened,
      resolutionPendingVerification: nextProblemStatus === 'awaiting_verification',
      stillReportingCount: unresolvedList.length,
      verificationStats,
      updatedAt: serverTimestamp(),
    };
    if (isReopened) {
      fsProblemUpdate.reopenedAt = serverTimestamp();
    }

    try {
      const probRef = doc(db, 'problems', problemId);
      await updateDoc(probRef, fsProblemUpdate);
    } catch (probWriteErr) {
      console.error('[UNSAID Problem Verification Write Error]', probWriteErr?.code, probWriteErr?.message);
      if (probWriteErr?.code === 'permission-denied') {
        throw new Error('Permission denied: Unable to record verification vote on this query.');
      }
      throw probWriteErr;
    }

    // 7. Secondary best-effort writes to collections (if deployed/supported)
    try {
      const voteRef = doc(db, VERIFICATION_VOTES_COLLECTION, voteDocId);
      await setDoc(
        voteRef,
        {
          ...voteRecord,
          updatedAt: serverTimestamp(),
          votedAt: prevVote?.votedAt ? prevVote.votedAt : serverTimestamp(),
        },
        { merge: true }
      );
    } catch (voteSyncErr) {
      // Non-blocking notice for undeployed verificationVotes collection
      console.warn('[UNSAID Verification Vote Sync Notice]', voteSyncErr?.code, voteSyncErr?.message);
    }

    try {
      const pollRef = doc(db, VERIFICATION_POLLS_COLLECTION, effectivePollId);
      await updateDoc(pollRef, {
        status: pollStatus,
        stats: verificationStats,
        unresolvedUsers: unresolvedList,
        updatedAt: serverTimestamp(),
      });
    } catch (pollSyncErr) {
      // Non-blocking notice for undeployed verificationPolls collection
      console.warn('[UNSAID Verification Poll Sync Notice]', pollSyncErr?.code, pollSyncErr?.message);
    }
  }

  // 8. Update Local Caches
  const localVotes = getLocalList(LOCAL_STORAGE_VOTES_PREFIX, effectivePollId);
  const updatedLocalVotes = [
    ...localVotes.filter((v) => v.id !== voteDocId && v.userId !== currentUser.uid),
    voteRecord,
  ];
  saveLocalList(LOCAL_STORAGE_VOTES_PREFIX, effectivePollId, updatedLocalVotes);

  if (effectiveWorkspaceId) {
    const localProblems = getLocalList(LOCAL_STORAGE_PROBLEMS_PREFIX, effectiveWorkspaceId);
    const updatedProblems = localProblems.map((p) =>
      p.id === problemId
        ? {
            ...p,
            status: nextProblemStatus,
            isReopened,
            resolutionPendingVerification: nextProblemStatus === 'awaiting_verification',
            stillReportingCount: unresolvedList.length,
            verificationStats,
            unresolvedUsers: unresolvedList,
            updatedAt: nowIso,
            ...(isReopened ? { reopenedAt: nowIso } : {}),
            ...(isFinalSolved ? { solvedAt: nowIso } : {}),
          }
        : p
    );
    saveLocalList(LOCAL_STORAGE_PROBLEMS_PREFIX, effectiveWorkspaceId, updatedProblems);
  }

  // 9. Admin Notification on Reopening (Requirement 19)
  if (isReopened && effectiveWorkspaceId) {
    await dispatchReopenNotification({
      problemId,
      problemTitle: problemData.title || 'Query',
      workspaceId: effectiveWorkspaceId,
      unresolvedUsers: unresolvedList,
    });
  }

  return {
    voteId: voteDocId,
    pollId: effectivePollId,
    option: normalizedOption,
    status: nextProblemStatus,
    pollStatus,
    isReopened,
    isFinalSolved,
    metrics,
    unresolvedUsers: unresolvedList,
  };
};

/**
 * Dispatches a notification to the workspace administrator when a problem is reopened
 * by one or more unresolved verification votes (Requirement 19).
 */
const dispatchReopenNotification = async ({
  problemId,
  problemTitle = 'Query',
  workspaceId,
  unresolvedUsers = [],
}) => {
  if (!db || !workspaceId || unresolvedUsers.length === 0) return;

  try {
    const wsRef = doc(db, 'workspaces', workspaceId);
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) return;

    const wsData = wsSnap.data();
    const adminUid = wsData.createdBy;
    if (!adminUid) return;

    const summaryList = unresolvedUsers
      .map((u) => `• ${u.userName} — ${u.option === 'PARTIALLY_SOLVED' ? 'Partially Solved' : 'Not Solved'}`)
      .join('\n');

    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: adminUid,
      type: 'problem_reopened',
      title: '⚠️ Query Reopened by Verification',
      message: `${unresolvedUsers.length} affected user(s) reported "${problemTitle}" is not resolved.\n${summaryList}`,
      problemId,
      workspaceId,
      workspaceName: wsData.name || 'Workspace',
      unresolvedCount: unresolvedUsers.length,
      unresolvedUsers,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[UNSAID Reopen Notification Notice]', err);
  }
};

/**
 * Retrieves all verification polls for a problem across historical resolution cycles.
 */
export const getProblemVerificationPollHistory = async (problemId) => {
  if (!problemId) return [];

  if (!db) {
    return getLocalList(LOCAL_STORAGE_POLLS_PREFIX, problemId);
  }

  try {
    const q = query(
      collection(db, VERIFICATION_POLLS_COLLECTION),
      where('problemId', '==', problemId)
    );
    const snap = await getDocs(q);
    const polls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    polls.sort((a, b) => (Number(a.cycleNumber) || 0) - (Number(b.cycleNumber) || 0));
    return polls;
  } catch (err) {
    console.warn('[UNSAID Get Poll History Error]', err);
    return getLocalList(LOCAL_STORAGE_POLLS_PREFIX, problemId);
  }
};

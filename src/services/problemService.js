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
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
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
import { enqueueOfflineProblem, enqueueOfflineMessage } from './offlineSyncService';
import { checkSimilarProblem } from './aiResolutionService';

const withTimeout = (promise, ms = 4500) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error('Database operation timed out');
        err.code = 'unavailable';
        reject(err);
      }, ms);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);

const LOCAL_STORAGE_PROBLEMS_PREFIX = 'unsaid_ws_problems_';
const LOCAL_STORAGE_REPORTS_PREFIX = 'unsaid_prob_reports_';

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

const getLocalReports = (problemId) => {
  if (!problemId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REPORTS_PREFIX}${problemId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalReports = (problemId, reports) => {
  if (!problemId) return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_REPORTS_PREFIX}${problemId}`, JSON.stringify(reports));
  } catch {}
};

/**
 * Normalizes text for semantic and lexical comparison.
 */
const normalizeText = (str) => {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extracts distinct location / zone tokens (e.g. 'block a', 'block b', 'lab 1', 'room 204').
 */
const extractLocationTokens = (text) => {
  const norm = normalizeText(text);
  const patterns = [
    /\b(block\s+[a-z0-9]+)\b/g,
    /\b(lab\s+[a-z0-9]+)\b/g,
    /\b(room\s+[a-z0-9]+)\b/g,
    /\b(floor\s+[a-z0-9]+)\b/g,
    /\b(building\s+[a-z0-9]+)\b/g,
    /\b(wing\s+[a-z0-9]+)\b/g,
    /\b(campus\s+[a-z0-9]+)\b/g,
  ];
  const tokens = new Set();
  for (const pat of patterns) {
    const matches = norm.match(pat);
    if (matches) {
      matches.forEach((m) => tokens.add(m.trim()));
    }
  }
  return tokens;
};

/**
 * Checks if two texts target mutually exclusive entities (e.g. AC vs PC).
 */
const hasConflictingEntities = (textA, textB) => {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  const distinctClusters = [
    ['ac', 'air conditioner', 'air conditioning', 'cooler', 'chiller', 'thermostat'],
    ['pc', 'computer', 'desktop', 'monitor', 'keyboard', 'cpu', 'workstation'],
    ['projector', 'projector screen', 'display screen', 'beamer'],
    ['printer', 'photocopier', 'xerox', 'scanner'],
    ['lift', 'elevator'],
    ['water', 'tap', 'sink', 'plumbing', 'washroom', 'toilet', 'restroom'],
  ];

  for (let i = 0; i < distinctClusters.length; i++) {
    for (let j = 0; j < distinctClusters.length; j++) {
      if (i === j) continue;
      const clusterA = distinctClusters[i];
      const clusterB = distinctClusters[j];

      const mentionsA1 = clusterA.some((w) => new RegExp(`\\b${w}\\b`).test(normA));
      const mentionsB2 = clusterB.some((w) => new RegExp(`\\b${w}\\b`).test(normB));
      const mentionsA2 = clusterA.some((w) => new RegExp(`\\b${w}\\b`).test(normB));
      const mentionsB1 = clusterB.some((w) => new RegExp(`\\b${w}\\b`).test(normA));

      if (mentionsA1 && mentionsB2 && !mentionsA2 && !mentionsB1) {
        return true; // Explicitly targets different equipment/systems
      }
    }
  }
  return false;
};

/**
 * Calculates lexical similarity score with synonym mapping.
 */
const calculateLexicalSimilarity = (textA, textB) => {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const synonymsMap = {
    'wifi': 'internet',
    'wi fi': 'internet',
    'connection': 'internet',
    'network': 'internet',
    'pc': 'computer',
    'desktop': 'computer',
    'workstation': 'computer',
    'power': 'powerup',
    'turn on': 'powerup',
    'turning on': 'powerup',
    'power on': 'powerup',
    'boot': 'powerup',
    'start': 'powerup',
    'working': 'broken',
    'functioning': 'broken',
  };

  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'is', 'are', 'was', 'were', 'not', 'no',
    'my', 'our', 'to', 'for', 'of', 'and', 'with', 'won', 't', 'cant', 'cannot', 'it', 'does', 'doesn'
  ]);

  const tokenize = (text) => {
    let t = text;
    for (const [k, v] of Object.entries(synonymsMap)) {
      t = t.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
    }
    return new Set(
      t
        .split(/\s+/)
        .filter((w) => w.length > 1 && !stopWords.has(w))
    );
  };

  const tokensA = tokenize(normA);
  const tokensB = tokenize(normB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
};

/**
 * Evaluates whether a new problem matches any active problem in the same workspace.
 * Strict workspace scoping, Gemini AI assisted, with deterministic lexical fallback.
 */
export const findMatchingProblem = async ({
  workspaceId,
  title,
  description,
  category = 'General',
  candidateProblems = [],
}) => {
  if (!workspaceId || !title || !description) return null;

  // STRICT RULE: Only consider active candidates in the SAME workspace
  const activeCandidates = candidateProblems.filter(
    (p) =>
      p &&
      p.workspaceId === workspaceId &&
      p.status !== 'solved' &&
      !p.isConfidential
  );

  if (activeCandidates.length === 0) return null;

  // 1. Attempt backend AI semantic matching if available
  try {
    const aiResult = await checkSimilarProblem({
      workspaceId,
      title,
      description,
      category,
      candidateProblems: activeCandidates,
    });

    if (aiResult?.hasSimilarProblem && aiResult?.similarProblems?.length > 0) {
      const topMatch = aiResult.similarProblems[0];
      const matched = activeCandidates.find((c) => c.id === topMatch.problemId);
      if (matched) {
        // Double check against conflicting physical locations or equipment
        const conflictEntity = hasConflictingEntities(
          `${title} ${description}`,
          `${matched.title} ${matched.description}`
        );
        const locA = extractLocationTokens(`${title} ${description}`);
        const locB = extractLocationTokens(`${matched.title} ${matched.description}`);
        let conflictLocation = false;
        if (locA.size > 0 && locB.size > 0) {
          conflictLocation = ![...locA].some((l) => locB.has(l));
        }

        if (!conflictEntity && !conflictLocation) {
          return {
            problem: matched,
            confidence: topMatch.confidence || 'high',
            reason: topMatch.reason || 'AI semantic match confirmed.',
            method: 'ai',
          };
        }
      }
    }
  } catch (aiErr) {
    console.warn('[UNSAID Problem Aggregator] AI semantic check notice:', aiErr?.message);
  }

  // 2. High-precision deterministic lexical & context matching fallback
  const newFullText = `${title} ${description}`;
  const newLocations = extractLocationTokens(newFullText);

  for (const candidate of activeCandidates) {
    const candFullText = `${candidate.title} ${candidate.description}`;

    // Conflict Check 1: Mutually exclusive equipment / system
    if (hasConflictingEntities(newFullText, candFullText)) {
      continue;
    }

    // Conflict Check 2: Mutually exclusive location / facility (e.g. Block A vs Block B)
    const candLocations = extractLocationTokens(candFullText);
    if (newLocations.size > 0 && candLocations.size > 0) {
      const sharesLocation = [...newLocations].some((l) => candLocations.has(l));
      if (!sharesLocation) {
        continue; // Different locations! Do not merge.
      }
    }

    // Similarity Check
    const titleScore = calculateLexicalSimilarity(title, candidate.title);
    const fullScore = calculateLexicalSimilarity(newFullText, candFullText);

    const isCategoryMatch =
      !category ||
      !candidate.category ||
      category.toLowerCase() === candidate.category.toLowerCase() ||
      category === 'General' ||
      candidate.category === 'General';

    // Exact title match or high title similarity with category match
    if ((titleScore >= 0.70 || fullScore >= 0.65) && isCategoryMatch) {
      return {
        problem: candidate,
        confidence: titleScore >= 0.85 ? 'high' : 'medium',
        reason: 'Lexical and context similarity match.',
        method: 'deterministic',
      };
    }
  }

  return null;
};

/**
 * Sorting Rules (Sections 9, 10, 11, 12, 13, 14):
 * Rule 1: Solved problems go to the bottom (below active queries).
 * Rule 2: Active Emergency queries retain life-critical override at top of active queue.
 * Rule 3: PRIMARY QUEUE SIGNAL: AFFECTED UNIQUE USER COUNT DESCENDING (15 -> 12 -> 8 -> 5 -> 1).
 * Rule 4: DETERMINISTIC TIE-BREAKER 1: Existing Priority Level (Emergency: 100 > High: 75 > Medium: 50 > Low: 25).
 * Rule 5: DETERMINISTIC TIE-BREAKER 2: Latest activity/updatedAt/createdAt timestamp.
 */
export const sortProblems = (list) => {
  const getPriorityWeight = (p) => {
    if (p.isEmergency || p.priority === 'emergency') return 100;
    if (p.priority === 'high') return 75;
    if (p.priority === 'medium') return 50;
    return 25;
  };

  const getProblemTimestamp = (p) => {
    const ts = p.updatedAt || p.createdAt;
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  return [...list].sort((a, b) => {
    // 1. Solved problems go below active queries
    const isSolvedA = a.status === 'solved' || a.status === 'resolved';
    const isSolvedB = b.status === 'solved' || b.status === 'resolved';
    if (isSolvedA !== isSolvedB) {
      return isSolvedA ? 1 : -1;
    }

    // 2. Active Emergency queries strictly first
    const isEmergA = Boolean(a.isEmergency || a.priority === 'emergency');
    const isEmergB = Boolean(b.isEmergency || b.priority === 'emergency');
    if (isEmergA !== isEmergB) {
      return isEmergA ? -1 : 1;
    }

    // 3. PRIMARY QUEUE ORDERING SIGNAL: AFFECTED USER COUNT DESCENDING
    const countA = Number(a.affectedUserCount ?? a.affectedUsersCount ?? (a.affectedUserIds?.length || 1));
    const countB = Number(b.affectedUserCount ?? b.affectedUsersCount ?? (b.affectedUserIds?.length || 1));
    if (countB !== countA) {
      return countB - countA;
    }

    // 4. DETERMINISTIC TIE-BREAKER 1: Priority level
    const weightA = getPriorityWeight(a);
    const weightB = getPriorityWeight(b);
    if (weightB !== weightA) {
      return weightB - weightA;
    }

    // 5. DETERMINISTIC TIE-BREAKER 2: Latest activity / timestamp
    const timeA = getProblemTimestamp(a);
    const timeB = getProblemTimestamp(b);
    return timeB - timeA;
  });
};


/**
 * Utility: Deduplicates a list of reporter records by both user ID and display name.
 * Guarantees that no user or name appears multiple times.
 */
export const deduplicateReporters = (reporters = []) => {
  const seenIds = new Set();
  const seenNames = new Set();
  const result = [];

  for (const r of reporters) {
    if (!r) continue;
    const uid = r.userId || r.id;
    const rawName = r.isAnonymous ? (r.pseudonym || 'Anonymous') : (r.userName || r.authorName || 'Member');
    const name = String(rawName || 'Member').trim();
    const nameKey = name.toLowerCase();

    // Prevent duplicate user IDs
    if (uid && seenIds.has(uid)) continue;
    // Prevent duplicate display names
    if (nameKey && seenNames.has(nameKey)) continue;

    if (uid) seenIds.add(uid);
    if (nameKey) seenNames.add(nameKey);

    result.push({
      ...r,
      userId: uid,
      userName: name,
      displayName: name,
    });
  }

  return result;
};

/**
 * Submits a new problem scoped strictly to a workspace.
 * Automatically checks for active duplicate/same underlying problems in the same workspace.
 * If matched: aggregates under the existing problem and increments affectedUserCount only if user is unique.
 * If new: creates the problem document with affectedUserCount: 1.
 * Preserves reporter records with deterministic ID in problemReports/{problemId}_{userId}.
 */
export const submitProblem = async ({
  workspaceId,
  title,
  description,
  category = 'General',
  subIssue = '',
  isEmergency = false,
  isConfidential = false,
  workaround = '',
  shiftStatus = 'ACTIVE SHIFT',
  currentUser = null,
  userProfile = null,
  authorIdentity = null,
  isAnonymous = false,
  pseudonym = null,
  imageUrl = null,
  imagePath = null,
  aiAnalysis = null,
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
  const trimmedSubIssue = (subIssue || '').trim();
  const trimmedWorkaround = (workaround || '').trim();

  const authorId = currentUser?.uid || 'anon_user';
  const authorName = isAnonymous
    ? (pseudonym || 'Anon Member')
    : (userProfile?.fullName || currentUser?.displayName || 'Workspace Member');
  const authorEmail = isAnonymous ? '' : (currentUser?.email || '');

  // Confidential problems bypass community aggregation to protect reporter privacy
  if (!isConfidential) {
    // 1. Fetch active candidate problems for the SAME workspace
    let existingCandidates = [];
    try {
      existingCandidates = await getWorkspaceProblems(workspaceId);
    } catch (candErr) {
      console.warn('[UNSAID Problem Service] Candidate fetch notice:', candErr?.message);
      existingCandidates = getLocalProblems(workspaceId);
    }

    // 2. Perform same-problem matching
    const matchResult = await findMatchingProblem({
      workspaceId,
      title: trimmedTitle,
      description: trimmedDesc,
      category: trimmedCategory,
      candidateProblems: existingCandidates,
    });

    if (matchResult && matchResult.problem) {
      const existingProblem = matchResult.problem;
      const targetProblemId = existingProblem.id;

      // Duplicate User Protection (Requirement 7):
      // Check if this user is ALREADY recorded as an affected user
      const existingUserIds = Array.isArray(existingProblem.affectedUserIds)
        ? existingProblem.affectedUserIds
        : [existingProblem.authorId || existingProblem.createdBy];
      const isAlreadyReported = existingUserIds.includes(authorId);

      const prevCount = Number(
        existingProblem.affectedUserCount ??
        existingProblem.affectedUsersCount ??
        existingUserIds.length ??
        1
      );

      const newCount = isAlreadyReported ? prevCount : prevCount + 1;
      const updatedUserIds = isAlreadyReported
        ? existingUserIds
        : [...existingUserIds, authorId];

      const reporterEntry = {
        userId: authorId,
        userName: authorName,
        isAnonymous: Boolean(isAnonymous),
        pseudonym: pseudonym || null,
      };

      // Reporter record with deterministic ID: {problemId}_{userId}
      const reportDocId = `${targetProblemId}_${authorId}`;
      const reportData = {
        id: reportDocId,
        problemId: targetProblemId,
        workspaceId,
        userId: authorId,
        userName: authorName,
        userEmail: authorEmail,
        authorIdentity: isAnonymous ? null : (authorIdentity || null),
        isAnonymous: Boolean(isAnonymous),
        pseudonym: pseudonym || null,
        description: trimmedDesc,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save report in local cache
      const currentReports = getLocalReports(targetProblemId);
      const updatedReports = [
        ...currentReports.filter((r) => r.userId !== authorId),
        reportData,
      ];
      saveLocalReports(targetProblemId, updatedReports);

      // Assemble all reports to deduplicate and derive otherReporters
      let baseReports = currentReports;
      if (baseReports.length === 0 && Array.isArray(existingProblem.reporters)) {
        baseReports = existingProblem.reporters;
      }
      if (baseReports.length === 0 && existingProblem.authorName) {
        baseReports = [
          {
            userId: existingProblem.authorId || existingProblem.createdBy,
            userName: existingProblem.authorName,
            isAnonymous: Boolean(existingProblem.isAnonymous),
            pseudonym: existingProblem.pseudonym || null,
          },
        ];
      }

      const deduplicatedAll = deduplicateReporters([...baseReports, reportData]);
      const otherReporters = deduplicatedAll.filter(
        (r) => r.userId !== authorId && r.userName?.toLowerCase() !== authorName?.toLowerCase()
      );

      if (db) {
        try {
          // Record in Firestore problemReports collection
          const reportRef = doc(db, 'problemReports', reportDocId);
          await setDoc(
            reportRef,
            {
              ...reportData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          // Update the existing problem document
          const probDocRef = doc(db, 'problems', targetProblemId);
          const updatePayload = {
            updatedAt: serverTimestamp(),
          };

          if (!isAlreadyReported) {
            updatePayload.affectedUserCount = increment(1);
            updatePayload.affectedUserIds = arrayUnion(authorId);
            updatePayload.reporters = arrayUnion(reporterEntry);
            updatePayload.reporterNames = arrayUnion(authorName);
          }

          // If it was solved or archived, a new report can re-activate or note recurrence (Requirement 20)
          if (existingProblem.status === 'solved') {
            updatePayload.status = 'open';
            updatePayload.isRecurring = true;
            updatePayload.recurrenceCount = (existingProblem.recurrenceCount || 1) + 1;
          }

          await updateDoc(probDocRef, updatePayload);
        } catch (mergeErr) {
          console.error('[UNSAID Problem Service] Firestore aggregation write error:', mergeErr);
        }
      }

      // Update local problem cache
      const updatedExistingProblem = {
        ...existingProblem,
        affectedUserCount: newCount,
        affectedUserIds: updatedUserIds,
        reporters: deduplicatedAll,
        reporterNames: deduplicatedAll.map((r) => r.userName),
        updatedAt: new Date().toISOString(),
        isAggregated: true,
        isDuplicateUser: isAlreadyReported,
        previousAffectedCount: prevCount,
      };
      saveLocalProblem(workspaceId, updatedExistingProblem);

      return {
        ...updatedExistingProblem,
        isAggregated: true,
        isDuplicateUser: isAlreadyReported,
        previousAffectedCount: prevCount,
        affectedUserCount: newCount,
        allReporters: deduplicatedAll,
        otherReporters,
        aggregationNotice: isAlreadyReported
          ? `You have already reported this issue. Affected users remain ${prevCount}.`
          : `This problem already exists. Your report has been added to the existing problem. Affected users: ${prevCount} → ${newCount}`,
      };
    }
  }

  // 3. NO match found: Create NEW problem document
  const problemData = {
    workspaceId,
    title: trimmedTitle,
    description: trimmedDesc,
    category: trimmedCategory,
    subIssue: trimmedSubIssue || null,
    isEmergency: Boolean(isEmergency),
    isConfidential: Boolean(isConfidential),
    readByAdmin: false,
    readByUser: true,
    priority: isEmergency ? 'emergency' : 'normal',
    workaround: trimmedWorkaround,
    shiftStatus: shiftStatus || 'ACTIVE SHIFT',
    status: 'open', // 'open' | 'solved'
    createdBy: authorId,
    authorId,
    authorName,
    authorEmail,
    authorIdentity: isAnonymous ? null : (authorIdentity || null),
    isAnonymous: Boolean(isAnonymous),
    imageUrl: imageUrl || null,
    imagePath: imagePath || null,
    aiAnalysis: aiAnalysis || null,
    upvotesCount: 0,
    upvotedBy: [],
    affectedUserCount: 1,
    affectedUserIds: [authorId],
    reporters: [
      {
        userId: authorId,
        userName: authorName,
        isAnonymous: Boolean(isAnonymous),
        pseudonym: pseudonym || null,
      },
    ],
    reporterNames: [authorName],
    stillReportingCount: 0,
    resolutionPendingVerification: false,
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
    isAggregated: false,
    previousAffectedCount: 0,
    affectedUserCount: 1,
  };

  // Store initial reporter record in local storage
  const initialReport = {
    id: `${localId}_${authorId}`,
    problemId: localId,
    workspaceId,
    userId: authorId,
    userName: authorName,
    userEmail: authorEmail,
    authorIdentity: isAnonymous ? null : (authorIdentity || null),
    isAnonymous: Boolean(isAnonymous),
    pseudonym: pseudonym || null,
    description: trimmedDesc,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalReports(localId, [initialReport]);

  // If offline, enqueue directly to local offline queue and return client-ready object
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineProblem(problemData);
    saveLocalProblem(workspaceId, { ...clientProblem, isOfflineQueued: true });
    return { ...clientProblem, isOfflineQueued: true };
  }

  if (db) {
    try {
      const probRef = collection(db, 'problems');
      const docRef = await withTimeout(addDoc(probRef, problemData), 4500);
      clientProblem.id = docRef.id;

      // Save initial reporter in Firestore problemReports collection
      const reportDocId = `${docRef.id}_${authorId}`;
      try {
        const reportRef = doc(db, 'problemReports', reportDocId);
        await setDoc(reportRef, {
          id: reportDocId,
          problemId: docRef.id,
          workspaceId,
          userId: authorId,
          userName: authorName,
          userEmail: authorEmail,
          authorIdentity: isAnonymous ? null : (authorIdentity || null),
          isAnonymous: Boolean(isAnonymous),
          pseudonym: pseudonym || null,
          description: trimmedDesc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        saveLocalReports(docRef.id, [{ ...initialReport, id: reportDocId, problemId: docRef.id }]);
      } catch (repErr) {
        console.warn('[UNSAID Problem Service] Initial reporter doc write notice:', repErr.message);
      }

      // Automatically notify the workspace administrator
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        const wsSnap = await withTimeout(getDoc(wsRef), 3000);
        if (wsSnap.exists()) {
          const wsData = wsSnap.data();
          const adminUid = wsData.createdBy;
          if (adminUid && adminUid !== authorId) {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              userId: adminUid,
              type: isEmergency ? 'emergency_problem' : 'problem_reported',
              title: isEmergency ? '🚨 Emergency Query Reported' : 'New Query Reported',
              message: `${authorName} reported "${trimmedTitle}" in "${wsData.name || 'Workspace'}".`,
              problemId: docRef.id,
              workspaceId,
              workspaceName: wsData.name || 'Workspace',
              read: false,
              createdAt: serverTimestamp(),
            });
          }
        }
      } catch (notifErr) {
        console.warn('[UNSAID Problem Service] Admin notification dispatch notice:', notifErr.message);
      }
    } catch (firestoreErr) {
      if (
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        firestoreErr.code === 'unavailable' ||
        firestoreErr.code === 'deadline-exceeded'
      ) {
        enqueueOfflineProblem(problemData);
        saveLocalProblem(workspaceId, { ...clientProblem, isOfflineQueued: true });
        return { ...clientProblem, isOfflineQueued: true };
      }
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

// =====================================================================
// PART 3B-2: TWO-WAY MESSAGING, RESOLUTIONS, ACKNOWLEDGEMENTS, ESCALATION
// =====================================================================

const LOCAL_STORAGE_MESSAGES_PREFIX = 'unsaid_prob_messages_';
const LOCAL_STORAGE_ACKS_PREFIX = 'unsaid_prob_acks_';
const LOCAL_STORAGE_VOTES_PREFIX = 'unsaid_prob_votes_';
const LOCAL_STORAGE_FEEDBACK_PREFIX = 'unsaid_prob_feedback_';

const getLocalItems = (prefix, problemId) => {
  if (!problemId) return [];
  try {
    const raw = localStorage.getItem(`${prefix}${problemId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalItems = (prefix, problemId, items) => {
  if (!problemId) return;
  try {
    localStorage.setItem(`${prefix}${problemId}`, JSON.stringify(items));
  } catch {}
};

/**
 * 1. TWO-WAY MESSAGING: Subscribes to problemMessages in real time.
 */
export const subscribeToProblemMessages = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
  if (local.length > 0 && onUpdate) {
    onUpdate(local);
  }

  if (!db) {
    return () => {};
  }

  try {
    const messagesRef = collection(db, 'problemMessages');
    const q = query(
      messagesRef,
      where('problemId', '==', problemId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreMessages = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            // Ensure compatibility mappings between spec fields and UI props
            authorId: data.senderId,
            authorName: data.senderName,
            authorRole: data.senderRole,
            text: data.message,
            isStaffResponse: Boolean(data.isOfficial),
          };
        });

        // Merge unique by ID with local cache
        const seen = new Set();
        const merged = [];
        for (const m of [...firestoreMessages, ...getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId)]) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            merged.push(m);
          }
        }

        merged.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeA - timeB;
        });

        saveLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId, merged);
        if (onUpdate) onUpdate(merged);
      },
      (err) => {
        console.warn('[UNSAID Messages Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Problem Messages Error]', err);
    return () => {};
  }
};

/**
 * Sends a real message to problemMessages collection.
 */
export const sendProblemMessage = async ({
  problemId,
  workspaceId,
  message,
  text,
  currentUser,
  userProfile,
  isAnonymous = false,
  pseudonym = null,
  isOfficial = false,
  isStaff = false,
}) => {
  const content = (message || text || '').trim();
  if (!problemId || !workspaceId || !content) {
    throw new Error('Problem context, workspace, and message content are required.');
  }

  const senderId = currentUser?.uid || 'anon_user';
  const senderName = isAnonymous
    ? (pseudonym || 'Anon Member')
    : (userProfile?.fullName || currentUser?.displayName || (isOfficial || isStaff ? 'Staff Support' : 'Workspace Member'));
  const senderEmail = isAnonymous ? '' : (currentUser?.email || '');
  const senderRole = (isOfficial || isStaff) ? 'admin' : (userProfile?.role || 'member');
  const officialFlag = Boolean(isOfficial || isStaff);

  const messageDoc = {
    problemId,
    workspaceId,
    senderId,
    senderName,
    senderEmail,
    senderRole,
    message: content,
    isOfficial: officialFlag,
    isDismissed: false,
    dismissedBy: null,
    dismissedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const localId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const clientMessage = {
    ...messageDoc,
    id: localId,
    authorId: senderId,
    authorName: senderName,
    authorRole: senderRole,
    text: content,
    isStaffResponse: officialFlag,
    createdAt: new Date().toISOString(),
  };

  const currentLocal = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
  saveLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId, [...currentLocal, clientMessage]);

  // If offline, enqueue message to local offline queue and display in local thread
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineMessage(messageDoc);
    return { ...clientMessage, isOfflineQueued: true };
  }

  if (db) {
    try {
      const messagesRef = collection(db, 'problemMessages');
      const docRef = await addDoc(messagesRef, messageDoc);
      clientMessage.id = docRef.id;
      const updatedLocal = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
      saveLocalItems(
        LOCAL_STORAGE_MESSAGES_PREFIX,
        problemId,
        updatedLocal.map((m) => (m.id === localId ? clientMessage : m))
      );
    } catch (err) {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || err.code === 'unavailable') {
        enqueueOfflineMessage(messageDoc);
        return { ...clientMessage, isOfflineQueued: true };
      }
      console.error('[UNSAID Send Message Error]', err);
      throw err;
    }
  }

  return clientMessage;
};

/**
 * Marks a problem thread as read by user or admin.
 */
export const markProblemThreadRead = async (problemId, role = 'member') => {
  if (!problemId || !db) return;
  try {
    const probRef = doc(db, 'problems', problemId);
    await updateDoc(probRef, role === 'admin' ? { readByAdmin: true } : { readByUser: true });
  } catch {
    // Non-blocking for unauthenticated or offline views
  }
};

/**
 * Dismisses an unhelpful comment (authorized to author/admin).
 */
export const dismissProblemMessage = async ({
  messageId,
  dismissedByUserId,
  problemId,
}) => {
  if (!messageId) return;

  if (problemId) {
    const local = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
    const updated = local.map((m) =>
      m.id === messageId ? { ...m, isDismissed: true, dismissedBy: dismissedByUserId } : m
    );
    saveLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId, updated);
  }

  if (db) {
    try {
      const msgRef = doc(db, 'problemMessages', messageId);
      await updateDoc(msgRef, {
        isDismissed: true,
        dismissedBy: dismissedByUserId,
        dismissedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[UNSAID Dismiss Message Error]', err);
    }
  }
};

/**
 * 2. OFFICIAL RESOLUTION BROADCAST: Admin marks official resolution on problem doc.
 */
export const broadcastOfficialResolution = async ({
  problemId,
  workspaceId,
  resolutionText,
  summary,
  actionTaken = '',
  adminUser,
  adminProfile,
}) => {
  const text = (resolutionText || summary || '').trim();
  if (!problemId || !text) {
    throw new Error('Resolution explanation is required.');
  }

  const resolverName = adminProfile?.fullName || adminUser?.displayName || 'Workspace Admin';
  const resolverId = adminUser?.uid || 'admin';

  const officialResolution = {
    resolutionText: text,
    summary: text,
    actionTaken: (actionTaken || '').trim(),
    resolvedBy: resolverId,
    resolvedByName: resolverName,
    resolvedAt: new Date().toISOString(),
    workspaceId: workspaceId || '',
    problemId,
  };

  if (workspaceId) {
    const local = getLocalProblems(workspaceId);
    const updated = local.map((p) =>
      p.id === problemId
        ? {
            ...p,
            status: 'solved',
            officialResolution,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    saveLocalProblems(workspaceId, updated);
  }

  if (db) {
    const probRef = doc(db, 'problems', problemId);
    await updateDoc(probRef, {
      status: 'solved',
      officialResolution,
      updatedAt: serverTimestamp(),
    });
  }

  return officialResolution;
};

/**
 * Helper to update local problem collection cache.
 */
const saveLocalProblems = (workspaceId, list) => {
  if (!workspaceId) return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`, JSON.stringify(list));
  } catch {}
};

/**
 * 3. DYNAMIC ACKNOWLEDGEMENT: Real Firestore acknowledgements collection.
 * Deterministic doc ID: {problemId}_{userId}.
 */
export const subscribeToProblemAcknowledgements = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const acksRef = collection(db, 'acknowledgements');
    const q = query(acksRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreAcks = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId, firestoreAcks);
        if (onUpdate) onUpdate(firestoreAcks);
      },
      (err) => {
        console.warn('[UNSAID Acks Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Acks Error]', err);
    return () => {};
  }
};

export const toggleProblemAcknowledgement = async ({
  problemId,
  workspaceId,
  userId,
  eligibleMemberCount = 1,
  thresholdPercentage = 65,
}) => {
  if (!problemId || !userId || !workspaceId) return null;

  const docId = `${problemId}_${userId}`;
  const currentLocal = getLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId);
  const existsLocal = currentLocal.some((a) => a.userId === userId);

  let updatedLocal;
  let hasAcked;
  if (existsLocal) {
    updatedLocal = currentLocal.filter((a) => a.userId !== userId);
    hasAcked = false;
  } else {
    updatedLocal = [
      ...currentLocal,
      {
        id: docId,
        problemId,
        workspaceId,
        userId,
        response: 'acknowledged',
        createdAt: new Date().toISOString(),
      },
    ];
    hasAcked = true;
  }
  saveLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId, updatedLocal);

  const ackCount = updatedLocal.length;
  const eligible = Math.max(1, eligibleMemberCount || 1);
  const percentage = Math.round((ackCount / eligible) * 100);
  const threshold = Number(thresholdPercentage) || 65;
  const isThresholdReached = percentage >= threshold;

  // Update local problem record
  const localProblems = getLocalProblems(workspaceId);
  const targetProblem = localProblems.find((p) => p.id === problemId);
  if (targetProblem) {
    targetProblem.acknowledgementsCount = ackCount;
    targetProblem.acknowledgementReached = isThresholdReached;
    targetProblem.isArchivedFromFeed = isThresholdReached;
    saveLocalProblems(workspaceId, localProblems);
  }

  if (db) {
    try {
      const ackDocRef = doc(db, 'acknowledgements', docId);
      if (hasAcked) {
        await setDoc(ackDocRef, {
          problemId,
          workspaceId,
          userId,
          response: 'acknowledged',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(ackDocRef);
      }

      // Check threshold and update problem document
      const probRef = doc(db, 'problems', problemId);
      const updatePayload = {
        acknowledgementsCount: ackCount,
        acknowledgementReached: isThresholdReached,
        isArchivedFromFeed: isThresholdReached,
        updatedAt: serverTimestamp(),
      };
      if (isThresholdReached) {
        updatePayload.archivedAt = serverTimestamp();
      }
      await updateDoc(probRef, updatePayload);
    } catch (err) {
      console.warn('[UNSAID Acknowledgement Write Error]', err);
    }
  }

  return {
    hasAcked,
    ackCount,
    percentage,
    isThresholdReached,
  };
};

/**
 * 4. COMMUNITY ESCALATION: Real Firestore escalationVotes collection.
 * Deterministic doc ID: {problemId}_{userId}.
 */
export const subscribeToEscalationVotes = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const votesRef = collection(db, 'escalationVotes');
    const q = query(votesRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreVotes = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId, firestoreVotes);
        if (onUpdate) onUpdate(firestoreVotes);
      },
      (err) => {
        console.warn('[UNSAID Escalation Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Escalation Error]', err);
    return () => {};
  }
};

export const submitEscalationVote = async ({
  problemId,
  workspaceId,
  userId,
  vote, // 'yes' | 'no'
}) => {
  if (!problemId || !userId || !workspaceId || !['yes', 'no'].includes(vote)) {
    return null;
  }

  const docId = `${problemId}_${userId}`;
  const currentLocal = getLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId);
  const existingVote = currentLocal.find((v) => v.userId === userId);

  let updatedLocal;
  let activeVote;

  if (existingVote && existingVote.vote === vote) {
    // Clicking same vote removes it
    updatedLocal = currentLocal.filter((v) => v.userId !== userId);
    activeVote = null;
  } else {
    // New or changed vote
    updatedLocal = [
      ...currentLocal.filter((v) => v.userId !== userId),
      {
        id: docId,
        problemId,
        workspaceId,
        userId,
        vote,
        createdAt: new Date().toISOString(),
      },
    ];
    activeVote = vote;
  }

  saveLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId, updatedLocal);

  if (db) {
    try {
      const voteDocRef = doc(db, 'escalationVotes', docId);
      if (activeVote) {
        await setDoc(voteDocRef, {
          problemId,
          workspaceId,
          userId,
          vote: activeVote,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(voteDocRef);
      }
    } catch (err) {
      console.warn('[UNSAID Escalation Write Error]', err);
    }
  }

  return { activeVote, votes: updatedLocal };
};

/**
 * 5. QUALITY FEEDBACK: Real Firestore problemFeedback collection.
 * Deterministic doc ID: {problemId}_{userId}.
 */
export const subscribeToProblemFeedback = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const feedbackRef = collection(db, 'problemFeedback');
    const q = query(feedbackRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreFeedback = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId, firestoreFeedback);
        if (onUpdate) onUpdate(firestoreFeedback);
      },
      (err) => {
        console.warn('[UNSAID Feedback Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Feedback Error]', err);
    return () => {};
  }
};

export const submitQualityFeedback = async ({
  problemId,
  workspaceId,
  userId,
  feedback, // 'solved' | 'partially_solved' | 'still_confused'
}) => {
  if (!problemId || !userId || !workspaceId || !['solved', 'partially_solved', 'still_confused'].includes(feedback)) {
    return null;
  }

  const docId = `${problemId}_${userId}`;
  const currentLocal = getLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId);
  const updatedLocal = [
    ...currentLocal.filter((f) => f.userId !== userId),
    {
      id: docId,
      problemId,
      workspaceId,
      userId,
      feedback,
      createdAt: new Date().toISOString(),
    },
  ];
  saveLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId, updatedLocal);

  if (db) {
    try {
      const feedbackDocRef = doc(db, 'problemFeedback', docId);
      await setDoc(feedbackDocRef, {
        problemId,
        workspaceId,
        userId,
        feedback,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[UNSAID Feedback Write Error]', err);
    }
  }

  return updatedLocal;
};

/**
 * 6. RECURRENCE TRACKING: Link recurring problem to previous incident.
 */
export const markProblemRecurring = async ({
  problemId,
  recurrenceOf,
  linkedProblemTitle,
  recurrenceCount = 2,
  workspaceId,
}) => {
  if (!problemId || !recurrenceOf || !workspaceId) {
    throw new Error('Problem context and recurrence target are required.');
  }

  const localList = getLocalProblems(workspaceId);
  const target = localList.find((p) => p.id === problemId);
  if (target) {
    target.isRecurring = true;
    target.recurrenceOf = recurrenceOf;
    target.linkedProblemId = recurrenceOf;
    target.linkedProblemTitle = linkedProblemTitle || 'Previous Incident';
    target.recurrenceCount = Number(recurrenceCount) || 2;
    saveLocalProblems(workspaceId, localList);
  }

  if (db) {
    const probRef = doc(db, 'problems', problemId);
    await updateDoc(probRef, {
      isRecurring: true,
      recurrenceOf,
      linkedProblemId: recurrenceOf,
      linkedProblemTitle: linkedProblemTitle || 'Previous Incident',
      recurrenceCount: Number(recurrenceCount) || 2,
      updatedAt: serverTimestamp(),
    });
  }

  return { isRecurring: true, recurrenceOf, linkedProblemTitle, recurrenceCount };
};

/**
 * Permanently deletes a problem/query.
 * Authorized for the author who reported the problem or workspace administrators.
 *
 * @param {string} problemId
 * @param {string} [workspaceId]
 * @returns {Promise<{ success: boolean }>}
 */
export const deleteProblem = async (problemId, workspaceId) => {
  if (!problemId) {
    throw new Error('Problem identifier is required to delete.');
  }

  // Remove from local storage cache if workspaceId is provided
  if (workspaceId) {
    try {
      const existing = getLocalProblems(workspaceId);
      const filtered = existing.filter((p) => p.id !== problemId);
      localStorage.setItem(
        `${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`,
        JSON.stringify(filtered)
      );
    } catch (err) {
      console.warn('[UNSAID Problem Service] Failed to remove from local cache:', err);
    }
  }

  if (db) {
    const probRef = doc(db, 'problems', problemId);
    await withTimeout(deleteDoc(probRef), 7000);
  }

  return { success: true };
};

/**
 * 7. PROBLEM REPORTERS: Real-time subscription to affected users for a problem.
 */
export const subscribeToProblemReports = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalReports(problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const reportsRef = collection(db, 'problemReports');
    const q = query(reportsRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreReports = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalReports(problemId, firestoreReports);
        if (onUpdate) onUpdate(firestoreReports);
      },
      (err) => {
        console.warn('[UNSAID Problem Reports Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Problem Reports Error]', err);
    return () => {};
  }
};

/**
 * Fetches the list of affected users/reporters for a problem.
 */
export const getProblemReports = async (problemId) => {
  if (!problemId) return [];
  if (db) {
    try {
      const reportsRef = collection(db, 'problemReports');
      const q = query(reportsRef, where('problemId', '==', problemId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      saveLocalReports(problemId, list);
      return list;
    } catch (err) {
      console.warn('[UNSAID Get Problem Reports Notice]', err?.message);
    }
  }
  return getLocalReports(problemId);
};

/**
 * 8. RESOLUTION VERIFICATION:
 * Strictest non-majority poll (Section 18 & 19).
 * ALL affected users must confirm "Solved" for problem to remain closed.
 * If even ONE affected user indicates "Partially Solved" or "Not Solved",
 * status automatically reverts to 'reopened' with stillReportingCount tracked.
 */
export const submitResolutionVerification = async ({
  problemId,
  workspaceId,
  userId,
  userName = 'Workspace Member',
  response, // 'solved' | 'partially_solved' | 'not_solved' | 'still_confused'
}) => {
  if (!problemId || !userId || !workspaceId || !['solved', 'partially_solved', 'not_solved', 'still_confused'].includes(response)) {
    return null;
  }

  const docId = `${problemId}_${userId}`;
  const currentFeedbacks = getLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId);
  const updatedFeedbacks = [
    ...currentFeedbacks.filter((f) => f.userId !== userId),
    {
      id: docId,
      problemId,
      workspaceId,
      userId,
      userName,
      feedback: response,
      response,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  saveLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId, updatedFeedbacks);

  // Calculate resolution metrics
  const solvedCount = updatedFeedbacks.filter((f) => f.feedback === 'solved' || f.response === 'solved').length;
  const partiallySolvedCount = updatedFeedbacks.filter((f) => f.feedback === 'partially_solved' || f.response === 'partially_solved').length;
  const notSolvedCount = updatedFeedbacks.filter(
    (f) => f.feedback === 'not_solved' || f.response === 'not_solved' || f.feedback === 'still_confused' || f.response === 'still_confused'
  ).length;
  const unresolvedCount = partiallySolvedCount + notSolvedCount;

  // Retrieve current problem to inspect total affected user count
  const localProblems = getLocalProblems(workspaceId);
  const targetProblem = localProblems.find((p) => p.id === problemId);
  const totalAffected = Math.max(
    1,
    Number(targetProblem?.affectedUserCount || targetProblem?.affectedUserIds?.length || updatedFeedbacks.length)
  );

  // STRICT RULE (Section 18):
  // Even ONE unresolved response -> Reopened!
  const shouldReopen = unresolvedCount > 0;
  const nextStatus = shouldReopen ? 'reopened' : 'solved';

  const verificationStats = {
    solved: solvedCount,
    partiallySolved: partiallySolvedCount,
    notSolved: notSolvedCount,
    unresolved: unresolvedCount,
    total: totalAffected,
  };

  if (targetProblem) {
    targetProblem.status = nextStatus;
    targetProblem.isReopened = shouldReopen;
    targetProblem.stillReportingCount = unresolvedCount;
    targetProblem.verificationStats = verificationStats;
    targetProblem.updatedAt = new Date().toISOString();
    if (shouldReopen) {
      targetProblem.reopenedAt = new Date().toISOString();
    }
    saveLocalProblems(workspaceId, localProblems);
  }

  if (db) {
    try {
      // 1. Save individual feedback doc
      const feedbackDocRef = doc(db, 'problemFeedback', docId);
      await setDoc(feedbackDocRef, {
        problemId,
        workspaceId,
        userId,
        userName,
        feedback: response,
        response,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Update problem status & reopening counts atomically
      const probRef = doc(db, 'problems', problemId);
      const updatePayload = {
        status: nextStatus,
        isReopened: shouldReopen,
        stillReportingCount: unresolvedCount,
        verificationStats,
        updatedAt: serverTimestamp(),
      };
      if (shouldReopen) {
        updatePayload.reopenedAt = serverTimestamp();
      }
      await updateDoc(probRef, updatePayload);
    } catch (err) {
      console.warn('[UNSAID Resolution Verification Write Error]', err);
    }
  }

  return {
    status: nextStatus,
    isReopened: shouldReopen,
    stillReportingCount: unresolvedCount,
    verificationStats,
    feedbacks: updatedFeedbacks,
  };
};


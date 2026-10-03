import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_INVITE_EXPIRY_DAYS } from '../config/appConfig';
import { generateSecureToken } from '../utils/security';
import { WorkspaceContext } from './workspaceContextDef';

const ACTIVE_WORKSPACE_KEY = 'unsaid-active-workspace-id';
const WORKSPACES_CACHE_KEY = 'unsaid-cached-workspaces';

// Helper to ensure network calls never hang indefinitely
const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error('Firestore operation timed out');
        err.code = 'deadline-exceeded';
        reject(err);
      }, ms);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);

export const WorkspaceProvider = ({ children }) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const cached = localStorage.getItem(WORKSPACES_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [currentWorkspace, setCurrentWorkspace] = useState(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      const cached = localStorage.getItem(WORKSPACES_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        return list.find((w) => w.id === savedId) || list[0] || null;
      }
    } catch {}
    return null;
  });
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentUserId = currentUser?.uid;
  const workspacesLengthRef = React.useRef(workspaces.length);
  useEffect(() => {
    workspacesLengthRef.current = workspaces.length;
  }, [workspaces.length]);

  // Load authorized workspaces for current user
  const loadWorkspaces = useCallback(async () => {
    if (!currentUserId) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setMemberships([]);
      return;
    }

    if (!db) return;

    if (workspacesLengthRef.current === 0) {
      setLoading(true);
    }

    try {
      if (isAdmin) {
        // Admins can manage and view all active workspaces in the organization
        const wsRef = collection(db, 'workspaces');
        const q = query(wsRef, where('status', '==', 'active'));
        const snap = await withTimeout(getDocs(q), 2500);
        const wsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (wsList.length > 0) {
          setWorkspaces(wsList);
          try {
            localStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify(wsList));
          } catch {}

          const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
          setCurrentWorkspace((prev) => {
            const desiredId = savedId || prev?.id;
            const matched = wsList.find((w) => w.id === desiredId);
            if (matched) return matched;
            if (prev && wsList.some((w) => w.id === prev.id)) return prev;
            return wsList[0] || null;
          });
        }

        // Fetch admin memberships with timeout
        const memRef = collection(db, 'workspaceMembers');
        const memQ = query(memRef, where('userId', '==', currentUserId));
        try {
          const memSnap = await withTimeout(getDocs(memQ), 2000);
          const memList = memSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMemberships(memList);
        } catch {}
      } else {
        // Regular users: Fetch all workspaces they are approved members of or created
        const memRef = collection(db, 'workspaceMembers');
        const memQ = query(memRef, where('userId', '==', currentUserId));
        const memSnap = await withTimeout(getDocs(memQ), 6000);
        const allMemList = memSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Include active/approved memberships (excluding revoked/inactive)
        const memList = allMemList.filter((m) => m.status !== 'revoked' && m.status !== 'inactive');
        setMemberships(memList);

        // Also check if user created any active workspace directly
        let createdWorkspaces = [];
        try {
          const wsRef = collection(db, 'workspaces');
          const createdQ = query(wsRef, where('createdBy', '==', currentUserId));
          const createdSnap = await withTimeout(getDocs(createdQ), 4000);
          createdWorkspaces = createdSnap.docs.map((d) => ({ id: d.id, ...d.data(), userRole: 'admin' }));
        } catch {}

        let memberWorkspaces = [];
        if (memList.length > 0) {
          const workspacePromises = memList.map(async (m) => {
            if (!m.workspaceId) return null;
            try {
              const wsDocRef = doc(db, 'workspaces', m.workspaceId);
              const wsDoc = await withTimeout(getDoc(wsDocRef), 5000);
              return wsDoc.exists() ? { id: wsDoc.id, ...wsDoc.data(), userRole: m.role || 'member' } : null;
            } catch {
              // Graceful fallback from local cache if network timeout occurred
              try {
                const cached = localStorage.getItem(WORKSPACES_CACHE_KEY);
                if (cached) {
                  const list = JSON.parse(cached);
                  return list.find((w) => w.id === m.workspaceId) || null;
                }
              } catch {}
              return null;
            }
          });

          const results = await Promise.all(workspacePromises);
          memberWorkspaces = results.filter(Boolean);
        }

        // Deduplicate workspaces
        const seenWsIds = new Set();
        const validWorkspaces = [];
        for (const ws of [...createdWorkspaces, ...memberWorkspaces]) {
          if (!seenWsIds.has(ws.id)) {
            seenWsIds.add(ws.id);
            validWorkspaces.push(ws);
          }
        }

        if (validWorkspaces.length > 0) {
          setWorkspaces(validWorkspaces);
          try {
            localStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify(validWorkspaces));
          } catch {}

          const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
          setCurrentWorkspace((prev) => {
            const desiredId = savedId || prev?.id;
            const matched = validWorkspaces.find((w) => w.id === desiredId);
            if (matched) return matched;
            if (prev && validWorkspaces.some((w) => w.id === prev.id)) return prev;
            return validWorkspaces[0] || null;
          });
        }
      }
    } catch (err) {
      console.warn('[UNSAID Workspace] Workspace load deferred (offline/timeout):', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isAdmin]);

  useEffect(() => {
    let ignore = false;
    const fetch = async () => {
      if (!ignore) {
        await loadWorkspaces();
      }
    };
    fetch();
    return () => {
      ignore = true;
    };
  }, [loadWorkspaces]);


  // Switch active workspace with access verification
  const switchWorkspace = (workspaceId) => {
    if (!workspaceId) return false;
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      try {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, target.id);
      } catch {}
      return true;
    }
    if (currentWorkspace && currentWorkspace.id === workspaceId) {
      try {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, currentWorkspace.id);
      } catch {}
      return true;
    }
    console.warn('[UNSAID] Attempted to switch to unapproved workspace:', workspaceId);
    return false;
  };

  // Create workspace (Admin only)
  const createWorkspace = async ({ name, domain, description }) => {
    if (!isAdmin) {
      throw new Error('Only authorized administrators can create new workspaces.');
    }
    if (!currentUser) {
      throw new Error('User is not authenticated.');
    }

    const trimmedName = (name || '').trim();
    const trimmedDomain = (domain || 'college').trim().toLowerCase();
    const trimmedDesc = (description || '').trim();

    if (!trimmedName) {
      throw new Error('Please provide a workspace name.');
    }
    if (!trimmedDomain) {
      throw new Error('Please specify a domain type.');
    }

    // 1. Synchronously generate valid Firestore document reference and ID client-side
    let newWorkspaceId;
    let wsDocRef = null;
    if (db) {
      wsDocRef = doc(collection(db, 'workspaces'));
      newWorkspaceId = wsDocRef.id;
    } else {
      newWorkspaceId = 'ws_' + Math.random().toString(36).substring(2, 10);
    }

    const wsData = {
      name: trimmedName,
      domain: trimmedDomain,
      description: trimmedDesc,
      createdBy: currentUser.uid,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Client-safe record for immediate UI reactivity
    const newWorkspace = {
      id: newWorkspaceId,
      name: trimmedName,
      domain: trimmedDomain,
      description: trimmedDesc,
      createdBy: currentUser.uid,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. Immediately update local workspaces state & persistent cache
    setWorkspaces((prev) => {
      const exists = prev.some((w) => w.id === newWorkspaceId);
      const nextList = exists ? prev : [newWorkspace, ...prev];
      try {
        localStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify(nextList));
      } catch {}
      return nextList;
    });

    // 3. Immediately select newly created workspace as active and persist
    setCurrentWorkspace(newWorkspace);
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, newWorkspaceId);
    } catch {}

    // 4. Update local memberships state
    const memberDocId = `${currentUser.uid}_${newWorkspaceId}`;
    setMemberships((prev) => [
      ...prev.filter((m) => m.workspaceId !== newWorkspaceId),
      {
        id: memberDocId,
        workspaceId: newWorkspaceId,
        userId: currentUser.uid,
        role: 'admin',
        status: 'active',
      },
    ]);

    // 5. Asynchronously persist to Firestore with timeout protection
    if (db && wsDocRef) {
      const memberDocRef = doc(db, 'workspaceMembers', memberDocId);
      const memberData = {
        workspaceId: newWorkspaceId,
        userId: currentUser.uid,
        role: 'admin',
        status: 'active',
        joinedAt: serverTimestamp(),
      };

      const firestoreWrites = Promise.all([
        setDoc(wsDocRef, wsData),
        setDoc(memberDocRef, memberData),
      ]);

      withTimeout(firestoreWrites, 2500).catch((fsErr) => {
        console.warn('[UNSAID Workspace] Firestore write deferred (offline/timeout):', fsErr.message);
      });
    }

    return newWorkspace;
  };



  // Generate Invite Request Link (Admin only)
  const generateInvite = async (params) => {
    if (!currentUser) {
      throw new Error('You must be signed in to generate an invite link.');
    }

    const workspaceId =
      typeof params === 'object' && params !== null
        ? params.workspaceId || params.id
        : params;

    if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
      throw new Error('Select a workspace first. Workspace ID cannot be empty.');
    }

    const cleanWorkspaceId = workspaceId.trim();

    if (!db) {
      throw new Error('Database service unavailable.');
    }

    // 1. Verify workspace document actually exists in Firestore
    const wsDocRef = doc(db, 'workspaces', cleanWorkspaceId);
    let wsSnap;
    try {
      wsSnap = await withTimeout(getDoc(wsDocRef), 10000);
    } catch (fetchErr) {
      console.error('[UNSAID Invite Diagnostic] Failed to verify workspace in Firestore:', {
        workspaceId: cleanWorkspaceId,
        code: fetchErr?.code || 'unknown',
        message: fetchErr?.message || String(fetchErr),
      });
      throw fetchErr;
    }

    if (!wsSnap.exists()) {
      throw new Error(`Workspace ("${cleanWorkspaceId}") does not exist in Firestore.`);
    }

    const wsData = wsSnap.data();
    if (wsData.status && wsData.status !== 'active') {
      throw new Error('This workspace is not active.');
    }

    // 2. Permission check: Admin, workspace creator, or active workspace admin member
    const isCreator = wsData.createdBy === currentUser.uid;
    const isWsMemberAdmin = memberships.some(
      (m) => m.workspaceId === cleanWorkspaceId && m.role === 'admin' && m.status === 'active'
    );

    if (!isAdmin && !isCreator && !isWsMemberAdmin) {
      throw new Error('Only administrators can generate workspace invites.');
    }

    const maxUses = typeof params === 'object' && params !== null ? params.maxUses || null : null;
    const expiryDays =
      typeof params === 'object' && params !== null && params.expiryDays
        ? params.expiryDays
        : DEFAULT_INVITE_EXPIRY_DAYS;

    const workspaceName =
      wsData.name ||
      (typeof params === 'object' && params?.workspaceName) ||
      'Workspace';

    // 3. In development, log diagnostics and verify auth state
    if (import.meta.env.DEV) {
      console.log('[UNSAID Invite Diagnostic] Initiating invite write:', {
        workspaceId: cleanWorkspaceId,
        uid: currentUser.uid,
        email: currentUser.email,
        projectId: db?.app?.options?.projectId,
        collection: 'workspaceInvites',
      });
    }

    try {
      await currentUser.getIdToken();
    } catch (authErr) {
      console.warn('[UNSAID Invite Diagnostic] Token verification issue:', authErr);
    }

    // 4. Generate cryptographically random invite token (40 hex chars = 160 bits entropy)
    const token = generateSecureToken(20);

    // 5. Calculate expiry timestamp
    const expiresAtDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const expiresAt = Timestamp.fromDate(expiresAtDate);

    const inviteData = {
      token,
      workspaceId: cleanWorkspaceId,
      workspaceName,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      expiresAt,
      status: 'active',
      usedCount: 0,
      ...(maxUses ? { maxUses } : {}),
    };

    const start = Date.now();
    try {
      const docRef = await withTimeout(
        addDoc(collection(db, 'workspaceInvites'), inviteData),
        10000
      );
      if (import.meta.env.DEV) {
        console.log(`[UNSAID Invite Diagnostic] Firestore write succeeded in ${Date.now() - start}ms:`, docRef.id);
      }
      return {
        id: docRef.id,
        ...inviteData,
        expiresAtDate,
      };
    } catch (writeErr) {
      if (import.meta.env.DEV) {
        console.error(`[UNSAID Invite Diagnostic] Firestore write failed in ${Date.now() - start}ms:`, {
          code: writeErr?.code || 'unknown',
          message: writeErr?.message || String(writeErr),
        });
      }
      throw writeErr;
    }
  };

  // Fetch all invite links for a workspace (Admin or Creator)
  const getWorkspaceInvites = useCallback(async (workspaceId) => {
    if (!currentUser || !db || !workspaceId) return [];

    try {
      const invitesRef = collection(db, 'workspaceInvites');
      const q = query(invitesRef, where('workspaceId', '==', workspaceId));
      const snap = await withTimeout(getDocs(q), 10000);
      const invites = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort newest first in-memory to avoid missing composite index
      invites.sort((a, b) => {
        const timeA =
          a.createdAt?.toMillis?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
        const timeB =
          b.createdAt?.toMillis?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
        return timeB - timeA;
      });

      return invites;
    } catch (err) {
      console.error('[UNSAID Invite Diagnostic] Error loading workspace invites:', {
        workspaceId,
        code: err?.code || 'unknown',
        message: err?.message || String(err),
      });
      return [];
    }
  }, [currentUser]);

  // Revoke an active invite link (Admin or Creator)
  const revokeInvite = async (inviteId) => {
    if (!currentUser) {
      throw new Error('You must be signed in to revoke an invite link.');
    }
    if (!db || !inviteId) {
      throw new Error('Invalid invite link identifier.');
    }

    const inviteRef = doc(db, 'workspaceInvites', inviteId);
    const inviteSnap = await withTimeout(getDoc(inviteRef), 8000);
    if (!inviteSnap.exists()) {
      throw new Error('Invitation record not found.');
    }
    const invData = inviteSnap.data();

    const isCreator = invData.createdBy === currentUser.uid;
    const isWsMemberAdmin = memberships.some(
      (m) => m.workspaceId === invData.workspaceId && m.role === 'admin' && m.status === 'active'
    );

    if (!isAdmin && !isCreator && !isWsMemberAdmin) {
      throw new Error('Only administrators can revoke workspace invite links.');
    }

    await updateDoc(inviteRef, {
      status: 'revoked',
      revokedAt: serverTimestamp(),
      revokedBy: currentUser.uid,
    });

    return true;
  };

  // Lookup invite by token and return invite + workspace info with expiry checks
  const getInviteByToken = useCallback(async (token) => {
    if (!token) return null;
    const cleanToken = token.trim();
    if (!cleanToken) return null;

    if (!db) {
      return { error: 'error', message: 'Database service unavailable. Please check your connection.' };
    }

    try {
      const invitesRef = collection(db, 'workspaceInvites');
      const q = query(invitesRef, where('token', '==', cleanToken));
      const snap = await withTimeout(getDocs(q), 10000);

      if (snap.empty) {
        return { error: 'invalid', message: 'Invitation link does not exist.' };
      }

      const inviteDoc = snap.docs[0];
      const invite = { id: inviteDoc.id, ...inviteDoc.data() };

      // 1. Status checks
      if (invite.status === 'revoked') {
        return { error: 'revoked', message: 'This invitation is no longer valid.' };
      }
      if (invite.status !== 'active') {
        return { error: 'inactive', message: 'This workspace invitation is no longer active.' };
      }

      // 2. Expiry check
      if (invite.expiresAt) {
        const expiresAtMs =
          typeof invite.expiresAt.toMillis === 'function'
            ? invite.expiresAt.toMillis()
            : typeof invite.expiresAt.toDate === 'function'
            ? invite.expiresAt.toDate().getTime()
            : invite.expiresAt instanceof Date
            ? invite.expiresAt.getTime()
            : typeof invite.expiresAt === 'number'
            ? invite.expiresAt
            : null;

        if (expiresAtMs && Date.now() > expiresAtMs) {
          return { error: 'expired', message: 'This workspace invitation is no longer active.' };
        }
      }

      // 3. Workspace scoping & verification
      const wsRef = doc(db, 'workspaces', invite.workspaceId);
      const wsSnap = await withTimeout(getDoc(wsRef), 3000);

      if (!wsSnap.exists() || wsSnap.data().status === 'archived') {
        return { error: 'not_found', message: 'The associated workspace is no longer active.' };
      }

      const workspace = { id: wsSnap.id, ...wsSnap.data() };
      return { invite, workspace };
    } catch (err) {
      console.error('[UNSAID] Error looking up invite token:', err);
      return { error: 'error', message: 'Failed to verify invitation token.' };
    }
  }, []);

  // Request to join workspace via invite
  const requestJoinWorkspace = async ({ inviteId, inviteToken, workspaceId, workspaceName }) => {
    if (!currentUser) {
      throw new Error('You must be signed in to request access to this workspace.');
    }
    if (!db) {
      throw new Error('Database service unavailable.');
    }

    // 1. Check if already an active member
    const memRef = collection(db, 'workspaceMembers');
    const memQ = query(
      memRef,
      where('workspaceId', '==', workspaceId),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active')
    );
    const memSnap = await getDocs(memQ);
    if (!memSnap.empty) {
      return { status: 'already_member', message: "You're already a member of this workspace." };
    }

    // 2. Check if pending request exists (prevent duplicates)
    const reqRef = collection(db, 'workspaceRequests');
    const reqQ = query(
      reqRef,
      where('workspaceId', '==', workspaceId),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const reqSnap = await getDocs(reqQ);
    if (!reqSnap.empty) {
      return { status: 'already_requested', message: 'Join request already sent.' };
    }

    // Resolve workspace name if not passed
    const resolvedName =
      workspaceName || workspaces.find((w) => w.id === workspaceId)?.name || 'Workspace';

    // 3. Create join request in workspaceRequests
    const requestData = {
      workspaceId,
      workspaceName: resolvedName,
      userId: currentUser.uid,
      userEmail: currentUser.email || '',
      userName: userProfile?.fullName || currentUser.displayName || 'UNSAID Member',
      inviteToken: inviteToken || '',
      inviteId: inviteId || null,
      status: 'pending',
      createdAt: serverTimestamp(),
      requestedAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
    };

    const docRef = await addDoc(reqRef, requestData);
    return { id: docRef.id, ...requestData };
  };

  // Get current user's request status for a specific workspace
  const getUserRequestForWorkspace = useCallback(async (workspaceId) => {
    if (!currentUser || !db) return null;

    try {
      const reqRef = collection(db, 'workspaceRequests');
      const q = query(
        reqRef,
        where('workspaceId', '==', workspaceId),
        where('userId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;

      // Return the most recent request
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const timeA =
          a.createdAt?.toMillis?.() || a.requestedAt?.toMillis?.() || 0;
        const timeB =
          b.createdAt?.toMillis?.() || b.requestedAt?.toMillis?.() || 0;
        return timeA - timeB;
      });
      return docs[docs.length - 1];
    } catch {
      return null;
    }
  }, [currentUser]);

  // Fetch join requests for admin review strictly scoped to the workspace
  const getWorkspaceRequests = useCallback(async (workspaceId) => {
    if (!isAdmin || !db || !workspaceId) return [];

    try {
      const reqRef = collection(db, 'workspaceRequests');
      const q = query(reqRef, where('workspaceId', '==', workspaceId));
      const snap = await withTimeout(getDocs(q), 5000);
      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Sort newest first
      requests.sort((a, b) => {
        const timeA =
          a.createdAt?.toMillis?.() || a.requestedAt?.toMillis?.() || 0;
        const timeB =
          b.createdAt?.toMillis?.() || b.requestedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      return requests;
    } catch (err) {
      console.error('[UNSAID] Error loading workspace requests for workspaceId:', workspaceId, err);
      return [];
    }
  }, [isAdmin]);

  // Review a join request (Approve or Reject)
  const reviewJoinRequest = async (requestId, decision, workspaceId, targetUserId, inviteTokenOrId) => {
    if (!isAdmin) {
      throw new Error('Only administrators can approve or reject join requests.');
    }
    if (!['approved', 'rejected'].includes(decision)) {
      throw new Error('Invalid request decision.');
    }
    if (!db) {
      throw new Error('Database service unavailable.');
    }
    if (!workspaceId) {
      throw new Error('Target workspace ID is required.');
    }

    const reqDocRef = doc(db, 'workspaceRequests', requestId);
    const reqSnap = await getDoc(reqDocRef);

    if (!reqSnap.exists()) {
      throw new Error('Join request not found.');
    }

    const reqData = reqSnap.data();
    if (reqData.workspaceId !== workspaceId) {
      throw new Error('Security verification failed: Join request does not belong to the target workspace.');
    }

    if (decision === 'approved') {
      if (reqData.status !== 'pending') {
        throw new Error(`This request has already been ${reqData.status}.`);
      }

      // 2. Create/update workspaceMembers document with deterministic ID (${userId}_${workspaceId})
      const memberDocId = `${targetUserId}_${workspaceId}`;
      const memberDocRef = doc(db, 'workspaceMembers', memberDocId);
      await setDoc(
        memberDocRef,
        {
          workspaceId,
          userId: targetUserId,
          role: 'member',
          status: 'active',
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3. Update request status to 'approved'
      await updateDoc(reqDocRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.uid,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
      });

      // 4. Increment invite usedCount if token or inviteId was recorded
      const inviteIdentifier =
        inviteTokenOrId || reqData.inviteToken || reqData.inviteId;
      if (inviteIdentifier) {
        try {
          const invitesRef = collection(db, 'workspaceInvites');
          const tokenQ = query(invitesRef, where('token', '==', inviteIdentifier));
          const tokenSnap = await getDocs(tokenQ);
          if (!tokenSnap.empty) {
            await updateDoc(tokenSnap.docs[0].ref, {
              usedCount: increment(1),
            });
          } else {
            const inviteDocRef = doc(db, 'workspaceInvites', inviteIdentifier);
            const idSnap = await getDoc(inviteDocRef);
            if (idSnap.exists()) {
              await updateDoc(inviteDocRef, {
                usedCount: increment(1),
              });
            }
          }
        } catch (inviteErr) {
          console.warn('[UNSAID] Could not increment invite usedCount:', inviteErr);
        }
      }

      // Refresh workspaces to immediately reflect in local list
      await loadWorkspaces();
      return true;
    } else {
      // Reject request
      await updateDoc(reqDocRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: currentUser.uid,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
      });
      return true;
    }
  };

  /**
   * Deletes a workspace and cascades cleanup to workspace-scoped collections.
   * Only authorized workspace admins or workspace creators can execute this.
   */
  const deleteWorkspace = async (workspaceId) => {
    if (!workspaceId) {
      throw new Error('Workspace identifier is required.');
    }
    if (!db) {
      throw new Error('Database service is not configured.');
    }

    const wsDocRef = doc(db, 'workspaces', workspaceId);
    const wsSnap = await withTimeout(getDoc(wsDocRef), 4000);
    if (!wsSnap.exists()) {
      throw new Error('Workspace not found or already deleted.');
    }

    const wsData = wsSnap.data();
    const isCreator = wsData.createdBy === currentUserId;
    if (!isAdmin && !isCreator) {
      throw new Error('You do not have permission to delete this workspace.');
    }

    // 1. Delete associated workspace invites
    try {
      const invitesRef = collection(db, 'workspaceInvites');
      const invitesQ = query(invitesRef, where('workspaceId', '==', workspaceId));
      const snap = await withTimeout(getDocs(invitesQ), 3500).catch(() => null);
      if (snap && !snap.empty) {
        await Promise.all(
          snap.docs.map((d) => withTimeout(deleteDoc(doc(db, 'workspaceInvites', d.id)), 2500).catch(() => {}))
        );
      }
    } catch (e) {
      console.warn('[UNSAID Delete Workspace] Invites cleanup note:', e.message);
    }

    // 2. Delete associated workspace requests
    try {
      const reqRef = collection(db, 'workspaceRequests');
      const reqQ = query(reqRef, where('workspaceId', '==', workspaceId));
      const snap = await withTimeout(getDocs(reqQ), 3500).catch(() => null);
      if (snap && !snap.empty) {
        await Promise.all(
          snap.docs.map((d) => withTimeout(deleteDoc(doc(db, 'workspaceRequests', d.id)), 2500).catch(() => {}))
        );
      }
    } catch (e) {
      console.warn('[UNSAID Delete Workspace] Requests cleanup note:', e.message);
    }

    // 3. Delete associated workspace members
    try {
      const memRef = collection(db, 'workspaceMembers');
      const memQ = query(memRef, where('workspaceId', '==', workspaceId));
      const snap = await withTimeout(getDocs(memQ), 3500).catch(() => null);
      if (snap && !snap.empty) {
        await Promise.all(
          snap.docs.map((d) => withTimeout(deleteDoc(doc(db, 'workspaceMembers', d.id)), 2500).catch(() => {}))
        );
      }
    } catch (e) {
      console.warn('[UNSAID Delete Workspace] Members cleanup note:', e.message);
    }

    // 4. Delete associated problems
    try {
      const probRef = collection(db, 'problems');
      const probQ = query(probRef, where('workspaceId', '==', workspaceId));
      const snap = await withTimeout(getDocs(probQ), 3500).catch(() => null);
      if (snap && !snap.empty) {
        await Promise.all(
          snap.docs.map((d) => withTimeout(deleteDoc(doc(db, 'problems', d.id)), 2500).catch(() => {}))
        );
      }
    } catch (e) {
      console.warn('[UNSAID Delete Workspace] Problems cleanup note:', e.message);
    }

    // 5. Delete the workspace document
    await withTimeout(deleteDoc(wsDocRef), 4000);

    // 6. Update local state and cache
    const remaining = workspaces.filter((w) => w.id !== workspaceId);
    setWorkspaces(remaining);
    try {
      localStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify(remaining));
    } catch {}

    setCurrentWorkspace((prev) => {
      if (prev?.id === workspaceId) {
        const nextWs = remaining[0] || null;
        try {
          if (nextWs) {
            localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextWs.id);
          } else {
            localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
          }
        } catch {}
        return nextWs;
      }
      return prev;
    });

    return true;
  };

  const value = {
    workspaces,
    currentWorkspace,
    selectedWorkspace: currentWorkspace,
    selectedWorkspaceId: currentWorkspace?.id || null,
    availableWorkspaces: workspaces,
    memberships,
    loading,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    generateInvite,
    getWorkspaceInvites,
    revokeInvite,
    getInviteByToken,
    requestJoinWorkspace,
    getUserRequestForWorkspace,
    getWorkspaceRequests,
    reviewJoinRequest,
    refreshWorkspaces: loadWorkspaces,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

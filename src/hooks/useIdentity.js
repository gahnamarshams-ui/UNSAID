import { useState, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';

/**
 * Generates a stable, deterministic 4-digit pseudonym for an authenticated user within a workspace.
 * Uses a string hash so the number NEVER changes between renders and remains unique per user & workspace.
 * 
 * @param {string} userId 
 * @param {string} workspaceId 
 * @returns {string} e.g. "Anon User #1042"
 */
export const generateStablePseudonym = (userId, workspaceId) => {
  if (!userId) return 'Anon User #1000';
  const seed = `${userId}_${workspaceId || 'global'}_identity`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const number = 1000 + (positiveHash % 9000);
  return `Anon User #${number}`;
};

/**
 * useIdentity Hook
 * Manages Dual Identity state: "public" vs "anonymous".
 * 
 * Features:
 * - Public mode displays real display name and role.
 * - Anonymous mode generates and displays a stable workspace-scoped pseudonym.
 * - Persists preference per workspace in localStorage.
 * - Does not alter Firebase Auth identity.
 */
export const useIdentity = () => {
  const { currentUser, userProfile } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const userId = currentUser?.uid || '';
  const workspaceId = currentWorkspace?.id || 'default';

  const cacheKey = useMemo(() => {
    return userId ? `unsaid_id_mode_${userId}_${workspaceId}` : null;
  }, [userId, workspaceId]);

  const [prevCacheKey, setPrevCacheKey] = useState(cacheKey);
  const [identityMode, setIdentityModeState] = useState(() => {
    if (!cacheKey) return 'public';
    try {
      const stored = localStorage.getItem(cacheKey);
      return stored === 'anonymous' ? 'anonymous' : 'public';
    } catch {
      return 'public';
    }
  });

  // Re-sync synchronously during render when cacheKey changes
  if (prevCacheKey !== cacheKey) {
    setPrevCacheKey(cacheKey);
    let synced = 'public';
    if (cacheKey) {
      try {
        const stored = localStorage.getItem(cacheKey);
        synced = stored === 'anonymous' ? 'anonymous' : 'public';
      } catch {
        synced = 'public';
      }
    }
    setIdentityModeState(synced);
  }

  const pseudonym = useMemo(() => {
    return generateStablePseudonym(userId, workspaceId);
  }, [userId, workspaceId]);

  const displayName = useMemo(() => {
    return userProfile?.fullName || currentUser?.displayName || 'Member';
  }, [userProfile?.fullName, currentUser?.displayName]);

  const setIdentityMode = useCallback(
    (mode) => {
      const targetMode = mode === 'anonymous' ? 'anonymous' : 'public';
      setIdentityModeState(targetMode);
      if (cacheKey) {
        try {
          localStorage.setItem(cacheKey, targetMode);
        } catch {}
      }
    },
    [cacheKey]
  );

  const toggleIdentityMode = useCallback(() => {
    setIdentityMode(identityMode === 'anonymous' ? 'public' : 'anonymous');
  }, [identityMode, setIdentityMode]);

  const isAnonymous = identityMode === 'anonymous';
  const activeName = isAnonymous ? pseudonym : displayName;

  return {
    identityMode,
    isAnonymous,
    pseudonym,
    displayName,
    activeName,
    setIdentityMode,
    toggleIdentityMode,
  };
};

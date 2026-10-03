import React, { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, getGoogleProvider, isFirebaseConfigured } from '../config/firebase';
import { isAuthorizedAdminEmail } from '../config/adminConfig';
import { AuthContext } from './authContextDef';

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

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(auth));

  // Helper to fetch or create a user profile document in Firestore
  const syncUserProfile = useCallback(async (firebaseUser, additionalData = {}) => {
    if (!firebaseUser) {
      setUserProfile(null);
      return null;
    }

    const verifiedRole = isAuthorizedAdminEmail(firebaseUser.email) ? 'admin' : 'user';

    // 1. Initial immediate local profile representation
    let localProfile = null;
    try {
      const cached = localStorage.getItem(`unsaid_profile_${firebaseUser.uid}`);
      if (cached) localProfile = JSON.parse(cached);
    } catch {}

    if (!localProfile) {
      localProfile = {
        uid: firebaseUser.uid,
        fullName: additionalData.fullName || firebaseUser.displayName || 'UNSAID Member',
        email: (firebaseUser.email || '').trim().toLowerCase(),
        role: verifiedRole,
        requestedRole: additionalData.requestedRole || 'user',
        avatarUrl: firebaseUser.photoURL || null,
        avatarPreference: firebaseUser.photoURL ? 'photo' : 'initials',
      };
    }

    // Immediately make localProfile available to consumers
    setUserProfile((prev) => prev || localProfile);

    // 2. Background Firestore synchronization with timeout protection
    if (!db) return localProfile;

    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await withTimeout(getDoc(userRef), 2500);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const shouldBeAdmin = isAuthorizedAdminEmail(firebaseUser.email);
        const updates = {};

        // Only promote to admin if verified by authorization rules
        if (shouldBeAdmin && data.role !== 'admin') {
          updates.role = 'admin';
        }
        // Preserve existing user profile but populate missing avatar from Google
        if (!data.avatarUrl && firebaseUser.photoURL) {
          updates.avatarUrl = firebaseUser.photoURL;
        }
        // Ensure avatarPreference exists
        if (!data.avatarPreference) {
          updates.avatarPreference = data.avatarUrl || firebaseUser.photoURL ? 'photo' : 'initials';
        }
        // Enrich placeholder name ONLY if user has never customized their name
        if ((!data.fullName || data.fullName === 'UNSAID Member') && firebaseUser.displayName) {
          updates.fullName = firebaseUser.displayName;
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = serverTimestamp();
          withTimeout(setDoc(userRef, updates, { merge: true }), 2500).catch(() => {});
          Object.assign(data, updates);
        }

        // Align Firebase Auth displayName with the persisted Firestore profile name
        if (data.fullName && firebaseUser.displayName !== data.fullName) {
          try {
            await updateProfile(firebaseUser, { displayName: data.fullName });
          } catch {
            // Non-fatal
          }
        }

        setUserProfile(data);
        try {
          localStorage.setItem(`unsaid_profile_${firebaseUser.uid}`, JSON.stringify(data));
        } catch {}
        return data;
      } else {
        // Create new profile record
        const newProfile = {
          uid: firebaseUser.uid,
          fullName: additionalData.fullName || firebaseUser.displayName || 'UNSAID Member',
          email: (firebaseUser.email || '').trim().toLowerCase(),
          role: verifiedRole,
          requestedRole: additionalData.requestedRole || 'user',
          avatarUrl: firebaseUser.photoURL || null,
          avatarPreference: firebaseUser.photoURL ? 'photo' : 'initials',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        withTimeout(setDoc(userRef, newProfile), 2500).catch(() => {});
        setUserProfile(newProfile);
        try {
          localStorage.setItem(`unsaid_profile_${firebaseUser.uid}`, JSON.stringify(newProfile));
        } catch {}
        return newProfile;
      }
    } catch (err) {
      console.warn('[UNSAID Auth] Firestore profile sync deferred (offline/timeout):', err.message);
      setUserProfile((prev) => prev || localProfile);
      return localProfile;
    }
  }, []);

  // Listen to persistent Firebase Auth state
  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        // Fast-path hydration: unblock application shell immediately
        setLoading(false);
        // Asynchronously synchronize Firestore profile in the background
        syncUserProfile(firebaseUser);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncUserProfile]);



  // Sign up with Email and Password
  const signUp = async (email, password, fullName, requestedRole = 'user') => {
    if (!auth) {
      throw new Error('Firebase Authentication is not configured in .env');
    }

    const normalizedEmail = email.trim().toLowerCase();
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      console.error('[UNSAID AuthContext Diagnostic]', {
        operation: 'createUserWithEmailAndPassword',
        code: err?.code || 'unknown',
        message: err?.message || String(err),
      });
      throw err;
    }
    const user = userCredential.user;

    // Update Firebase Auth user display name
    try {
      await updateProfile(user, { displayName: fullName.trim() });
    } catch {
      // Non-fatal
    }

    // Create Firestore profile record
    await syncUserProfile(user, { fullName: fullName.trim(), requestedRole });
    return user;
  };

  // Sign in with Email and Password
  const signIn = async (email, password) => {
    if (!auth) {
      throw new Error('Firebase Authentication is not configured in .env');
    }
    const normalizedEmail = email.trim().toLowerCase();
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      console.error('[UNSAID AuthContext Diagnostic]', {
        operation: 'signInWithEmailAndPassword',
        code: err?.code || 'unknown',
        message: err?.message || String(err),
      });
      throw err;
    }
    await syncUserProfile(userCredential.user);
    return userCredential.user;
  };

  // Sign in with Google Popup
  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error('Firebase Authentication is not configured in .env');
    }
    const provider = googleProvider || getGoogleProvider();
    if (!provider) {
      throw new Error('Google Sign-In provider could not be initialized');
    }
    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('[UNSAID AuthContext Diagnostic]', {
        operation: 'signInWithPopup (Google)',
        code: err?.code || 'unknown',
        message: err?.message || String(err),
      });
      throw err;
    }
    await syncUserProfile(result.user);
    return result.user;
  };

  // Sign out
  const signOut = async () => {
    if (!auth) {
      setCurrentUser(null);
      setUserProfile(null);
      return;
    }
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  // Password Reset
  const resetPassword = async (email) => {
    if (!auth) {
      throw new Error('Firebase Authentication is not configured in .env');
    }
    return sendPasswordResetEmail(auth, email.trim().toLowerCase());
  };

  // Refresh profile manually
  const refreshProfile = async () => {
    if (currentUser) {
      return syncUserProfile(currentUser);
    }
  };

  // Safe Profile Update (allows updating fullName and avatar, blocks client role tampering)
  const updateProfileData = async (fieldsToUpdate) => {
    if (!currentUser) {
      throw new Error('User is not authenticated.');
    }
    if (!db) {
      throw new Error('Database service is not configured.');
    }

    // Filter strictly to safe editable fields
    const safeData = {};
    if (fieldsToUpdate.fullName !== undefined) {
      const trimmedName = String(fieldsToUpdate.fullName).trim();
      if (!trimmedName) {
        throw new Error('Display name cannot be blank.');
      }
      safeData.fullName = trimmedName;
    }
    if (fieldsToUpdate.avatarPreference !== undefined) {
      safeData.avatarPreference = fieldsToUpdate.avatarPreference === 'photo' ? 'photo' : 'initials';
    }

    safeData.updatedAt = serverTimestamp();

    // 1. Update Firebase Auth displayName
    if (safeData.fullName && auth?.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: safeData.fullName });
      } catch (authErr) {
        console.warn('[UNSAID Auth] Could not update Auth profile displayName:', authErr);
      }
    }

    // 2. Immediately update AuthContext local states and persistent cache
    const nextProfile = {
      ...(userProfile || {}),
      uid: currentUser.uid,
      email: currentUser.email,
      ...safeData,
    };

    setUserProfile(nextProfile);
    try {
      localStorage.setItem(`unsaid_profile_${currentUser.uid}`, JSON.stringify(nextProfile));
    } catch {}

    if (safeData.fullName) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        try {
          const updated = Object.create(Object.getPrototypeOf(prev));
          Object.assign(updated, prev);
          updated.displayName = safeData.fullName;
          return updated;
        } catch {
          return prev;
        }
      });
    }

    // 3. Persist to Firestore user profile document with timeout protection
    if (db) {
      const userRef = doc(db, 'users', currentUser.uid);
      const firestoreData = {
        ...safeData,
        updatedAt: serverTimestamp(),
      };
      withTimeout(setDoc(userRef, firestoreData, { merge: true }), 2500).catch((fsErr) => {
        console.warn('[UNSAID Auth] Firestore profile write deferred (offline/timeout):', fsErr.message);
      });
    }

    return nextProfile;
  };

  // Real Account Deletion with Re-authentication and Firestore Cleanup
  const deleteAccount = async ({ password = '' } = {}) => {
    if (!auth || !auth.currentUser) {
      throw new Error('User is not authenticated.');
    }

    const user = auth.currentUser;
    const uid = user.uid;
    const email = user.email;

    const isPasswordUser = user.providerData.some((p) => p.providerId === 'password');
    const isGoogleUser = user.providerData.some((p) => p.providerId === 'google.com');

    // 1. Clean up user's personal Firestore records first (while session is authenticated)
    if (db) {
      try {
        // Delete users/{uid} document
        const userRef = doc(db, 'users', uid);
        await withTimeout(deleteDoc(userRef), 4000).catch((err) => {
          console.warn('[UNSAID Delete Account] User doc delete warning:', err.message);
        });

        // Delete user's workspaceMemberships
        const memRef = collection(db, 'workspaceMembers');
        const memQ = query(memRef, where('userId', '==', uid));
        const memSnap = await withTimeout(getDocs(memQ), 4000).catch(() => null);
        if (memSnap && !memSnap.empty) {
          const deleteMemPromises = memSnap.docs.map((d) =>
            withTimeout(deleteDoc(doc(db, 'workspaceMembers', d.id)), 3000).catch(() => {})
          );
          await Promise.all(deleteMemPromises);
        }

        // Delete user's workspaceRequests
        const reqRef = collection(db, 'workspaceRequests');
        const reqQ = query(reqRef, where('userId', '==', uid));
        const reqSnap = await withTimeout(getDocs(reqQ), 4000).catch(() => null);
        if (reqSnap && !reqSnap.empty) {
          const deleteReqPromises = reqSnap.docs.map((d) =>
            withTimeout(deleteDoc(doc(db, 'workspaceRequests', d.id)), 3000).catch(() => {})
          );
          await Promise.all(deleteReqPromises);
        }
      } catch (fsErr) {
        console.warn('[UNSAID Delete Account] Firestore cleanup non-fatal warning:', fsErr.message);
      }
    }

    // 2. Perform official Firebase Auth account deletion
    try {
      await deleteUser(user);
    } catch (authErr) {
      if (authErr.code === 'auth/requires-recent-login') {
        if (isPasswordUser) {
          if (!password) {
            const reauthError = new Error('Re-authentication required. Please enter your password to confirm account deletion.');
            reauthError.code = 'auth/requires-recent-login';
            throw reauthError;
          }
          const credential = EmailAuthProvider.credential(email, password);
          await reauthenticateWithCredential(user, credential);
          await deleteUser(user);
        } else if (isGoogleUser) {
          const provider = googleProvider || getGoogleProvider();
          await reauthenticateWithPopup(user, provider);
          await deleteUser(user);
        } else {
          throw authErr;
        }
      } else {
        throw authErr;
      }
    }

    // 3. Clear local storage caches
    try {
      localStorage.removeItem(`unsaid_profile_${uid}`);
      localStorage.removeItem('unsaid_active_workspace');
      localStorage.removeItem('unsaid_workspaces_cache');
    } catch {}

    setCurrentUser(null);
    setUserProfile(null);
  };

  // Derived Admin authorization flag:
  // Derived strictly from Firestore verified role document and authorized config.
  // NEVER from localStorage, client state, or query params.
  const isAdmin = Boolean(
    userProfile?.role === 'admin' ||
    (currentUser?.email && isAuthorizedAdminEmail(currentUser.email))
  );

  const value = {
    currentUser,
    userProfile,
    loading,
    isAuthenticated: Boolean(currentUser),
    isAdmin,
    isConfigured: isFirebaseConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile,
    updateProfileData,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

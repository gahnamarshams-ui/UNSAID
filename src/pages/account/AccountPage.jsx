import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Building2,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  GraduationCap,
  Briefcase,
  Home,
  Edit3,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { ModalShell } from '../../components/ui/ModalShell';
import { getFriendlyFirestoreErrorMessage, getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';
import {
  resolveWorkspaceDomainType,
  getRoleSuggestions,
  ACADEMIC_YEAR_OPTIONS,
  COURSE_SUGGESTIONS,
  validateWorkspaceIdentity,
} from '../../utils/identityProfile';

export const AccountPage = () => {
  const {
    currentUser,
    userProfile,
    isAdmin,
    signOut,
    updateProfileData,
    deleteAccount,
    reauthenticateWithGoogle,
  } = useAuth();

  const {
    currentWorkspace,
    workspaces,
    currentMembership,
    isCurrentWorkspaceAdmin,
    updateWorkspaceMemberProfile,
  } = useWorkspace();

  const navigate = useNavigate();

  // Personal Profile state
  const [fullName, setFullName] = useState(userProfile?.fullName || currentUser?.displayName || '');
  const [avatarPreference, setAvatarPreference] = useState(
    userProfile?.avatarPreference || 'initials'
  );
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');

  // Keep personal inputs synchronized
  const syncedProfileRef = useRef(null);
  useEffect(() => {
    const profileKey = `${userProfile?.fullName || currentUser?.displayName || ''}:${userProfile?.avatarPreference || ''}`;
    if (syncedProfileRef.current !== profileKey && (userProfile || currentUser)) {
      syncedProfileRef.current = profileKey;
      setFullName(userProfile?.fullName || currentUser?.displayName || '');
      setAvatarPreference(userProfile?.avatarPreference || 'initials');
    }
  }, [userProfile, currentUser]);

  const handlePersonalSave = async (e) => {
    e.preventDefault();
    if (saveStatus === 'saving') return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Display name cannot be blank.');
      return;
    }

    setError('');
    setSaveStatus('saving');

    try {
      await updateProfileData({
        fullName: trimmedName,
        avatarPreference,
      });
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2500);
    } catch (err) {
      console.error('[UNSAID Profile Update Error]', err);
      setError(getFriendlyFirestoreErrorMessage(err, "Profile couldn't be updated. Please try again."));
      setSaveStatus('idle');
    }
  };

  // Workspace Identity state
  const domainType = resolveWorkspaceDomainType(currentWorkspace?.domain);
  const roleSuggestions = React.useMemo(
    () => getRoleSuggestions(domainType, isCurrentWorkspaceAdmin),
    [domainType, isCurrentWorkspaceAdmin]
  );

  const [isEditingWs, setIsEditingWs] = useState(false);
  const [wsRole, setWsRole] = useState('');
  const [wsCustomRole, setWsCustomRole] = useState('');
  const [wsInstitution, setWsInstitution] = useState('');
  const [wsOrganization, setWsOrganization] = useState('');
  const [wsDepartment, setWsDepartment] = useState('');
  const [wsDesignation, setWsDesignation] = useState('');
  const [wsYear, setWsYear] = useState('');
  const [wsCourse, setWsCourse] = useState('');
  const [wsCustomCourse, setWsCustomCourse] = useState('');
  const [wsRoomNumber, setWsRoomNumber] = useState('');

  const [wsSaveStatus, setWsSaveStatus] = useState('idle');
  const [wsError, setWsError] = useState('');
  const [wsFieldErrors, setWsFieldErrors] = useState({});

  // Synchronize workspace membership fields
  useEffect(() => {
    if (currentMembership && currentWorkspace && !isEditingWs) {
      const existingRole = currentMembership.professionalRole || '';
      const isPreset = roleSuggestions.includes(existingRole);

      if (isPreset) {
        setWsRole(existingRole);
        setWsCustomRole('');
      } else if (existingRole) {
        setWsRole('Other');
        setWsCustomRole(existingRole);
      } else {
        if (isCurrentWorkspaceAdmin) {
          setWsRole(domainType === 'academic' ? 'Professor' : domainType === 'hostel' ? 'Warden' : 'Manager');
        } else {
          setWsRole(domainType === 'academic' ? 'Student' : domainType === 'hostel' ? 'Resident' : 'Employee');
        }
        setWsCustomRole('');
      }

      setWsInstitution(currentMembership.institution || currentWorkspace.name || '');
      setWsOrganization(currentMembership.organization || currentWorkspace.name || '');
      setWsDepartment(currentMembership.department || '');
      setWsDesignation(currentMembership.designation || '');
      setWsYear(currentMembership.year || (domainType === 'academic' && !isCurrentWorkspaceAdmin ? '1st Year' : ''));

      const existingCourse = currentMembership.course || '';
      if (COURSE_SUGGESTIONS.includes(existingCourse)) {
        setWsCourse(existingCourse);
        setWsCustomCourse('');
      } else if (existingCourse) {
        setWsCourse('Other');
        setWsCustomCourse(existingCourse);
      } else {
        setWsCourse(domainType === 'academic' && !isCurrentWorkspaceAdmin ? 'B.Tech' : '');
        setWsCustomCourse('');
      }

      setWsRoomNumber(currentMembership.roomNumber || '');
      setWsError('');
      setWsFieldErrors({});
    }
  }, [currentMembership, currentWorkspace, domainType, isCurrentWorkspaceAdmin, roleSuggestions, isEditingWs]);

  const effectiveWsRole = wsRole === 'Other' ? wsCustomRole.trim() : wsRole;
  const effectiveWsCourse = wsCourse === 'Other' ? wsCustomCourse.trim() : wsCourse;
  const isStudent = effectiveWsRole.toLowerCase() === 'student' || effectiveWsRole.toLowerCase() === 'student resident';

  const handleWorkspaceSave = async (e) => {
    e.preventDefault();
    if (wsSaveStatus === 'saving') return;

    const payload = {
      professionalRole: effectiveWsRole,
      profileType: domainType,
      department: wsDepartment.trim(),
      designation: wsDesignation.trim(),
      year: isStudent || domainType === 'hostel' ? wsYear.trim() : '',
      course: isStudent ? effectiveWsCourse : '',
      roomNumber: domainType === 'hostel' ? wsRoomNumber.trim() : '',
    };

    if (domainType === 'corporate') {
      payload.organization = (wsOrganization.trim() || currentWorkspace?.name || '').trim();
    } else {
      payload.institution = (wsInstitution.trim() || currentWorkspace?.name || '').trim();
      if (wsOrganization.trim()) payload.organization = wsOrganization.trim();
    }

    const validation = validateWorkspaceIdentity(payload, domainType);
    if (!validation.isValid) {
      setWsFieldErrors(validation.errors);
      setWsError('Please fill in the required identity fields.');
      return;
    }

    setWsFieldErrors({});
    setWsError('');
    setWsSaveStatus('saving');

    try {
      await updateWorkspaceMemberProfile(payload);
      setWsSaveStatus('saved');
      setIsEditingWs(false);
      setTimeout(() => {
        setWsSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2500);
    } catch (err) {
      console.error('[UNSAID Workspace Profile Save Error]', err);
      const isPerm = err?.code === 'permission-denied' || err?.message?.includes('permission-denied');
      const friendlyMsg = isPerm
        ? "You don't have permission to update this profile."
        : getFriendlyFirestoreErrorMessage(err, "Unable to save your profile. Please try again.");
      setWsError(friendlyMsg);
      setWsSaveStatus('idle');
    }
  };

  // Delete Account States & Provider Detection
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const hasPasswordProvider = currentUser?.providerData?.some((p) => p.providerId === 'password');
  const hasGoogleProvider = currentUser?.providerData?.some((p) => p.providerId === 'google.com');

  const isGoogleAccount = hasGoogleProvider && !hasPasswordProvider;
  const isPasswordAccount = hasPasswordProvider || !hasGoogleProvider;

  const executeDelete = async (options) => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteAccount(options);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[UNSAID Delete Account Error]', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setDeleteError('Google verification was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        setDeleteError('Your browser blocked the Google verification popup. Please allow popups and try again.');
      } else if (err.code === 'auth/user-mismatch') {
        setDeleteError('The Google account used for verification does not match this account.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password. Please verify your current account password.');
      } else {
        setDeleteError(getFriendlyAuthErrorMessage(err));
      }
      setIsDeleting(false);
    }
  };

  const handleGoogleVerify = async () => {
    setDeleteError('');
    setIsVerifyingGoogle(true);
    try {
      await reauthenticateWithGoogle();
      setIsGoogleVerified(true);
      if (deleteConfirmText.trim() === 'DELETE') {
        await executeDelete({ isGoogleReauthenticated: true });
      }
    } catch (err) {
      console.error('[UNSAID Google Reauth Error]', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setDeleteError('Google verification was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        setDeleteError('Your browser blocked the Google verification popup. Please allow popups and try again.');
      } else if (err.code === 'auth/user-mismatch') {
        setDeleteError('The Google account used for verification does not match this account.');
      } else {
        setDeleteError(getFriendlyAuthErrorMessage(err));
      }
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE exactly to confirm.');
      return;
    }
    if (isPasswordAccount && !reauthPassword) {
      setDeleteError('Please enter your account password to verify your identity.');
      return;
    }
    if (isGoogleAccount && !isGoogleVerified) {
      setDeleteError('Please continue with Google to verify your identity before deleting your account.');
      return;
    }

    await executeDelete({
      password: reauthPassword,
      isGoogleReauthenticated: isGoogleVerified,
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[UNSAID Sign Out Error]', err);
    }
  };

  const formattedJoinDate = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Active Session';

  const getDomainIcon = () => {
    switch (domainType) {
      case 'academic':
        return <GraduationCap className="w-5 h-5 text-[var(--cyan)]" />;
      case 'hostel':
        return <Home className="w-5 h-5 text-[var(--primary)]" />;
      case 'corporate':
        return <Briefcase className="w-5 h-5 text-[var(--cyan)]" />;
      default:
        return <Building2 className="w-5 h-5 text-[var(--primary)]" />;
    }
  };

  return (
    <PageContainer size="md" className="space-y-8">
      {/* Header */}
      <SectionHeader
        title="Account & Identity Settings"
        subtitle="Manage your personal profile and workspace-specific professional / academic identities."
        badge={
          <Badge variant={isAdmin ? 'cyan' : 'primary'} size="sm" dot>
            {isAdmin ? 'Platform Administrator' : 'Standard Account'}
          </Badge>
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            icon={<LogOut className="w-4 h-4 text-[var(--danger)]" />}
            className="hover:border-[var(--danger)]"
          >
            Sign Out
          </Button>
        }
      />

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Identity Overview Card */}
        <GlassCard className="p-6 text-center space-y-4 flex flex-col items-center justify-center">
          <Avatar
            name={fullName || userProfile?.fullName || currentUser?.displayName || 'User'}
            src={avatarPreference === 'initials' ? null : (userProfile?.avatarUrl || currentUser?.photoURL)}
            size="lg"
            isOnline={true}
          />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[var(--text)]">
              {fullName || userProfile?.fullName || currentUser?.displayName || 'Member'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] truncate max-w-[220px]">
              {currentUser?.email}
            </p>
            {currentMembership?.professionalRole && (
              <p className="text-xs font-semibold text-[var(--cyan)] pt-1 flex items-center justify-center gap-1">
                <span>{currentMembership.professionalRole}</span>
                {currentMembership.department && <span>· {currentMembership.department}</span>}
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-wrap gap-2 justify-center">
            <Badge variant={isAdmin ? 'cyan' : 'primary'} size="sm">
              Global: {userProfile?.role || (isAdmin ? 'Admin' : 'User')}
            </Badge>
            <Badge variant="neutral" size="sm">
              {workspaces.length} Workspace{workspaces.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </GlassCard>

        {/* Right Column: Editable Profile Settings */}
        <div className="md:col-span-2 space-y-6">
          {/* 1. PERSONAL DETAILS CARD */}
          <GlassCard variant="panel" className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-[var(--text)] flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--primary)]" />
                <span>Personal Profile</span>
              </h4>
              <span className="text-[11px] text-[var(--text-muted)]">Global across UNSAID</span>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePersonalSave} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Avatar Style Preference */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Avatar Display Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarPreference('initials')}
                    className={`p-2.5 rounded-2xl border text-xs text-left transition-all cursor-pointer ${
                      avatarPreference === 'initials'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold shadow-sm'
                        : 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Initials Monogram
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarPreference('photo')}
                    className={`p-2.5 rounded-2xl border text-xs text-left transition-all cursor-pointer ${
                      avatarPreference === 'photo'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold shadow-sm'
                        : 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Photo Avatar
                  </button>
                </div>
              </div>

              {/* Email (Read-only for security) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    Email Address
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">Managed by Firebase Auth</span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={currentUser?.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)]/50 border border-[var(--glass-border)] text-sm text-[var(--text-muted)] cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant={saveStatus === 'saved' ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={saveStatus === 'saving' || !fullName.trim()}
                  isLoading={saveStatus === 'saving'}
                  icon={
                    saveStatus === 'saved' ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )
                  }
                  className={saveStatus === 'saved' ? 'border-[var(--success)]/40 text-[var(--success)]' : ''}
                >
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Personal Details'}
                </Button>
              </div>
            </form>
          </GlassCard>

          {/* 2. WORKSPACE IDENTITY SECTION */}
          <GlassCard variant="panel" className="p-6 space-y-5" id="workspace-identity">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <h4 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  {getDomainIcon()}
                  <span>Workspace Identity</span>
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Your professional / academic role in {currentWorkspace?.name || 'this workspace'}.
                </p>
              </div>

              {currentWorkspace && (
                <div className="flex items-center gap-2">
                  <Badge variant={currentMembership?.profileCompleted ? 'low' : 'warning'} size="sm" dot>
                    {currentMembership?.profileCompleted ? 'Profile Complete' : 'Profile Incomplete'}
                  </Badge>
                  {!isEditingWs && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditingWs(true)}
                      icon={<Edit3 className="w-3.5 h-3.5 text-[var(--cyan)]" />}
                    >
                      Edit Identity
                    </Button>
                  )}
                </div>
              )}
            </div>

            {currentWorkspace ? (
              <div className="space-y-4">
                {/* Workspace Context Header Banner */}
                <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-start justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-[var(--text)]">
                      {currentWorkspace.name}
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      {currentWorkspace.description || 'Active organizational workspace.'}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                      <span className="uppercase tracking-wider font-semibold text-[var(--cyan)]">
                        {currentWorkspace.domain}
                      </span>
                      <span>·</span>
                      <span>Joined: {formattedJoinDate}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Shield className="w-3.5 h-3.5 text-[var(--cyan)]" />
                      <span className="text-[var(--text-muted)]">Permission:</span>
                      <strong className="text-[var(--text)] capitalize">
                        {isCurrentWorkspaceAdmin ? 'Admin' : 'Member'}
                      </strong>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Permission is server-protected
                    </span>
                  </div>
                </div>

                {wsError && (
                  <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{wsError}</span>
                  </div>
                )}

                {/* READ-ONLY VIEW */}
                {!isEditingWs ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[var(--surface)]/50 border border-[var(--glass-border)] text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Professional / Academic Role
                      </span>
                      <p className="text-sm font-bold text-[var(--text)]">
                        {currentMembership?.professionalRole || (
                          <span className="text-[var(--warning)] italic">Not set</span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        {domainType === 'corporate' ? 'Organization' : 'Institution / College'}
                      </span>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {currentMembership?.institution || currentMembership?.organization || currentWorkspace.name}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Department / Division
                      </span>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {currentMembership?.department || (
                          <span className="text-[var(--text-muted)] italic">Not specified</span>
                        )}
                      </p>
                    </div>

                    {isStudent ? (
                      <>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                            Academic Year
                          </span>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {currentMembership?.year || (
                              <span className="text-[var(--text-muted)] italic">Not specified</span>
                            )}
                          </p>
                        </div>
                        {currentMembership?.course && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                              Course / Program
                            </span>
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {currentMembership.course}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      currentMembership?.designation && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                            Designation / Title
                          </span>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {currentMembership.designation}
                          </p>
                        </div>
                      )
                    )}

                    {domainType === 'hostel' && currentMembership?.roomNumber && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                          Room Number
                        </span>
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {currentMembership.roomNumber}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* EDITING FORM VIEW */
                  <form onSubmit={handleWorkspaceSave} className="space-y-4 pt-1 animate-fade-in">
                    {/* Role Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        {domainType === 'academic'
                          ? 'Academic / Professional Role'
                          : domainType === 'corporate'
                          ? 'Professional Role / Function'
                          : 'Workspace Role'}{' '}
                        <span className="text-[var(--danger)]">*</span>
                      </label>
                      <select
                        value={wsRole}
                        onChange={(e) => {
                          setWsRole(e.target.value);
                          if (wsFieldErrors.professionalRole) {
                            setWsFieldErrors((prev) => ({ ...prev, professionalRole: null }));
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                      >
                        {roleSuggestions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {wsFieldErrors.professionalRole && (
                        <p className="text-[11px] text-[var(--danger)]">{wsFieldErrors.professionalRole}</p>
                      )}
                    </div>

                    {/* Custom Role write-in if "Other" */}
                    {wsRole === 'Other' && (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                          Specify Your Role <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={wsCustomRole}
                          onChange={(e) => setWsCustomRole(e.target.value)}
                          placeholder="e.g. Lab Technician, Visiting Faculty"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                    )}

                    {/* Institution / Organization */}
                    {domainType === 'corporate' ? (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                          Organization / Company <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={wsOrganization}
                          onChange={(e) => setWsOrganization(e.target.value)}
                          placeholder="e.g. XYZ Technologies"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                        {wsFieldErrors.organization && (
                          <p className="text-[11px] text-[var(--danger)]">{wsFieldErrors.organization}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                          {domainType === 'academic'
                            ? 'College / University / Institution'
                            : 'Institution / Organization'}{' '}
                          <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={wsInstitution}
                          onChange={(e) => setWsInstitution(e.target.value)}
                          placeholder="e.g. ABC College"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                        {wsFieldErrors.institution && (
                          <p className="text-[11px] text-[var(--danger)]">{wsFieldErrors.institution}</p>
                        )}
                      </div>
                    )}

                    {/* Department */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Department / Team {domainType !== 'hostel' && <span className="text-[var(--danger)]">*</span>}
                      </label>
                      <input
                        type="text"
                        required={domainType !== 'hostel'}
                        value={wsDepartment}
                        onChange={(e) => setWsDepartment(e.target.value)}
                        placeholder="e.g. Computer Science, Human Resources"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                      />
                      {wsFieldErrors.department && (
                        <p className="text-[11px] text-[var(--danger)]">{wsFieldErrors.department}</p>
                      )}
                    </div>

                    {/* Student Year & Course */}
                    {isStudent && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] animate-fade-in">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                            Academic Year <span className="text-[var(--danger)]">*</span>
                          </label>
                          <select
                            value={wsYear}
                            onChange={(e) => setWsYear(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                          >
                            <option value="">Select Year</option>
                            {ACADEMIC_YEAR_OPTIONS.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                          {wsFieldErrors.year && (
                            <p className="text-[10px] text-[var(--danger)]">{wsFieldErrors.year}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                            Course / Program
                          </label>
                          <select
                            value={wsCourse}
                            onChange={(e) => setWsCourse(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                          >
                            <option value="">Select Program</option>
                            {COURSE_SUGGESTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {wsCourse === 'Other' && (
                          <div className="sm:col-span-2 space-y-1.5 pt-1">
                            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                              Specify Course Name
                            </label>
                            <input
                              type="text"
                              value={wsCustomCourse}
                              onChange={(e) => setWsCustomCourse(e.target.value)}
                              placeholder="e.g. B.Tech Computer Science"
                              className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Non-student Designation */}
                    {!isStudent && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                          Designation / Title
                        </label>
                        <input
                          type="text"
                          value={wsDesignation}
                          onChange={(e) => setWsDesignation(e.target.value)}
                          placeholder="e.g. Professor, HR Manager, Senior Engineer"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                    )}

                    {/* Hostel Room Number */}
                    {domainType === 'hostel' && (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                          Room Number / Block <span className="text-[10px] text-[var(--text-muted)]">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={wsRoomNumber}
                          onChange={(e) => setWsRoomNumber(e.target.value)}
                          placeholder="e.g. Room 204, Block C"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={wsSaveStatus === 'saving'}
                        onClick={() => {
                          setIsEditingWs(false);
                          setWsError('');
                          setWsFieldErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant={wsSaveStatus === 'saved' ? 'secondary' : 'primary'}
                        size="sm"
                        isLoading={wsSaveStatus === 'saving'}
                        disabled={wsSaveStatus === 'saving'}
                        icon={
                          wsSaveStatus === 'saved' ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )
                        }
                        className={wsSaveStatus === 'saved' ? 'border-[var(--success)]/40 text-[var(--success)]' : ''}
                      >
                        {wsSaveStatus === 'saving'
                          ? 'Saving...'
                          : wsSaveStatus === 'saved'
                          ? 'Saved'
                          : 'Save Workspace Identity'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text-muted)] text-center">
                No active workspace selected. Join or select a workspace to manage your workspace identity.
              </div>
            )}
          </GlassCard>

          {/* 3. DANGER ZONE */}
          <div className="pt-2">
            <div className="p-6 rounded-3xl bg-[var(--danger-light)]/10 border border-[var(--danger)]/30 space-y-4">
              <div className="flex items-center gap-2 text-[var(--danger)]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-base font-bold tracking-tight">Danger Zone</h4>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-[var(--text)]">Delete Account</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    Permanently delete your UNSAID account and personal profile data.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteError('');
                    setDeleteConfirmText('');
                    setReauthPassword('');
                    setIsDeleteModalOpen(true);
                  }}
                  icon={<Trash2 className="w-4 h-4" />}
                  className="shrink-0"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Account Deletion */}
      <ModalShell
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting && !isVerifyingGoogle) {
            setIsDeleteModalOpen(false);
            setDeleteError('');
            setDeleteConfirmText('');
            setReauthPassword('');
            setIsGoogleVerified(false);
          }
        }}
        title="Delete Account"
        subtitle="Permanently delete your UNSAID account and personal profile data."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting || isVerifyingGoogle}
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteError('');
                setDeleteConfirmText('');
                setReauthPassword('');
                setIsGoogleVerified(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={
                deleteConfirmText.trim() !== 'DELETE' ||
                (isPasswordAccount && !reauthPassword) ||
                (isGoogleAccount && !isGoogleVerified) ||
                isDeleting ||
                isVerifyingGoogle
              }
              isLoading={isDeleting}
              onClick={handleDeleteAccount}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {isDeleting ? 'Deleting Account...' : 'Delete Account'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-[var(--danger-light)]/20 border border-[var(--danger)]/30 text-xs text-[var(--danger)] space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>This action is permanent and cannot be undone</span>
            </div>
            <p className="leading-relaxed">
              Deleting your account immediately purges your authentication credentials and your personal records across all workspaces.
            </p>
          </div>

          {deleteError && (
            <div className="p-3 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          {isPasswordAccount && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Confirm your account password <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                required
                value={reauthPassword}
                onChange={(e) => {
                  setReauthPassword(e.target.value);
                  if (deleteError) setDeleteError('');
                }}
                placeholder="Enter your current password"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--danger)]"
              />
            </div>
          )}

          {isGoogleAccount && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)]">
              <span className="text-xs font-semibold text-[var(--text)] block">
                Google Identity Verification
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                You signed in with Google. Re-verify your Google account to confirm deletion.
              </p>
              <Button
                type="button"
                variant={isGoogleVerified ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleGoogleVerify}
                isLoading={isVerifyingGoogle}
                disabled={isVerifyingGoogle || isGoogleVerified}
                icon={isGoogleVerified ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : undefined}
                className={isGoogleVerified ? 'border-[var(--success)]/40 text-[var(--success)]' : ''}
              >
                {isGoogleVerified ? 'Google Identity Verified' : 'Verify with Google'}
              </Button>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              To proceed, please type <strong className="text-[var(--danger)] font-mono">DELETE</strong>:
            </label>
            <input
              type="text"
              required
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                if (deleteError) setDeleteError('');
              }}
              placeholder="Type DELETE"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--danger)]"
            />
          </div>
        </div>
      </ModalShell>
    </PageContainer>
  );
};

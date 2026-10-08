import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Building2,
  Briefcase,
  Home,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
} from 'lucide-react';

import { useWorkspace } from '../../hooks/useWorkspace';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  resolveWorkspaceDomainType,
  getRoleSuggestions,
  ACADEMIC_YEAR_OPTIONS,
  COURSE_SUGGESTIONS,
  validateWorkspaceIdentity,
} from '../../utils/identityProfile';
import { getFriendlyFirestoreErrorMessage } from '../../utils/firebaseErrors';

export const WorkspaceProfileModal = ({ isOpen, onClose, onSaved }) => {
  const {
    currentWorkspace,
    currentMembership,
    isCurrentWorkspaceAdmin,
    updateWorkspaceMemberProfile,
  } = useWorkspace();

  const domainType = resolveWorkspaceDomainType(currentWorkspace?.domain);
  const roleSuggestions = getRoleSuggestions(domainType, isCurrentWorkspaceAdmin);

  // Form states
  const [professionalRole, setProfessionalRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [institution, setInstitution] = useState('');
  const [organization, setOrganization] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [year, setYear] = useState('');
  const [course, setCourse] = useState('');
  const [customCourse, setCustomCourse] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const formRef = useRef(null);

  // Populate initial state from currentMembership
  useEffect(() => {
    if (isOpen && currentMembership) {
      const existingRole = currentMembership.professionalRole || '';
      const isPresetRole = roleSuggestions.includes(existingRole);

      if (isPresetRole) {
        setProfessionalRole(existingRole);
        setCustomRole('');
      } else if (existingRole) {
        setProfessionalRole('Other');
        setCustomRole(existingRole);
      } else {
        // Sensible default based on domain and admin status
        if (isCurrentWorkspaceAdmin) {
          setProfessionalRole(domainType === 'academic' ? 'Professor' : domainType === 'hostel' ? 'Warden' : 'Manager');
        } else {
          setProfessionalRole(domainType === 'academic' ? 'Student' : domainType === 'hostel' ? 'Resident' : 'Employee');
        }
        setCustomRole('');
      }

      setInstitution(currentMembership.institution || currentWorkspace?.name || '');
      setOrganization(currentMembership.organization || currentWorkspace?.name || '');
      setDepartment(currentMembership.department || '');
      setDesignation(currentMembership.designation || '');
      setYear(currentMembership.year || (domainType === 'academic' && !isCurrentWorkspaceAdmin ? '1st Year' : ''));

      const existingCourse = currentMembership.course || '';
      if (COURSE_SUGGESTIONS.includes(existingCourse)) {
        setCourse(existingCourse);
        setCustomCourse('');
      } else if (existingCourse) {
        setCourse('Other');
        setCustomCourse(existingCourse);
      } else {
        setCourse(domainType === 'academic' && !isCurrentWorkspaceAdmin ? 'B.Tech' : '');
        setCustomCourse('');
      }

      setRoomNumber(currentMembership.roomNumber || '');
      setError('');
      setFieldErrors({});
      setSaved(false);
    }
  }, [isOpen, currentMembership, currentWorkspace, domainType, isCurrentWorkspaceAdmin]);

  const effectiveRole = professionalRole === 'Other' ? customRole.trim() : professionalRole;
  const effectiveCourse = course === 'Other' ? customCourse.trim() : course;
  const isStudent = effectiveRole.toLowerCase() === 'student' || effectiveRole.toLowerCase() === 'student resident';

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (saving || saved) {
      return;
    }

    const profileData = {
      professionalRole: effectiveRole,
      profileType: domainType,
      department: (department || '').trim(),
      designation: (designation || '').trim(),
      year: isStudent || domainType === 'hostel' ? (year || '').trim() : '',
      course: isStudent ? effectiveCourse : '',
      roomNumber: domainType === 'hostel' ? (roomNumber || '').trim() : '',
    };

    if (domainType === 'corporate') {
      profileData.organization = ((organization || '').trim() || currentWorkspace?.name || '').trim();
    } else {
      profileData.institution = ((institution || '').trim() || currentWorkspace?.name || '').trim();
      if ((organization || '').trim()) {
        profileData.organization = organization.trim();
      }
    }

    // Validate
    const validation = validateWorkspaceIdentity(profileData, domainType);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      const errorMsgs = Object.values(validation.errors).filter(Boolean);
      setError(errorMsgs.join(' ') || 'Please fill in the required profile fields.');
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setFieldErrors({});
    setError('');
    setSaving(true);

    try {
      const updated = await updateWorkspaceMemberProfile(profileData);
      setSaved(true);
      if (onSaved) onSaved(updated);
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err) {
      console.error('[UNSAID Profile] Save error:', err);
      const isPerm = err?.code === 'permission-denied' || err?.message?.includes('permission-denied');
      const friendlyMsg = isPerm
        ? "You don't have permission to update this profile."
        : getFriendlyFirestoreErrorMessage(err, 'Unable to save your profile. Please try again.');
      setError(friendlyMsg);
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

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
    <ModalShell
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title={
        <div className="flex items-center gap-2">
          {getDomainIcon()}
          <span>{currentMembership?.profileCompleted ? 'Edit Workspace Identity' : 'Complete Workspace Identity'}</span>
        </div>
      }
      subtitle={`Configure who you are in "${currentWorkspace?.name || 'this workspace'}" (${currentWorkspace?.domain || 'workspace'}).`}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] min-w-0">
            <Shield className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" />
            <span className="truncate">Workspace-scoped profile</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {error && (
              <span className="text-[11px] text-[var(--danger)] font-medium hidden sm:inline truncate max-w-[200px]" title={error}>
                {error}
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="workspace-identity-form"
              variant="primary"
              size="sm"
              isLoading={saving}
              disabled={saving || saved}
              icon={saved ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Save className="w-3.5 h-3.5" />}
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="workspace-identity-form"
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1"
      >
        {/* Workspace & Permission Badge Overview */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--text)] block">
              {currentWorkspace?.name || 'Current Workspace'}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] capitalize">
              {domainType} domain · {currentWorkspace?.domain}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={isCurrentWorkspaceAdmin ? 'cyan' : 'primary'} size="sm">
              Permission: {isCurrentWorkspaceAdmin ? 'Admin' : 'Member'}
            </Badge>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[var(--danger-light)]/20 border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Professional Role / Occupation */}
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
            value={professionalRole}
            onChange={(e) => {
              setProfessionalRole(e.target.value);
              if (fieldErrors.professionalRole) {
                setFieldErrors((prev) => ({ ...prev, professionalRole: null }));
              }
            }}
            className={`w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] ${
              fieldErrors.professionalRole ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]/30' : 'border-[var(--glass-border)]'
            }`}
          >
            {roleSuggestions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {fieldErrors.professionalRole && (
            <p className="text-[11px] text-[var(--danger)]">{fieldErrors.professionalRole}</p>
          )}
        </div>

        {/* Custom Role write-in if "Other" */}
        {professionalRole === 'Other' && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Specify Your Role <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={customRole}
              onChange={(e) => {
                setCustomRole(e.target.value);
                if (fieldErrors.professionalRole) {
                  setFieldErrors((prev) => ({ ...prev, professionalRole: null }));
                }
              }}
              placeholder="e.g. Lab Technician, Visiting Faculty, Coordinator"
              className={`w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] ${
                fieldErrors.professionalRole ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]/30' : 'border-[var(--glass-border)]'
              }`}
            />
          </div>
        )}

        {/* 2. Institution / Organization */}
        {domainType === 'corporate' ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Organization / Company <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => {
                setOrganization(e.target.value);
                if (fieldErrors.organization) {
                  setFieldErrors((prev) => ({ ...prev, organization: null }));
                }
              }}
              placeholder="e.g. Acme Corporation"
              className={`w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] ${
                fieldErrors.organization ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]/30' : 'border-[var(--glass-border)]'
              }`}
            />
            {fieldErrors.organization && (
              <p className="text-[11px] text-[var(--danger)]">{fieldErrors.organization}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              {domainType === 'academic'
                ? 'College / University / Institution'
                : domainType === 'hostel'
                ? 'Hostel / Institution'
                : 'Institution / Organization'}{' '}
              <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => {
                setInstitution(e.target.value);
                if (fieldErrors.institution) {
                  setFieldErrors((prev) => ({ ...prev, institution: null }));
                }
              }}
              placeholder={domainType === 'academic' ? 'e.g. Oxford University / MIT' : 'e.g. Campus Living'}
              className={`w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] ${
                fieldErrors.institution ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]/30' : 'border-[var(--glass-border)]'
              }`}
            />
            {fieldErrors.institution && (
              <p className="text-[11px] text-[var(--danger)]">{fieldErrors.institution}</p>
            )}
          </div>
        )}

        {/* 3. Department */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Department / Division {domainType !== 'hostel' && <span className="text-[var(--danger)]">*</span>}
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              if (fieldErrors.department) {
                setFieldErrors((prev) => ({ ...prev, department: null }));
              }
            }}
            placeholder="e.g. Computer Science, Human Resources, Facilities"
            className={`w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] ${
              fieldErrors.department ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]/30' : 'border-[var(--glass-border)]'
            }`}
          />
          {fieldErrors.department && (
            <p className="text-[11px] text-[var(--danger)]">{fieldErrors.department}</p>
          )}
        </div>

        {/* 4. Student Specific Fields: Year & Course */}
        {isStudent && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] animate-fade-in">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Academic Year <span className="text-[var(--danger)]">*</span>
              </label>
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  if (fieldErrors.year) {
                    setFieldErrors((prev) => ({ ...prev, year: null }));
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl bg-[var(--surface)] border text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] ${
                  fieldErrors.year ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]/30' : 'border-[var(--glass-border)]'
                }`}
              >
                <option value="">Select Year</option>
                {ACADEMIC_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {fieldErrors.year && (
                <p className="text-[10px] text-[var(--danger)]">{fieldErrors.year}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Course / Program
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
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

            {course === 'Other' && (
              <div className="sm:col-span-2 space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Specify Course Name
                </label>
                <input
                  type="text"
                  value={customCourse}
                  onChange={(e) => setCustomCourse(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science and Engineering"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            )}
          </div>
        )}

        {/* 5. Non-student Designation (Staff / Corporate / Faculty) */}
        {!isStudent && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Designation / Title
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Associate Professor, Senior HR Manager, Lead Engineer"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}

        {/* 6. Hostel Room Number */}
        {domainType === 'hostel' && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Room Number / Block <span className="text-[10px] text-[var(--text-muted)]">(Optional)</span>
            </label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. Block B, Room 304"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}
      </form>
    </ModalShell>
  );
};

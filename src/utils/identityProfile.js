/**
 * UNSAID - Professional & Academic Identity Profile System
 * 
 * Provides utility constants, normalization, and validation for
 * workspace-scoped professional and academic identities.
 * 
 * Architecture Principle:
 * - Permission Role (Admin vs Member) controls authorization & security.
 * - Professional/Academic Role (Professor, Student, HR, Employee, etc.) describes
 *   who the person is within that specific workspace.
 * - Identities are workspace-scoped: one user can have different identities
 *   in different workspaces (e.g. Professor in College WS, Resident in Hostel WS).
 */

// Categorize workspace domain into high-level domain archetype
export const resolveWorkspaceDomainType = (domain) => {
  if (!domain || typeof domain !== 'string') return 'general';
  const clean = domain.trim().toLowerCase();

  if (
    clean === 'college' ||
    clean === 'university' ||
    clean === 'school' ||
    clean === 'academic' ||
    clean === 'campus' ||
    clean === 'institute' ||
    clean === 'institution'
  ) {
    return 'academic';
  }

  if (
    clean === 'hostel' ||
    clean === 'dorm' ||
    clean === 'housing' ||
    clean === 'residential' ||
    clean === 'residence'
  ) {
    return 'hostel';
  }

  if (
    clean === 'office' ||
    clean === 'corporate' ||
    clean === 'enterprise' ||
    clean === 'company' ||
    clean === 'business'
  ) {
    return 'corporate';
  }

  return 'general';
};

// Suggested professional / academic roles based on domain archetype and permission role
export const getRoleSuggestions = (domainType, isAdmin = false) => {
  if (isAdmin) {
    // Admin / Staff role presets
    switch (domainType) {
      case 'academic':
        return [
          'Professor',
          'Assistant Professor',
          'Associate Professor',
          'Teacher',
          'Lecturer',
          'HOD',
          'Principal',
          'Dean',
          'Staff',
          'IT Staff',
          'Lab Assistant',
          'Other',
        ];
      case 'hostel':
        return [
          'Warden',
          'Chief Warden',
          'Assistant Warden',
          'Hostel Supervisor',
          'Hostel Manager',
          'Staff',
          'Other',
        ];
      case 'corporate':
        return [
          'Manager',
          'HR',
          'HR Manager',
          'IT Staff',
          'Team Lead',
          'Director',
          'Operations Head',
          'Employee',
          'Other',
        ];
      default:
        return [
          'Manager',
          'Administrator',
          'Staff',
          'IT Staff',
          'HR',
          'Lead',
          'Other',
        ];
    }
  }

  // Member / User role presets
  switch (domainType) {
    case 'academic':
      return [
        'Student',
        'Research Scholar',
        'Teaching Assistant',
        'Intern',
        'Staff',
        'Employee',
        'Other',
      ];
    case 'hostel':
      return [
        'Resident',
        'Student Resident',
        'Employee Resident',
        'Floor Representative',
        'Other',
      ];
    case 'corporate':
      return [
        'Employee',
        'Software Engineer',
        'Associate',
        'Intern',
        'Contractor',
        'Consultant',
        'Team Member',
        'Other',
      ];
    default:
      return [
        'Member',
        'Student',
        'Employee',
        'Resident',
        'Staff',
        'Other',
      ];
  }
};

// Academic year options for students / residents
export const ACADEMIC_YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Postgraduate (1st Year)',
  'Postgraduate (2nd Year)',
  'Ph.D. Scholar',
  'Alumni',
  'Other',
];

// Common degree / course options with write-in capability
export const COURSE_SUGGESTIONS = [
  'B.Sc',
  'B.E',
  'B.Tech',
  'B.Com',
  'B.A',
  'BBA',
  'BCA',
  'M.Sc',
  'M.E',
  'M.Tech',
  'MBA',
  'MCA',
  'M.Com',
  'M.A',
  'Ph.D',
  'Diploma',
  'Other',
];

/**
 * Validates workspace identity fields based on domain and role.
 * Ensures required fields are provided without enforcing irrelevant fields.
 */
export const validateWorkspaceIdentity = (fields, domainType = 'general') => {
  const errors = {};
  const role = (fields.professionalRole || '').trim();

  if (!role) {
    errors.professionalRole = 'Professional or Academic role is required.';
  }

  const isStudent = role.toLowerCase() === 'student' || role.toLowerCase() === 'student resident';

  if (domainType === 'academic') {
    if (!fields.institution?.trim()) {
      errors.institution = 'Institution / College name is required.';
    }
    if (!fields.department?.trim()) {
      errors.department = 'Department is required.';
    }
    if (isStudent) {
      if (!fields.year?.trim()) {
        errors.year = 'Academic year is required for students.';
      }
    }
  } else if (domainType === 'corporate') {
    if (!fields.organization?.trim()) {
      errors.organization = 'Organization / Company name is required.';
    }
    if (!fields.department?.trim()) {
      errors.department = 'Department / Team is required.';
    }
  } else if (domainType === 'hostel') {
    if (!fields.institution?.trim() && !fields.organization?.trim()) {
      errors.institution = 'Hostel or Institution name is required.';
    }
  } else {
    // Generic
    if (!fields.institution?.trim() && !fields.organization?.trim()) {
      errors.organization = 'Institution or Organization name is required.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Formats a clean, compact representation of an identity profile
 * for use in Problem cards, modals, and Query Triage without exposing private data.
 */
export const formatCompactIdentity = (identity) => {
  if (!identity || typeof identity !== 'object') return null;

  const role = (identity.professionalRole || '').trim();
  const year = (identity.year || '').trim();
  const dept = (identity.department || '').trim();
  const inst = (identity.institution || identity.organization || '').trim();
  const course = (identity.course || '').trim();
  const designation = (identity.designation || '').trim();

  if (!role && !dept && !inst) return null;

  // Build primary subtitle: e.g. "Student • 2nd Year" or "Professor" or "HR Manager"
  let primaryRole = role || 'Member';
  if (role.toLowerCase() === 'student' && year) {
    primaryRole = `Student • ${year}`;
  } else if (designation && designation.toLowerCase() !== role.toLowerCase()) {
    primaryRole = `${role} (${designation})`;
  }

  // Build secondary context line: e.g. "Computer Science • B.Sc"
  let subContext = dept;
  if (course && course !== 'Other') {
    subContext = dept ? `${dept} · ${course}` : course;
  }

  return {
    primaryRole,
    department: dept,
    institution: inst,
    course,
    year,
    fullLine: [primaryRole, dept, inst].filter(Boolean).join(' · '),
  };
};

/**
 * Extracts only safe, permitted workspace profile fields for persistence.
 * Prevents client-side manipulation of permission role, user ID, workspace ID, etc.
 */
export const sanitizeWorkspaceProfileData = (fields) => {
  const safe = {};

  if (typeof fields.professionalRole === 'string') {
    safe.professionalRole = fields.professionalRole.trim().slice(0, 100);
  }
  if (typeof fields.profileType === 'string') {
    safe.profileType = fields.profileType.trim().slice(0, 50);
  }
  if (typeof fields.institution === 'string') {
    safe.institution = fields.institution.trim().slice(0, 150);
  }
  if (typeof fields.organization === 'string') {
    safe.organization = fields.organization.trim().slice(0, 150);
  }
  if (typeof fields.department === 'string') {
    safe.department = fields.department.trim().slice(0, 100);
  }
  if (typeof fields.designation === 'string') {
    safe.designation = fields.designation.trim().slice(0, 100);
  }
  if (typeof fields.year === 'string') {
    safe.year = fields.year.trim().slice(0, 50);
  }
  if (typeof fields.course === 'string') {
    safe.course = fields.course.trim().slice(0, 100);
  }
  if (typeof fields.roomNumber === 'string') {
    safe.roomNumber = fields.roomNumber.trim().slice(0, 50);
  }

  return safe;
};

/**
 * Quick Picks Configuration & Data Model
 * 
 * Provides contextual chips for rapid problem reporting.
 * Completely configurable per workspace with a clean fallback model.
 * Does not hardcode institution-specific categories into business logic.
 */

export const DEFAULT_QUICK_PICKS = [
  { id: 'wifi', label: 'Wi-Fi / Network', value: 'Wi-Fi & Network', category: 'Infrastructure', active: true },
  { id: 'transport', label: 'Transport / Bus', value: 'Transport & Parking', category: 'Logistics', active: true },
  { id: 'facilities', label: 'Facilities / Power', value: 'Facilities & Cleanliness', category: 'Operations', active: true },
  { id: 'access', label: 'ID / Access Gate', value: 'ID & Security Access', category: 'Security', active: true },
  { id: 'equipment', label: 'Equipment / Lab', value: 'Lab & Equipment', category: 'Academic', active: true },
  { id: 'safety', label: 'Emergency / Safety', value: 'Urgent Safety Issue', category: 'Emergency', active: true },
  { id: 'other', label: 'Other Inquiries', value: 'General Inquiry', category: 'General', active: true },
];

/**
 * Resolves quick picks for a workspace, prioritizing workspace-specific configurations.
 * 
 * @param {Array} [workspaceQuickPicks] Optional custom quick picks stored on the workspace document
 * @returns {Array} List of active quick pick objects
 */
export const getActiveQuickPicks = (workspaceQuickPicks = null) => {
  if (Array.isArray(workspaceQuickPicks) && workspaceQuickPicks.length > 0) {
    return workspaceQuickPicks.filter((qp) => qp && qp.active !== false);
  }
  return DEFAULT_QUICK_PICKS.filter((qp) => qp.active !== false);
};

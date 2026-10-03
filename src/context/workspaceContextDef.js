import { createContext } from 'react';

export const WorkspaceContext = createContext({
  workspaces: [],
  currentWorkspace: null,
  memberships: [],
  loading: true,
  switchWorkspace: () => {},
  createWorkspace: async () => {},
  generateInvite: async () => {},
  getWorkspaceInvites: async () => [],
  revokeInvite: async () => {},
  getInviteByToken: async () => {},
  requestJoinWorkspace: async () => {},
  getUserRequestForWorkspace: async () => {},
  getWorkspaceRequests: async () => [],
  reviewJoinRequest: async () => {},
  refreshWorkspaces: async () => {},
});

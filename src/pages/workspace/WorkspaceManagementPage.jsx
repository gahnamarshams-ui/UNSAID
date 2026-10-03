import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Users,
  Link2,
  CheckCircle,
  Trash2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

import { useWorkspace } from '../../hooks/useWorkspace';
import { useAuth } from '../../hooks/useAuth';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ModalShell } from '../../components/ui/ModalShell';
import { CreateWorkspaceModal } from '../../components/workspace/CreateWorkspaceModal';
import { GenerateInviteModal } from '../../components/workspace/GenerateInviteModal';
import { WorkspaceRequestsModal } from '../../components/workspace/WorkspaceRequestsModal';

export const WorkspaceManagementPage = () => {
  const { workspaces, currentWorkspace, switchWorkspace, deleteWorkspace, loading } = useWorkspace();
  const { currentUser, isAdmin } = useAuth();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalWorkspace, setInviteModalWorkspace] = useState(null);
  const [requestsModalWorkspace, setRequestsModalWorkspace] = useState(null);

  // Delete Workspace states
  const [deleteTargetWorkspace, setDeleteTargetWorkspace] = useState(null);
  const [wsConfirmName, setWsConfirmName] = useState('');
  const [isDeletingWs, setIsDeletingWs] = useState(false);
  const [deleteWsError, setDeleteWsError] = useState('');

  const handleDeleteWorkspace = async () => {
    if (!deleteTargetWorkspace) return;
    if (wsConfirmName.trim() !== deleteTargetWorkspace.name.trim()) {
      setDeleteWsError('Workspace name does not match. Please type the exact name to confirm.');
      return;
    }

    setDeleteWsError('');
    setIsDeletingWs(true);

    try {
      await deleteWorkspace(deleteTargetWorkspace.id);
      setDeleteTargetWorkspace(null);
      setWsConfirmName('');
    } catch (err) {
      console.error('[UNSAID Delete Workspace Error]', err);
      setDeleteWsError(err.message || 'Failed to delete workspace.');
    } finally {
      setIsDeletingWs(false);
    }
  };

  return (
    <PageContainer size="lg" className="space-y-8">
      {/* Header */}
      <SectionHeader
        title="Workspace Management"
        subtitle="Switch active resolution contexts, manage dynamic domains, and coordinate member access."
        badge={
          <Badge variant={isAdmin ? 'cyan' : 'primary'} size="sm">
            {isAdmin ? 'Admin Portal' : 'Member Directory'}
          </Badge>
        }
        action={
          isAdmin && (
            <div className="flex items-center gap-2">
              {currentWorkspace && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Users className="w-4 h-4" />}
                  onClick={() => setRequestsModalWorkspace(currentWorkspace)}
                >
                  Join Requests
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create Workspace
              </Button>
            </div>
          )
        }
      />

      {/* Grid of Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id;
          const isOwnerOrAdmin = isAdmin || ws.createdBy === currentUser?.uid || ws.userRole === 'admin';

          return (
            <GlassCard
              key={ws.id}
              glow={isActive}
              className={`p-6 space-y-4 flex flex-col justify-between transition-all ${
                isActive ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/40' : ''
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] text-white flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="cyan" size="sm">
                      {ws.domain}
                    </Badge>
                    {isActive && (
                      <Badge variant="low" size="sm" dot>
                        Active
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[var(--text)] line-clamp-1">
                    {ws.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                    {ws.description || 'Generic resolution and escalation workspace.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={isActive ? 'secondary' : 'primary'}
                    size="sm"
                    fullWidth
                    disabled={isActive}
                    onClick={() => switchWorkspace(ws.id)}
                    icon={isActive ? <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" /> : undefined}
                  >
                    {isActive ? 'Current Active' : 'Switch To'}
                  </Button>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      icon={<Link2 className="w-3.5 h-3.5" />}
                      onClick={() => setInviteModalWorkspace(ws)}
                    >
                      Generate Invite Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      icon={<Users className="w-3.5 h-3.5" />}
                      onClick={() => setRequestsModalWorkspace(ws)}
                    >
                      Requests
                    </Button>
                  </div>
                )}

                {isOwnerOrAdmin && (
                  <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
                      {ws.createdBy === currentUser?.uid ? 'Owner' : 'Admin'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[var(--danger)] hover:bg-[var(--danger-light)]/20 hover:text-[var(--danger)] px-2 py-1 h-auto"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setDeleteTargetWorkspace(ws);
                        setWsConfirmName('');
                        setDeleteWsError('');
                      }}
                    >
                      Delete Workspace
                    </Button>
                  </div>
                )}
              </div>
            </GlassCard>
          );
        })}

        {/* Empty State */}
        {!loading && workspaces.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <GlassCard variant="panel" className="max-w-md mx-auto p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text)]">No Approved Workspaces</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {isAdmin
                    ? 'Start by creating your first workspace for an institution or company.'
                    : 'Ask your organization administrator for an invite request link.'}
                </p>
              </div>
              {isAdmin && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCreateModalOpen(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Create First Workspace
                </Button>
              )}
            </GlassCard>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <GenerateInviteModal
        isOpen={Boolean(inviteModalWorkspace)}
        onClose={() => setInviteModalWorkspace(null)}
        workspace={inviteModalWorkspace}
      />

      <WorkspaceRequestsModal
        isOpen={Boolean(requestsModalWorkspace)}
        onClose={() => setRequestsModalWorkspace(null)}
        workspace={requestsModalWorkspace}
      />

      {/* Workspace Deletion Confirmation Modal */}
      <ModalShell
        isOpen={Boolean(deleteTargetWorkspace)}
        onClose={() => {
          if (!isDeletingWs) {
            setDeleteTargetWorkspace(null);
            setWsConfirmName('');
            setDeleteWsError('');
          }
        }}
        title="Delete Workspace"
        subtitle={`Permanently remove "${deleteTargetWorkspace?.name}" and its workspace-specific data.`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeletingWs}
              onClick={() => setDeleteTargetWorkspace(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={wsConfirmName.trim() !== deleteTargetWorkspace?.name.trim() || isDeletingWs}
              isLoading={isDeletingWs}
              onClick={handleDeleteWorkspace}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {isDeletingWs ? 'Deleting Workspace...' : 'Delete Workspace'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-[var(--danger-light)]/20 border border-[var(--danger)]/30 text-xs text-[var(--danger)] space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Delete this workspace?</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] pl-6">
              This will permanently remove the workspace and all its invitations, join requests, member associations, and reported queries. This action cannot be undone.
            </p>
          </div>

          {deleteWsError && (
            <div className="p-3 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-xs text-[var(--danger)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteWsError}</span>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Type the workspace name <span className="font-mono font-bold text-[var(--danger)]">{deleteTargetWorkspace?.name}</span> to confirm:
            </label>
            <input
              type="text"
              value={wsConfirmName}
              onChange={(e) => {
                setWsConfirmName(e.target.value);
                if (deleteWsError) setDeleteWsError('');
              }}
              placeholder={deleteTargetWorkspace?.name}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs font-mono text-[var(--text)] focus:outline-none"
            />
          </div>
        </div>
      </ModalShell>
    </PageContainer>
  );
};

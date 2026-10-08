import React, { useState } from 'react';
import { Sparkles, UserCheck, ArrowRight, X } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Button } from '../ui/Button';
import { WorkspaceProfileModal } from './WorkspaceProfileModal';
import { resolveWorkspaceDomainType } from '../../utils/identityProfile';

export const WorkspaceProfilePrompt = ({ className = '' }) => {
  const { currentWorkspace, currentMembership, isCurrentWorkspaceAdmin } = useWorkspace();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!currentWorkspace || !currentMembership || isDismissed) {
    return null;
  }

  const hasCompleted = Boolean(currentMembership.profileCompleted || currentMembership.professionalRole);
  if (hasCompleted) {
    return null;
  }

  const domainType = resolveWorkspaceDomainType(currentWorkspace.domain);
  const roleLabel =
    domainType === 'academic'
      ? isCurrentWorkspaceAdmin
        ? 'academic staff'
        : 'student / academic'
      : domainType === 'hostel'
      ? 'resident / warden'
      : domainType === 'corporate'
      ? 'professional'
      : 'identity';

  return (
    <>
      <div
        className={`relative overflow-hidden p-4 rounded-3xl bg-[var(--surface-hover)] border border-[var(--cyan)]/35 shadow-sm backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in ${className}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[var(--cyan)]/15 text-[var(--cyan)] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-[var(--text)] tracking-tight">
                Complete your workspace profile
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] border border-[var(--cyan)]/25">
                {currentWorkspace.name}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Set your {roleLabel} role and department to give your queries and resolutions clear organizational context.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] h-7 px-2"
            title="Dismiss for this session"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            icon={<UserCheck className="w-3.5 h-3.5" />}
            className="text-xs h-7"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
      </div>

      <WorkspaceProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

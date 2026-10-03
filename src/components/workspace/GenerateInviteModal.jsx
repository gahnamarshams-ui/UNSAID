import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Shield,
  Clock,
  Ban,
  RefreshCw,
  Link2,
  Calendar,
  Layers,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

import { useWorkspace } from '../../hooks/useWorkspace';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { GlassCard } from '../ui/GlassCard';
import { getFriendlyFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { buildInviteUrl, isLocalInviteUrl } from '../../utils/inviteUrl';

export const GenerateInviteModal = ({ isOpen, onClose, workspace }) => {
  const {
    workspaces,
    currentWorkspace,
    generateInvite,
    getWorkspaceInvites,
    revokeInvite,
  } = useWorkspace();

  // Active workspace resolution
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    () => workspace?.id || currentWorkspace?.id || workspaces[0]?.id || ''
  );

  const [activeInvite, setActiveInvite] = useState(null);
  const [invitesList, setInvitesList] = useState([]);
  const [generationStatus, setGenerationStatus] = useState('idle'); // 'idle' | 'generating' | 'success' | 'error'
  const [listLoading, setListLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [error, setError] = useState('');
  const [renderTimestamp, setRenderTimestamp] = useState(() => Date.now());

  // Synchronize selected workspace ID
  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (ignore) return;
      if (workspace?.id) {
        setSelectedWorkspaceId(workspace.id);
      } else if (!selectedWorkspaceId && currentWorkspace?.id) {
        setSelectedWorkspaceId(currentWorkspace.id);
      } else if (!selectedWorkspaceId && workspaces.length > 0) {
        setSelectedWorkspaceId(workspaces[0].id);
      }
    });
    return () => {
      ignore = true;
    };
  }, [workspace, currentWorkspace, workspaces, selectedWorkspaceId]);

  // Resolved workspace object
  const selectedWorkspace = useMemo(() => {
    if (workspace?.id) return workspace;
    if (selectedWorkspaceId) {
      return workspaces.find((w) => w.id === selectedWorkspaceId) || null;
    }
    return currentWorkspace || workspaces[0] || null;
  }, [workspace, selectedWorkspaceId, workspaces, currentWorkspace]);

  // Load existing invites whenever modal opens or active workspace changes
  const loadInvites = useCallback(
    async (wsId) => {
      const targetId = wsId || selectedWorkspace?.id;
      if (!targetId) return;

      setListLoading(true);
      setRenderTimestamp(Date.now());
      try {
        const list = await getWorkspaceInvites(targetId);
        setInvitesList(list);
        const now = Date.now();
        const currentActive = list.find((inv) => {
          if (inv.status !== 'active') return false;
          const expMs =
            inv.expiresAt?.toMillis?.() ||
            (inv.expiresAt instanceof Date ? inv.expiresAt.getTime() : null);
          return !expMs || now < expMs;
        });
        if (currentActive) {
          setActiveInvite(currentActive);
        }
      } catch (err) {
        console.error('[UNSAID Load Invites Error]', err);
      } finally {
        setListLoading(false);
      }
    },
    [selectedWorkspace?.id, getWorkspaceInvites]
  );

  useEffect(() => {
    let ignore = false;
    if (isOpen && selectedWorkspace?.id) {
      queueMicrotask(() => {
        if (!ignore) {
          setListLoading(true);
          setRenderTimestamp(Date.now());
        }
      });
      getWorkspaceInvites(selectedWorkspace.id)
        .then((list) => {
          if (!ignore) {
            setInvitesList(list);
            const now = Date.now();
            const currentActive = list.find((inv) => {
              if (inv.status !== 'active') return false;
              const expMs =
                inv.expiresAt?.toMillis?.() ||
                (inv.expiresAt instanceof Date ? inv.expiresAt.getTime() : null);
              return !expMs || now < expMs;
            });
            if (currentActive) {
              setActiveInvite((prev) => prev || currentActive);
            }
          }
        })
        .catch((err) => {
          if (!ignore) console.error('[UNSAID Load Invites Error]', err);
        })
        .finally(() => {
          if (!ignore) setListLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, selectedWorkspace?.id, getWorkspaceInvites]);

  const handleGenerate = async () => {
    // 1. Validate selected workspace
    if (!selectedWorkspace?.id) {
      setError('Select a workspace first.');
      setGenerationStatus('error');
      return;
    }

    setError('');
    setGenerationStatus('generating');

    try {
      // 2. Perform Firestore write and receive full invite record
      const invite = await generateInvite({
        workspaceId: selectedWorkspace.id,
        workspaceName: selectedWorkspace.name,
      });

      // 3. Update UI state only after Firestore write succeeds
      setActiveInvite(invite);
      setGenerationStatus('success');
      await loadInvites(selectedWorkspace.id);
    } catch (err) {
      console.error('[UNSAID Generate Invite Error]', err);
      const friendlyMsg = getFriendlyFirestoreErrorMessage(
        err,
        err.message || 'Failed to generate workspace invite link.'
      );
      const devDetail =
        import.meta.env.DEV && (err.code || err.message)
          ? ` (${err.code || 'error'}: ${err.message || ''})`
          : '';
      setError(`${friendlyMsg}${devDetail}`);
      setGenerationStatus('error');
    }
  };

  const handleCopy = (token, id = 'main') => {
    if (!token) return;
    const url = buildInviteUrl(token);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {
        fallbackCopyText(url);
      });
    } else {
      fallbackCopyText(url);
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2200);
  };

  const fallbackCopyText = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (err) {
      console.warn('[UNSAID Copy Fallback Error]', err);
    }
  };

  const handleRevoke = async (inviteId) => {
    if (!inviteId) return;
    setRevokingId(inviteId);
    try {
      await revokeInvite(inviteId);
      // Update local states
      setInvitesList((prev) =>
        prev.map((inv) => (inv.id === inviteId ? { ...inv, status: 'revoked' } : inv))
      );
      if (activeInvite?.id === inviteId) {
        setActiveInvite((prev) => (prev ? { ...prev, status: 'revoked' } : null));
      }
    } catch (err) {
      console.error('[UNSAID Revoke Invite Error]', err);
      const friendlyMsg = getFriendlyFirestoreErrorMessage(
        err,
        err.message || 'Failed to revoke invitation link.'
      );
      setError(friendlyMsg);
    } finally {
      setRevokingId(null);
    }
  };

  const handleClose = () => {
    setActiveInvite(null);
    setCopiedId(null);
    setError('');
    setGenerationStatus('idle');
    onClose();
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Indefinite';
    const date =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : typeof ts === 'number'
        ? new Date(ts)
        : null;
    if (!date) return 'N/A';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isInviteExpired = useCallback(
    (inv) => {
      if (!inv?.expiresAt) return false;
      const expMs =
        typeof inv.expiresAt.toMillis === 'function'
          ? inv.expiresAt.toMillis()
          : typeof inv.expiresAt.toDate === 'function'
          ? inv.expiresAt.toDate().getTime()
          : inv.expiresAt instanceof Date
          ? inv.expiresAt.getTime()
          : null;
      return expMs ? renderTimestamp > expMs : false;
    },
    [renderTimestamp]
  );

  const activeUrl = activeInvite?.token ? buildInviteUrl(activeInvite.token) : '';
  const activeIsExpired = useMemo(
    () => isInviteExpired(activeInvite),
    [isInviteExpired, activeInvite]
  );

  const isGenerating = generationStatus === 'generating';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Workspace Invite"
      subtitle={`Generate and manage access links for "${selectedWorkspace?.name || 'Workspace'}"`}
      maxWidth="lg"
    >
      <div className="space-y-6 pt-2">
        {/* Workspace Selector (shown when not constrained to a specific workspace prop) */}
        {!workspace?.id && workspaces.length > 0 && (
          <div className="space-y-1.5 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)]">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Target Workspace
            </label>
            <div className="relative">
              <select
                value={selectedWorkspaceId}
                onChange={(e) => {
                  setSelectedWorkspaceId(e.target.value);
                  setActiveInvite(null);
                  setError('');
                }}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer pr-10"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id} className="bg-[var(--surface-dark)] text-[var(--text)]">
                    {ws.name} ({ws.domain || 'organization'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Security Notice Pill */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-start gap-3">
          <Shield className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--text-secondary)] space-y-1">
            <strong className="block font-semibold text-[var(--text)]">
              Cryptographically Secure Request Flow
            </strong>
            <p className="leading-relaxed">
              Anyone with this link can request access. They must be authenticated before
              submitting a request, and will not gain access until an administrator approves.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Active Invite Card */}
        {activeInvite ? (
          <GlassCard variant="panel" glow className="p-5 space-y-4 border border-[var(--glass-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] flex items-center justify-center text-white shadow-sm">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text)]">
                    {selectedWorkspace?.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activeInvite.status === 'revoked' ? (
                      <Badge variant="high" size="sm" dot>
                        Revoked
                      </Badge>
                    ) : activeIsExpired ? (
                      <Badge variant="medium" size="sm" dot>
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="low" size="sm" dot>
                        Active Link
                      </Badge>
                    )}
                    <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires: {formatTimestamp(activeInvite.expiresAt || activeInvite.expiresAtDate)}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isGenerating}
                isLoading={isGenerating}
                onClick={handleGenerate}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {isGenerating ? 'Generating...' : 'Generate New Link'}
              </Button>
            </div>

            {/* URL Bar & Copy Button */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Invite URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeUrl}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs font-mono text-[var(--text)] select-all focus:outline-none"
                />
                <Button
                  type="button"
                  variant={copiedId === 'main' ? 'secondary' : 'primary'}
                  size="md"
                  onClick={() => handleCopy(activeInvite.token, 'main')}
                  icon={
                    copiedId === 'main' ? (
                      <Check className="w-4 h-4 text-[var(--success)]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )
                  }
                >
                  {copiedId === 'main' ? 'Copied' : 'Copy Link'}
                </Button>
                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--surface)] hover:bg-[var(--glass-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
                  title="Open invite link in new tab"
                  aria-label="Open invite link in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {isLocalInviteUrl(activeUrl) ? (
                <div className="p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-[11px] text-[var(--text-muted)] flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-[var(--warning)] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[var(--text-secondary)] font-medium">Local-Only Link:</strong> This URL is running on localhost and will only work on this machine. To share with phones/tablets on your local Wi-Fi, run Vite with <code className="px-1 py-0.5 rounded bg-[var(--surface)] font-mono text-[10px]">npm run dev -- --host</code> or configure <code className="px-1 py-0.5 rounded bg-[var(--surface)] font-mono text-[10px]">VITE_APP_BASE_URL</code> in your environment.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-[var(--success-light)]/20 border border-[var(--success)]/30 text-[11px] text-[var(--success)] flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>Shareable URL Ready:</strong> Using configured base URL for cross-device & external access.
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-[11px] border-t border-[var(--glass-border)] text-[var(--text-muted)]">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Created Time
                </span>
                <span>{formatTimestamp(activeInvite.createdAt)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Expiry Time
                </span>
                <span>{formatTimestamp(activeInvite.expiresAt || activeInvite.expiresAtDate)}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
                  Usage
                </span>
                <span>Used {activeInvite.usedCount || 0} times</span>
              </div>
            </div>
          </GlassCard>
        ) : (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-center mx-auto text-[var(--primary)]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--text)]">
                {selectedWorkspace?.name ? `Generate Link for ${selectedWorkspace.name}` : 'No active link selected'}
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedWorkspace?.name
                  ? `Generate a cryptographically secure 7-day invite link for ${selectedWorkspace.name}.`
                  : 'Select a workspace to generate an invite link.'}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={isGenerating}
              isLoading={isGenerating}
              onClick={handleGenerate}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {isGenerating ? 'Generating...' : 'Generate Invite Link'}
            </Button>
          </div>
        )}

        {/* Existing Invite Links Management Section */}
        <div className="space-y-3 pt-2 border-t border-[var(--glass-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--text-secondary)]" />
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Invite Management
              </h5>
              <Badge variant="cyan" size="sm">
                {invitesList.length}
              </Badge>
            </div>
            <button
              type="button"
              onClick={() => loadInvites(selectedWorkspace?.id)}
              disabled={listLoading}
              className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${listLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {listLoading ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)] animate-pulse">
              Loading invite links...
            </div>
          ) : invitesList.length === 0 ? (
            <p className="text-xs text-center py-4 text-[var(--text-muted)]">
              No previous invites recorded for this workspace.
            </p>
          ) : (
            <div className="divide-y divide-[var(--glass-border)] max-h-56 overflow-y-auto pr-1">
              {invitesList.map((inv) => {
                const expired = isInviteExpired(inv);
                const isRevoked = inv.status === 'revoked';
                const isSelected = activeInvite?.id === inv.id;

                let statusVariant = 'low';
                let statusLabel = 'Active';
                if (isRevoked) {
                  statusVariant = 'high';
                  statusLabel = 'Revoked';
                } else if (expired) {
                  statusVariant = 'medium';
                  statusLabel = 'Expired';
                }

                return (
                  <div
                    key={inv.id}
                    className={`py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl transition-colors ${
                      isSelected ? 'bg-[var(--glass-hover)] border border-[var(--primary)]/20' : 'hover:bg-[var(--glass-hover)]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-medium text-[var(--text)]">
                          ...{inv.token?.slice(-12) || inv.id?.slice(-8)}
                        </span>
                        <Badge variant={statusVariant} size="sm" dot>
                          {statusLabel}
                        </Badge>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Used: {inv.usedCount || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created: {formatTimestamp(inv.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires: {formatTimestamp(inv.expiresAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Button
                        type="button"
                        variant={copiedId === inv.id ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleCopy(inv.token, inv.id)}
                        icon={
                          copiedId === inv.id ? (
                            <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {copiedId === inv.id ? 'Copied' : 'Copy'}
                      </Button>

                      {!isRevoked && !expired && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          isLoading={revokingId === inv.id}
                          onClick={() => handleRevoke(inv.id)}
                          className="hover:border-[var(--danger)] hover:text-[var(--danger)]"
                          icon={<Ban className="w-3.5 h-3.5" />}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};

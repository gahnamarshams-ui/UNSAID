import React, { useState } from 'react';
import {
  Clock,
  User,
  ThumbsUp,
  Tag,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Bot,
  Layers,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { updateProblemStatus } from '../../services/problemService';

export const ProblemDetailsModal = ({
  isOpen,
  onClose,
  problem,
  workspace,
  onStatusChanged,
}) => {
  const [updating, setUpdating] = useState(false);

  if (!problem) return null;

  const isEmergency = problem.isEmergency || problem.priority === 'emergency';
  const isSolved = problem.status === 'solved';

  const formatTimestamp = (ts) => {
    if (!ts) return 'Unknown';
    const date =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : typeof ts === 'string' || typeof ts === 'number'
        ? new Date(ts)
        : null;
    if (!date) return 'Recently';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleToggleStatus = async () => {
    setUpdating(true);
    try {
      const nextStatus = isSolved ? 'open' : 'solved';
      await updateProblemStatus(problem.id, nextStatus, workspace?.id || problem.workspaceId);
      if (onStatusChanged) {
        onStatusChanged(problem.id, nextStatus);
      }
    } catch (err) {
      console.error('[UNSAID Problem Details] Status update failed:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Query Details</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--glass-border)]">
            #{problem.id.length > 8 ? problem.id.slice(-6).toUpperCase() : problem.id}
          </span>
        </div>
      }
      subtitle={`Detailed query triage for ${workspace?.name || 'current workspace'}.`}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant={isSolved ? 'secondary' : 'primary'}
            size="sm"
            loading={updating}
            icon={isSolved ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            onClick={handleToggleStatus}
          >
            {isSolved ? 'Reopen Query' : 'Mark as Solved'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Meta Header Grid */}
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Priority
            </span>
            <div className="mt-1">
              {isEmergency ? (
                <Badge variant="high" size="sm" dot>
                  EMERGENCY
                </Badge>
              ) : (
                <Badge variant="medium" size="sm">
                  Normal
                </Badge>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Status
            </span>
            <div className="mt-1">
              {isSolved ? (
                <Badge variant="success" size="sm" dot>
                  SOLVED
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" dot>
                  OPEN
                </Badge>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Category
            </span>
            <div className="mt-1">
              <Badge variant="cyan" size="sm">
                {problem.category || 'General'}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Community Votes
            </span>
            <div className="mt-1 flex items-center gap-1 text-xs font-bold text-[var(--primary)]">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{problem.upvotesCount || problem.upvotedBy?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-[var(--text)]">
            {problem.title || 'Untitled Query'}
          </h3>
          <div className="p-4 rounded-xl bg-[var(--surface)]/70 border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {problem.description || 'No description provided.'}
          </div>
        </div>

        {/* Workaround if present */}
        {problem.workaround && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--warning)]" />
              Suggested Workaround / Temporary Fix
            </span>
            <div className="p-3.5 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-xs text-[var(--text)] whitespace-pre-wrap">
              {problem.workaround}
            </div>
          </div>
        )}

        {/* Attached Photo Evidence */}
        {problem.imageUrl && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[var(--primary)]" />
              Attached Photo Evidence
            </span>
            <div className="rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-[var(--surface)] max-h-72 flex items-center justify-center p-2">
              <img
                src={problem.imageUrl}
                alt={problem.title || 'Query Photo Evidence'}
                className="max-h-64 max-w-full rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        )}

        {/* AI Triage Information (Part 5 Forward-Compatible) */}
        <div className="p-3.5 rounded-xl bg-[var(--cyan)]/10 border border-[var(--cyan)]/20 flex items-start gap-3">
          <Bot className="w-5 h-5 text-[var(--cyan)] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[var(--cyan)] flex items-center gap-1.5">
              <span>AI Priority & Deduplication Analysis</span>
              <Badge variant="cyan" size="sm">Part 5 Roadmap</Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Automated cluster classification, similarity scoring, and Gemini Flash resolution proposals will be activated in Part 5.
            </p>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="border-t border-[var(--glass-border)] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--text-muted)]" />
            <span>
              Reported by:{' '}
              <strong className="text-[var(--text)] font-medium">
                {problem.authorName || 'Workspace Member'}
              </strong>{' '}
              {problem.authorEmail ? `(${problem.authorEmail})` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Created: {formatTimestamp(problem.createdAt)}</span>
          </div>

          {problem.shiftStatus && (
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Shift Context: {problem.shiftStatus}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="font-mono text-[11px] truncate">
              Doc ID: {problem.id}
            </span>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

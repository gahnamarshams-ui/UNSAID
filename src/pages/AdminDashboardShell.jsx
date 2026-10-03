import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Users,
  Bot,
  Clock,
  ExternalLink,
  Inbox,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react';

import { useWorkspace } from '../hooks/useWorkspace';
import { PageContainer } from '../components/layout/PageContainer';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { GenerateInviteModal } from '../components/workspace/GenerateInviteModal';
import { WorkspaceRequestsModal } from '../components/workspace/WorkspaceRequestsModal';
import { ProblemDetailsModal } from '../components/problem/ProblemDetailsModal';
import { subscribeToWorkspaceProblems } from '../services/problemService';

/**
 * AdminDashboardShell Page
 * Live administration console for workspace managers.
 * Connects directly to Firestore problems scoped strictly by current workspace ID.
 */
export const AdminDashboardShell = () => {
  const { currentWorkspace } = useWorkspace();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);

  // Real-time Firestore workspace problems state
  const [problems, setProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [errorProblems, setErrorProblems] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);

  const wsId = currentWorkspace?.id;

  // Real-time subscription strictly scoped to active workspace
  useEffect(() => {
    let isCancelled = false;

    if (!wsId) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setProblems([]);
          setLoadingProblems(false);
          setErrorProblems(null);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setLoadingProblems(true);
        setErrorProblems(null);
      }
    });

    const unsubscribe = subscribeToWorkspaceProblems(
      wsId,
      (data) => {
        if (!isCancelled) {
          setProblems(data);
          setLoadingProblems(false);
          setErrorProblems(null);
        }
      },
      (err) => {
        if (!isCancelled) {
          console.error('[AdminDashboard] Problem subscription error:', err);
          setErrorProblems('Unable to load workspace queries. Please try again.');
          setLoadingProblems(false);
        }
      }
    );

    return () => {
      isCancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [wsId]);

  // Derived real-time metrics for current workspace
  const metrics = useMemo(() => {
    const total = problems.length;
    const emergencyCount = problems.filter(
      (p) => p.isEmergency || p.priority === 'emergency'
    ).length;
    const openCount = problems.filter((p) => p.status === 'open').length;
    const solvedCount = problems.filter((p) => p.status === 'solved').length;
    return { total, emergencyCount, openCount, solvedCount };
  }, [problems]);

  const formatTimestamp = (ts) => {
    if (!ts) return 'Just now';
    const date =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : typeof ts === 'string' || typeof ts === 'number'
        ? new Date(ts)
        : null;
    if (!date) return 'Recently';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <PageContainer size="lg" className="space-y-8">
      {/* 1. Header */}
      <SectionHeader
        title="Admin Control Center"
        subtitle={
          currentWorkspace
            ? `Managing: ${currentWorkspace.name} (${currentWorkspace.domain}) · Verified administrator console.`
            : 'No active workspace selected. Select or create a workspace to manage.'
        }
        badge={
          <Badge variant="cyan" size="sm" dot>
            {currentWorkspace ? currentWorkspace.domain : 'Admin Mode'}
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            {currentWorkspace && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRequestsModalOpen(true)}
                >
                  Join Requests
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                >
                  Generate Invite Link
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* 2. Admin Live Analytics Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <GlassCard glow className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Escalation Queue</span>
            <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems ? '--' : metrics.emergencyCount}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics.emergencyCount > 0
              ? `${metrics.emergencyCount} emergency ${metrics.emergencyCount === 1 ? 'alert' : 'alerts'} pending`
              : 'Zero active emergency alerts'}
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Resolved Queries</span>
            <Clock className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems ? '--' : metrics.solvedCount}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics.solvedCount} resolved of {metrics.total} total
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>AI Summaries Generated</span>
            <Bot className="w-4 h-4 text-[var(--cyan)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">--</div>
          <p className="text-xs text-[var(--text-muted)]">
            Gemini Flash integration in Part 5
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Total Queries</span>
            <Users className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems ? '--' : metrics.total}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics.openCount} open · {metrics.solvedCount} solved
          </p>
        </GlassCard>
      </section>

      {/* 3. Triage Queue Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
            <span>Pending Escalation Queue</span>
            <Badge variant="high" size="sm">
              Live Triage
            </Badge>
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            {problems.length} {problems.length === 1 ? 'query' : 'queries'} in{' '}
            {currentWorkspace?.name || 'workspace'}
          </span>
        </div>

        {/* Real Triage Table Panel */}
        <GlassCard variant="panel" className="overflow-x-auto p-0 border border-[var(--glass-border)]">
          {loadingProblems ? (
            <div className="py-16 text-center text-sm text-[var(--text-muted)] flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span>Loading workspace queries...</span>
            </div>
          ) : errorProblems ? (
            <div className="py-14 text-center text-sm text-[var(--danger)] flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <span>Unable to load workspace queries. Please try again.</span>
            </div>
          ) : problems.length === 0 ? (
            <div className="py-16 text-center text-sm text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
              <Inbox className="w-8 h-8 opacity-40 text-[var(--text-muted)]" />
              <p className="font-semibold text-[var(--text)]">No problems reported yet</p>
              <p className="text-xs text-[var(--text-muted)] max-w-sm">
                When members submit queries for {currentWorkspace?.name || 'this workspace'}, they will appear here in real-time.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--glass-border)] text-xs font-semibold uppercase text-[var(--text-muted)] bg-[var(--surface)]">
                  <th className="py-3 px-4">Query ID</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Subject & Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">AI Category</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)] text-sm">
                {problems.map((prob) => {
                  const isEmergency = prob.isEmergency || prob.priority === 'emergency';
                  const queryId = prob.id
                    ? `#${prob.id.length > 7 ? prob.id.slice(-6).toUpperCase() : prob.id}`
                    : '#---';
                  const isSolved = prob.status === 'solved';

                  return (
                    <tr
                      key={prob.id}
                      className={`hover:bg-[var(--glass-hover)] transition-colors ${
                        isEmergency ? 'bg-[var(--danger)]/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                        {queryId}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isEmergency ? (
                          <Badge variant="high" size="sm" dot>
                            EMERGENCY
                          </Badge>
                        ) : (
                          <Badge variant="medium" size="sm">
                            Normal
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs md:max-w-sm">
                        <div className="font-medium text-[var(--text)] truncate">
                          {prob.title || 'Untitled Query'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          {prob.description || 'No description provided'}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-muted)]">
                          <span>By {prob.authorName || prob.authorEmail || 'Member'}</span>
                          <span>•</span>
                          <span>{formatTimestamp(prob.createdAt)}</span>
                          {(prob.upvotesCount > 0 || prob.upvotedBy?.length > 0) && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5 text-[var(--primary)] font-medium">
                                <ThumbsUp className="w-3 h-3" />
                                {prob.upvotesCount || prob.upvotedBy?.length}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="cyan" size="sm">
                          {prob.category || 'General'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isSolved ? (
                          <Badge variant="success" size="sm" dot>
                            SOLVED
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm" dot>
                            OPEN
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--cyan)] font-medium">
                          <Bot className="w-3.5 h-3.5" /> Pending Gemini (Pt.5)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconRight={<ExternalLink className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedProblem(prob)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </GlassCard>
      </section>

      {/* Admin Modals */}
      <GenerateInviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        workspace={currentWorkspace}
      />

      <WorkspaceRequestsModal
        isOpen={requestsModalOpen}
        onClose={() => setRequestsModalOpen(false)}
        workspace={currentWorkspace}
      />

      <ProblemDetailsModal
        isOpen={Boolean(selectedProblem)}
        onClose={() => setSelectedProblem(null)}
        problem={selectedProblem}
        workspace={currentWorkspace}
        onStatusChanged={(probId, nextStatus) => {
          setProblems((prev) =>
            prev.map((p) => (p.id === probId ? { ...p, status: nextStatus } : p))
          );
          if (selectedProblem?.id === probId) {
            setSelectedProblem((prev) => (prev ? { ...prev, status: nextStatus } : null));
          }
        }}
      />
    </PageContainer>
  );
};

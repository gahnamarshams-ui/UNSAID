import React, { useState, useMemo } from 'react';
import {
  Clock,
  ThumbsUp,
  Search,
  Inbox,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { toggleProblemUpvote } from '../../services/problemService';

export const ProblemFeed = ({
  problems = [],
  loading = false,
  workspace,
  currentUser,
  onOpenReportModal,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'emergency' | 'solved'
  const [upvotingId, setUpvotingId] = useState(null);

  const filteredProblems = useMemo(() => {
    return problems.filter((prob) => {
      // Status filtering
      if (statusFilter === 'open' && prob.status !== 'open') return false;
      if (statusFilter === 'solved' && prob.status !== 'solved') return false;
      if (statusFilter === 'emergency' && !prob.isEmergency) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = prob.title?.toLowerCase().includes(q);
        const matchesDesc = prob.description?.toLowerCase().includes(q);
        const matchesCategory = prob.category?.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesCategory;
      }

      return true;
    });
  }, [problems, statusFilter, searchQuery]);

  const handleUpvote = async (problemId) => {
    if (!currentUser?.uid || !workspace?.id || upvotingId === problemId) return;
    setUpvotingId(problemId);
    try {
      await toggleProblemUpvote(problemId, currentUser.uid, workspace.id);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('[UNSAID Upvote Error]', err);
    } finally {
      setUpvotingId(null);
    }
  };

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
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problems by keyword or category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            All ({problems.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('emergency')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'emergency'
                ? 'bg-[var(--danger)] text-white border-[var(--danger)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--danger)]'
            }`}
          >
            Emergency ({problems.filter((p) => p.isEmergency).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'open'
                ? 'bg-[var(--cyan)] text-white border-[var(--cyan)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            Open ({problems.filter((p) => p.status === 'open').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('solved')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'solved'
                ? 'bg-[var(--success)] text-white border-[var(--success)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            Solved ({problems.filter((p) => p.status === 'solved').length})
          </button>
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[var(--text-muted)] animate-pulse">
          Loading workspace queries...
        </div>
      ) : filteredProblems.length === 0 ? (
        <GlassCard variant="panel" className="py-14 px-6 text-center space-y-3 border border-[var(--glass-border)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[var(--text)]">
              {searchQuery ? 'No matching problems found' : 'No queries yet'}
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search terms or filter selection.'
                : 'Be the first to raise a problem in this workspace.'}
            </p>
          </div>
          {onOpenReportModal && !searchQuery && (
            <div className="pt-2">
              <Button variant="primary" size="sm" onClick={onOpenReportModal}>
                New Query
              </Button>
            </div>
          )}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProblems.map((prob) => {
            const hasUserUpvoted = currentUser?.uid && prob.upvotedBy?.includes(currentUser.uid);
            const isEmergency = Boolean(prob.isEmergency);
            const isSolved = prob.status === 'solved';

            return (
              <GlassCard
                key={prob.id}
                glow={isEmergency}
                className={`p-5 space-y-3.5 transition-all ${
                  isEmergency
                    ? 'border-2 border-[var(--danger)]/70 ring-2 ring-[var(--danger)]/20 shadow-md animate-pulse motion-reduce:animate-none bg-[var(--danger-light)]/20'
                    : isSolved
                    ? 'border border-[var(--glass-border)] opacity-65 bg-[var(--surface)]/40 hover:opacity-100'
                    : 'border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]'
                }`}
              >
                {/* Header Row: Category, Emergency Tag, and Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {isEmergency && (
                      <Badge variant="high" size="sm" dot>
                        EMERGENCY
                      </Badge>
                    )}
                    <Badge variant="cyan" size="sm">
                      {prob.category || 'General'}
                    </Badge>
                    {prob.shiftStatus && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        · {prob.shiftStatus}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={prob.status === 'solved' ? 'low' : isEmergency ? 'high' : 'medium'}
                      size="sm"
                    >
                      {prob.status === 'solved' ? 'SOLVED' : 'OPEN'}
                    </Badge>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[var(--text)] tracking-tight">
                    {prob.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                    {prob.description}
                  </p>
                </div>

                {/* Proposed Workaround if present */}
                {prob.workaround && (
                  <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs space-y-1">
                    <span className="font-semibold text-[var(--text)] block text-[11px]">
                      💡 Community Workaround:
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                      {prob.workaround}
                    </p>
                  </div>
                )}

                {/* Attached Photo Evidence Preview */}
                {prob.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-[var(--glass-border)] bg-[var(--surface)] max-h-52 flex items-center justify-center">
                    <img
                      src={prob.imageUrl}
                      alt={prob.title || 'Attached evidence'}
                      className="max-h-52 w-full object-cover rounded-xl"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Footer: Author, Timestamp, Upvote Action */}
                <div className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    {prob.isAnonymous ? (
                      <span className="font-semibold font-mono text-[var(--cyan)]" title="Anonymous Workspace Member">
                        {prob.authorName || 'Anon Member'}
                      </span>
                    ) : (
                      <span className="font-medium text-[var(--text)]">
                        {prob.authorName || 'Member'}
                      </span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(prob.createdAt)}
                    </span>
                  </div>

                  {/* Upvote Button */}
                  <button
                    type="button"
                    disabled={upvotingId === prob.id}
                    onClick={() => handleUpvote(prob.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                      hasUserUpvoted
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                        : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text)]'
                    }`}
                    title="Upvote this problem to increase visibility"
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${hasUserUpvoted ? 'fill-current' : ''}`} />
                    <span>{prob.upvotesCount || 0}</span>
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

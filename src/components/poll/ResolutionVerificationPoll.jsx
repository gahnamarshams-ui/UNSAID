import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Eye,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Award,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  VERIFICATION_OPTIONS,
  VERIFICATION_OPTION_LABELS,
  subscribeToVerificationPoll,
  subscribeToVerificationVotes,
  submitVerificationVote,
  computeVoteMetrics,
} from '../../services/verificationPollService';

/**
 * ResolutionVerificationPoll
 *
 * Implements Per-Problem Public Resolution Verification Poll with
 * Unanimous Affected-User Verification (Sections 1-20, 31-33).
 *
 * Information Hierarchy follows reference:
 *   Title: "Ur Queries"
 *   Subtitle: "Select one or more"
 *   Three large poll options:
 *     1. Solved
 *     2. Partially solved
 *     3. Not solved
 *   Timer / Timestamp
 *   "View votes" action
 */
export const ResolutionVerificationPoll = ({
  problem,
  workspaceId,
  currentUser,
  userProfile,
  isAdmin = false,
  onStatusChanged,
  onProblemUpdated,
}) => {
  const problemId = problem?.id;
  const currentPollId = problem?.currentPollId || (problemId ? `${problemId}_c${problem?.resolutionCycle || 1}` : null);

  const [poll, setPoll] = useState(null);
  const [votesData, setVotesData] = useState({
    votes: [],
    counts: { SOLVED: 0, PARTIALLY_SOLVED: 0, NOT_SOLVED: 0 },
    percentages: { SOLVED: 0, PARTIALLY_SOLVED: 0, NOT_SOLVED: 0 },
    totalVotes: 0,
    unresolvedUsers: [],
  });

  const [loadingPoll, setLoadingPoll] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [voteSuccessMessage, setVoteSuccessMessage] = useState('');
  const [showViewVotesModal, setShowViewVotesModal] = useState(false);
  const [isChangingVote, setIsChangingVote] = useState(false);
  const [elapsedString, setElapsedString] = useState('00:00');

  // 1. Subscribe to Verification Poll Doc
  useEffect(() => {
    let ignore = false;
    if (!currentPollId && !problemId) {
      queueMicrotask(() => {
        if (!ignore) {
          setPoll(null);
          setLoadingPoll(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!ignore) setLoadingPoll(true);
    });

    const unsub = subscribeToVerificationPoll(
      currentPollId,
      (data) => {
        if (!ignore) {
          setPoll(data);
          setLoadingPoll(false);
        }
      },
      (err) => {
        if (!ignore) {
          console.warn('[UNSAID Poll Sub Error]', err);
          setLoadingPoll(false);
        }
      },
      problemId
    );

    return () => {
      ignore = true;
      if (typeof unsub === 'function') unsub();
    };
  }, [currentPollId, problemId]);

  // 2. Subscribe to Verification Votes Collection
  useEffect(() => {
    let ignore = false;
    if (!currentPollId && !problemId) {
      queueMicrotask(() => {
        if (!ignore) {
          setVotesData({
            votes: [],
            counts: { SOLVED: 0, PARTIALLY_SOLVED: 0, NOT_SOLVED: 0 },
            percentages: { SOLVED: 0, PARTIALLY_SOLVED: 0, NOT_SOLVED: 0 },
            totalVotes: 0,
            unresolvedUsers: [],
          });
        }
      });
      return;
    }

    const unsub = subscribeToVerificationVotes(
      currentPollId,
      (data) => {
        if (!ignore) {
          setVotesData(data);
        }
      },
      (err) => {
        if (!ignore) {
          console.warn('[UNSAID Votes Sub Error]', err);
        }
      },
      problemId
    );

    return () => {
      ignore = true;
      if (typeof unsub === 'function') unsub();
    };
  }, [currentPollId, problemId]);

  // 3. Derive effective poll either from Firestore verificationPolls doc or from problem's officialResolution
  const effectivePoll = useMemo(() => {
    if (poll) return poll;
    if (problem?.officialResolution) {
      const res = problem.officialResolution;
      const rawAffected = Array.isArray(problem.affectedUserIds) && problem.affectedUserIds.length > 0
        ? problem.affectedUserIds
        : [problem.authorId || problem.createdBy].filter(Boolean);
      const eligibleUserIds = Array.from(new Set(rawAffected));
      const eligibleUserCount = Math.max(1, eligibleUserIds.length);
      const eligibleReporters = Array.isArray(problem.reporters) && problem.reporters.length > 0
        ? problem.reporters.filter((r) => r && eligibleUserIds.includes(r.userId))
        : eligibleUserIds.map((uid) => ({
            userId: uid,
            userName: uid === problem.authorId ? (problem.authorName || 'Reporter') : 'Affected User',
            isAnonymous: Boolean(problem.isAnonymous && uid === problem.authorId),
            pseudonym: problem.pseudonym || null,
          }));

      return {
        id: problem.currentPollId || `${problem.id}_c${problem.resolutionCycle || 1}`,
        problemId: problem.id,
        problemTitle: problem.title || 'Untitled Problem',
        workspaceId: workspaceId || problem.workspaceId,
        cycleNumber: problem.resolutionCycle || 1,
        resolutionId: res.resolutionId || `${problem.id}_res_${problem.resolutionCycle || 1}`,
        resolutionText: res.resolutionText || res.summary || '',
        actionTaken: res.actionTaken || '',
        resolvedBy: res.resolvedBy,
        resolvedByName: res.resolvedByName,
        resolvedAt: res.resolvedAt,
        status: problem.status === 'solved' ? 'solved' : problem.status === 'reopened' ? 'reopened' : 'active',
        eligibleUserIds,
        eligibleUserCount,
        eligibleReporters,
        stats: problem.verificationStats || {
          solved: 0,
          partiallySolved: 0,
          notSolved: 0,
          unresolved: 0,
          totalVotes: 0,
          eligibleCount: eligibleUserCount,
        },
        unresolvedUsers: problem.unresolvedUsers || [],
      };
    }
    return null;
  }, [poll, problem, workspaceId]);

  // 3. Live Elapsed Timer (Section 6 & 31: displays real elapsed time, e.g. 00:50)
  useEffect(() => {
    let ignore = false;
    const startTime = effectivePoll?.resolvedAt || effectivePoll?.createdAt;
    if (!startTime) {
      queueMicrotask(() => {
        if (!ignore) setElapsedString('00:00');
      });
      return;
    }

    const computeElapsed = () => {
      const start = new Date(startTime).getTime();
      if (isNaN(start)) return '00:00';
      const diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
      const ss = String(diffSec % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    };

    queueMicrotask(() => {
      if (!ignore) setElapsedString(computeElapsed());
    });
    const interval = setInterval(() => {
      if (!ignore) setElapsedString(computeElapsed());
    }, 1000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [effectivePoll?.resolvedAt, effectivePoll?.createdAt]);

  // Identify Effective Votes Data (from real-time collection or authoritative problem doc verificationStats)
  const effectiveVotesData = useMemo(() => {
    if (votesData?.votes && votesData.votes.length > 0) {
      return votesData;
    }
    const stats = problem?.verificationStats || effectivePoll?.stats;
    if (stats?.votes) {
      const currentCycle = Number(effectivePoll?.cycleNumber) || Number(problem?.resolutionCycle) || 1;
      const cycleVotes = Object.values(stats.votes).filter(
        (v) => (Number(v?.cycleNumber) || 1) === currentCycle
      );
      if (cycleVotes.length > 0) {
        return computeVoteMetrics(cycleVotes);
      }
    }
    return votesData;
  }, [votesData, problem?.verificationStats, effectivePoll?.stats, effectivePoll?.cycleNumber, problem?.resolutionCycle]);

  // Identify Current User's Vote
  const myVoteDoc = useMemo(() => {
    if (!currentUser?.uid) return null;
    return effectiveVotesData.votes.find((v) => v.userId === currentUser.uid) || null;
  }, [effectiveVotesData.votes, currentUser?.uid]);

  const myOption = myVoteDoc?.option || null;

  // Eligibility Check (Requirement 4)
  const isEligibleToVote = useMemo(() => {
    if (!currentUser?.uid) return false;
    // Check poll snapshot first
    if (Array.isArray(effectivePoll?.eligibleUserIds) && effectivePoll.eligibleUserIds.length > 0) {
      return effectivePoll.eligibleUserIds.includes(currentUser.uid);
    }
    // Fallback to problem affected list
    const pUsers = Array.isArray(problem?.affectedUserIds) ? problem.affectedUserIds : [];
    if (pUsers.includes(currentUser.uid)) return true;
    if (Array.isArray(problem?.reporters) && problem.reporters.some((r) => (r?.userId || r?.id) === currentUser.uid)) return true;
    return problem?.authorId === currentUser.uid || problem?.createdBy === currentUser.uid;
  }, [effectivePoll?.eligibleUserIds, problem?.affectedUserIds, problem?.reporters, problem?.authorId, problem?.createdBy, currentUser?.uid]);

  const eligibleCount = Math.max(
    1,
    Number(effectivePoll?.eligibleUserCount || effectivePoll?.eligibleUserIds?.length || problem?.affectedUserCount || 1)
  );

  // Grouped Voters for "View votes" Modal
  const solvedVoters = useMemo(
    () => effectiveVotesData.votes.filter((v) => v.option === VERIFICATION_OPTIONS.SOLVED),
    [effectiveVotesData.votes]
  );
  const partiallySolvedVoters = useMemo(
    () => effectiveVotesData.votes.filter((v) => v.option === VERIFICATION_OPTIONS.PARTIALLY_SOLVED),
    [effectiveVotesData.votes]
  );
  const notSolvedVoters = useMemo(
    () => effectiveVotesData.votes.filter((v) => v.option === VERIFICATION_OPTIONS.NOT_SOLVED),
    [effectiveVotesData.votes]
  );

  // Pending Affected Voters who haven't voted yet
  const pendingVoters = useMemo(() => {
    const votedUids = new Set(effectiveVotesData.votes.map((v) => v.userId));
    const allReporters = effectivePoll?.eligibleReporters || [];
    return allReporters.filter((r) => !votedUids.has(r.userId));
  }, [effectiveVotesData.votes, effectivePoll?.eligibleReporters]);

  // Handle Option Click / Vote Submission
  const handleSelectOption = async (optionKey) => {
    if (submittingVote || !isEligibleToVote || !currentUser?.uid) return;
    if (effectivePoll?.status === 'solved') return; // Locked once final solved

    setVoteError('');
    setVoteSuccessMessage('');
    setSubmittingVote(true);

    try {
      const result = await submitVerificationVote({
        pollId: currentPollId,
        problemId: problem.id,
        workspaceId: workspaceId || problem.workspaceId,
        option: optionKey,
        currentUser,
        userProfile,
      });

      setIsChangingVote(false);
      setVoteSuccessMessage('Your response has been recorded.');

      if (result) {
        if (result.metrics) {
          setVotesData(result.metrics);
        }
        if (onStatusChanged && result.status !== problem.status) {
          onStatusChanged(problem.id, result.status);
        }
        if (onProblemUpdated) {
          onProblemUpdated({
            ...problem,
            status: result.status,
            isReopened: result.isReopened,
            stillReportingCount: result.unresolvedUsers?.length || 0,
            unresolvedUsers: result.unresolvedUsers || [],
            verificationStats: {
              ...(problem.verificationStats || {}),
              solved: result.metrics?.counts?.SOLVED ?? 0,
              partiallySolved: result.metrics?.counts?.PARTIALLY_SOLVED ?? 0,
              notSolved: result.metrics?.counts?.NOT_SOLVED ?? 0,
              unresolved: result.unresolvedUsers?.length ?? 0,
              totalVotes: result.metrics?.totalVotes ?? 0,
              eligibleCount,
              votes: {
                ...(problem.verificationStats?.votes || {}),
                [currentUser.uid]: {
                  userId: currentUser.uid,
                  userName: userProfile?.fullName || currentUser.displayName || 'Member',
                  option: optionKey,
                  cycleNumber: effectivePoll?.cycleNumber || 1,
                },
              },
            },
          });
        }
      }
    } catch (err) {
      console.error('[UNSAID Verification Vote Error]', err?.code, err?.message);
      setVoteError(err?.message || 'Failed to submit vote. Please try again.');
    } finally {
      setSubmittingVote(false);
    }
  };

  if (loadingPoll && !effectivePoll) {
    return (
      <GlassCard className="p-5 text-center text-xs text-[var(--text-muted)] space-y-2">
        <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading resolution verification poll...</p>
      </GlassCard>
    );
  }

  // If no poll or official resolution exists yet, render a clean fallback
  if (!effectivePoll) {
    return (
      <GlassCard className="p-4 text-center text-xs text-[var(--text-muted)] space-y-1">
        <HelpCircle className="w-5 h-5 text-[var(--text-muted)] mx-auto opacity-50" />
        <p className="font-semibold text-[var(--text)]">Verification Poll Inactive</p>
        <p className="text-[11px]">An official resolution must be published to begin verification.</p>
      </GlassCard>
    );
  }

  const isSolved = effectivePoll.status === 'solved' || problem.status === 'solved';
  const isReopened = effectivePoll.status === 'reopened' || problem.status === 'reopened' || effectiveVotesData.unresolvedUsers.length > 0;
  const hasUserVoted = Boolean(myOption);

  return (
    <GlassCard
      variant="panel"
      className="p-4 sm:p-6 space-y-4 border-2 border-[var(--glass-border)] bg-[var(--surface)]/90 backdrop-blur-xl shadow-xl rounded-3xl"
    >
      {/* ========================================================= */}
      {/* 1. OFFICIAL RESOLUTION BANNER                            */}
      {/* ========================================================= */}
      <div className="p-3.5 rounded-2xl bg-[var(--primary-light)]/20 border border-[var(--primary)]/30 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="cyan" size="xs" icon={<Award className="w-3 h-3" />}>
            OFFICIAL RESOLUTION · CYCLE #{effectivePoll.cycleNumber || 1}
          </Badge>
          <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {effectivePoll.resolvedByName || 'Workspace Administration'}
          </span>
        </div>

        <p className="text-xs sm:text-sm font-semibold text-[var(--text)] leading-relaxed">
          &ldquo;{effectivePoll.resolutionText}&rdquo;
        </p>

        {effectivePoll.actionTaken && (
          <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface)] p-2 rounded-xl border border-[var(--glass-border)]">
            <strong className="text-[var(--text)]">Action Taken: </strong>
            {effectivePoll.actionTaken}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. REOPENED ALERT (Requirements 18 & 19)                  */}
      {/* ========================================================= */}
      {isReopened && (
        <div className="p-3.5 rounded-2xl bg-[var(--danger-light)]/40 border border-[var(--danger)]/50 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[var(--danger)] font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>PROBLEM REOPENED</span>
            </div>
            <Badge variant="high" size="xs">
              {effectiveVotesData.unresolvedUsers.length} Unresolved
            </Badge>
          </div>

          <p className="text-[11px] text-[var(--danger)]">
            {effectiveVotesData.unresolvedUsers.length} affected user(s) reported this issue is not fully solved.
            Unanimous verification failed; the query has been returned to the active triage queue.
          </p>

          <div className="pt-1 border-t border-[var(--danger)]/20 text-[11px] space-y-1">
            <span className="font-semibold text-[var(--text)]">Still unresolved for:</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {effectiveVotesData.unresolvedUsers.map((u) => (
                <span
                  key={u.userId}
                  className="px-2 py-0.5 rounded-lg bg-[var(--danger)]/15 text-[var(--danger)] text-[10px] font-semibold border border-[var(--danger)]/30"
                >
                  • {u.userName} — {u.option === VERIFICATION_OPTIONS.PARTIALLY_SOLVED ? 'Partially Solved' : 'Not Solved'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. FINAL SOLVED SUCCESS BANNER (Requirement 17)           */}
      {/* ========================================================= */}
      {isSolved && !isReopened && (
        <div className="p-3.5 rounded-2xl bg-[var(--success-light)]/30 border border-[var(--success)]/50 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-[var(--success)] font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>FINAL SOLVED: 100% UNANIMOUS AFFECTED-USER VERIFICATION</span>
          </div>
          <Badge variant="low" size="xs">
            {eligibleCount}/{eligibleCount} Confirmed
          </Badge>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. POLL HEADER (Reference: "Ur Queries" / Subtitle)        */}
      {/* ========================================================= */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-[var(--text)] tracking-tight">
            Ur Queries
          </h3>
          <span className="text-[11px] font-mono font-semibold text-[var(--cyan)]">
            {effectiveVotesData.totalVotes} / {eligibleCount} Votes
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Select one or more
        </p>
      </div>

      {voteSuccessMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{voteSuccessMessage}</span>
        </div>
      )}

      {voteError && (
        <div className="p-2.5 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{voteError}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. THREE LARGE POLL OPTIONS (Requirements 6, 7, 8)       */}
      {/* ========================================================= */}
      <div className="space-y-2.5" role="radiogroup" aria-label="Resolution verification options">
        {[
          {
            key: VERIFICATION_OPTIONS.SOLVED,
            label: VERIFICATION_OPTION_LABELS.SOLVED,
            dotColor: 'text-emerald-500',
            activeBarBg: 'bg-emerald-500',
            borderSelected: 'border-emerald-500 ring-1 ring-emerald-500/40',
            count: effectiveVotesData.counts.SOLVED,
            pct: effectiveVotesData.percentages.SOLVED,
          },
          {
            key: VERIFICATION_OPTIONS.PARTIALLY_SOLVED,
            label: VERIFICATION_OPTION_LABELS.PARTIALLY_SOLVED,
            dotColor: 'text-amber-500',
            activeBarBg: 'bg-amber-500',
            borderSelected: 'border-amber-500 ring-1 ring-amber-500/40',
            count: effectiveVotesData.counts.PARTIALLY_SOLVED,
            pct: effectiveVotesData.percentages.PARTIALLY_SOLVED,
          },
          {
            key: VERIFICATION_OPTIONS.NOT_SOLVED,
            label: VERIFICATION_OPTION_LABELS.NOT_SOLVED,
            dotColor: 'text-rose-500',
            activeBarBg: 'bg-rose-500',
            borderSelected: 'border-rose-500 ring-1 ring-rose-500/40',
            count: effectiveVotesData.counts.NOT_SOLVED,
            pct: effectiveVotesData.percentages.NOT_SOLVED,
          },
        ].map((opt) => {
          const isSelectedByMe = myOption === opt.key;
          const canVoteOnThis = isEligibleToVote && !submittingVote && effectivePoll?.status !== 'solved';

          return (
            <div
              key={opt.key}
              onClick={() => {
                if (canVoteOnThis) handleSelectOption(opt.key);
              }}
              role="radio"
              aria-checked={isSelectedByMe}
              tabIndex={canVoteOnThis ? 0 : -1}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && canVoteOnThis) {
                  e.preventDefault();
                  handleSelectOption(opt.key);
                }
              }}
              className={`p-3.5 rounded-2xl border transition-all select-none ${
                canVoteOnThis ? 'cursor-pointer hover:border-[var(--primary)]' : 'cursor-default'
              } ${
                isSelectedByMe
                  ? `bg-[var(--surface-hover)] ${opt.borderSelected} shadow-sm`
                  : 'bg-[var(--surface)] border-[var(--glass-border)]'
              }`}
            >
              {/* Option Top Line: Indicator + Label + Count */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  {/* Selection Indicator / Radio Circle */}
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelectedByMe
                        ? 'border-current text-[var(--primary)]'
                        : 'border-[var(--text-muted)] opacity-60'
                    }`}
                  >
                    {isSelectedByMe ? (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    ) : null}
                  </div>

                  <span className="text-xs sm:text-sm font-semibold text-[var(--text)]">
                    {opt.label}
                  </span>

                  {isSelectedByMe && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold">
                      Your vote
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">
                    {opt.count}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    ({opt.pct}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar (Liquid Glass) */}
              <div
                className="w-full h-1.5 rounded-full bg-[var(--surface-hover)] overflow-hidden border border-[var(--glass-border)]/50"
                role="progressbar"
                aria-valuenow={opt.pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    opt.count > 0 ? opt.activeBarBg : 'bg-transparent'
                  }`}
                  style={{ width: `${opt.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 6. CURRENT USER VOTE BANNER & ELIGIBILITY STATUS          */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs text-[var(--text-muted)]">
        {hasUserVoted ? (
          <div className="flex items-center gap-1.5 text-[var(--text)] font-medium">
            <Check className="w-3.5 h-3.5 text-[var(--success)]" />
            <span>
              You voted:{' '}
              <strong className="text-[var(--primary)]">
                {VERIFICATION_OPTION_LABELS[myOption] || myOption}
              </strong>
            </span>
            {effectivePoll?.status !== 'solved' && (
              <span className="text-[10px] text-[var(--text-muted)]">
                (Click any option to change)
              </span>
            )}
          </div>
        ) : isEligibleToVote ? (
          <span className="text-[11px] text-[var(--cyan)] font-medium">
            ⚪ You are an affected user. Click an option above to verify this resolution.
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)] italic">
            🔒 Only the {eligibleCount} affected user(s) who reported this query can verify this resolution.
          </span>
        )}
      </div>

      {/* ========================================================= */}
      {/* 7. FOOTER: TIMER + "VIEW VOTES" (Reference UI)           */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
        {/* Elapsed Timer / Status */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
          <Clock className="w-3.5 h-3.5 text-[var(--cyan)]" />
          <span>{elapsedString}</span>
        </div>

        {/* View Votes Button */}
        <button
          type="button"
          onClick={() => setShowViewVotesModal(true)}
          className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-[var(--surface-hover)] transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View votes</span>
        </button>
      </div>

      {/* 100% Confirmation Policy Explainer */}
      <div className="p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-[10px] text-[var(--text-secondary)] space-y-0.5">
        <strong className="text-[var(--text)] block">Strict Unanimous Policy:</strong>
        <p>
          UNSAID requires 100% of affected users to vote &quot;Solved&quot;. Even ONE &quot;Partially Solved&quot; or &quot;Not Solved&quot; vote reopens the query and notifies the administration.
        </p>
      </div>

      {/* ========================================================= */}
      {/* MODAL: VIEW VOTES (Requirements 13 & 14)                  */}
      {/* ========================================================= */}
      {showViewVotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <GlassCard
            variant="panel"
            className="w-full max-w-md p-5 border border-[var(--glass-border)] space-y-4 shadow-2xl rounded-3xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
              <div>
                <h4 className="text-sm font-bold text-[var(--text)]">VIEW VOTES</h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Resolution Cycle #{effectivePoll?.cycleNumber || 1} Breakdown
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowViewVotesModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 text-xs">
              {/* Solved Group */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-emerald-500">
                  <span>Solved — {solvedVoters.length}</span>
                  <span className="font-mono text-[10px]">{effectiveVotesData.percentages.SOLVED}%</span>
                </div>
                {solvedVoters.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic pl-2">No votes yet</p>
                ) : (
                  <ul className="space-y-1 pl-2">
                    {solvedVoters.map((v) => (
                      <li key={v.userId} className="flex items-center gap-1.5 text-[var(--text)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="font-medium">{v.userName}</span>
                        {v.userId === currentUser?.uid && (
                          <span className="text-[9px] text-[var(--primary)] font-bold">(You)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Partially Solved Group */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-amber-500">
                  <span>Partially Solved — {partiallySolvedVoters.length}</span>
                  <span className="font-mono text-[10px]">{effectiveVotesData.percentages.PARTIALLY_SOLVED}%</span>
                </div>
                {partiallySolvedVoters.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic pl-2">No votes yet</p>
                ) : (
                  <ul className="space-y-1 pl-2">
                    {partiallySolvedVoters.map((v) => (
                      <li key={v.userId} className="flex items-center gap-1.5 text-[var(--text)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="font-medium">{v.userName}</span>
                        {v.userId === currentUser?.uid && (
                          <span className="text-[9px] text-[var(--primary)] font-bold">(You)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Not Solved Group */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-rose-500">
                  <span>Not Solved — {notSolvedVoters.length}</span>
                  <span className="font-mono text-[10px]">{effectiveVotesData.percentages.NOT_SOLVED}%</span>
                </div>
                {notSolvedVoters.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic pl-2">No votes yet</p>
                ) : (
                  <ul className="space-y-1 pl-2">
                    {notSolvedVoters.map((v) => (
                      <li key={v.userId} className="flex items-center gap-1.5 text-[var(--text)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span className="font-medium">{v.userName}</span>
                        {v.userId === currentUser?.uid && (
                          <span className="text-[9px] text-[var(--primary)] font-bold">(You)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Pending Eligible Voters */}
              {pendingVoters.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[var(--glass-border)]">
                  <div className="flex items-center justify-between font-semibold text-[var(--text-muted)]">
                    <span>Awaiting Vote — {pendingVoters.length}</span>
                  </div>
                  <ul className="space-y-1 pl-2">
                    {pendingVoters.map((r) => (
                      <li key={r.userId} className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                        <span>{r.userName}</span>
                        {r.userId === currentUser?.uid && (
                          <span className="text-[9px] text-[var(--cyan)] font-bold">(You - pending)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--glass-border)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowViewVotesModal(false)}
              >
                Close
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </GlassCard>
  );
};

export default ResolutionVerificationPoll;

import React, { useState, useEffect } from 'react';
import { CheckCircle2, HeartHandshake } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import {
  DEFAULT_CHECKIN_CONFIG,
  getUserTodayCheckin,
  submitDailyCheckin,
} from '../../services/checkinService';
import { useIdentity } from '../../hooks/useIdentity';

export const DailyCheckInWidget = ({ workspace, currentUser, userProfile, className = '' }) => {
  const { isAnonymous } = useIdentity();
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let ignore = false;
    const wsId = workspace?.id;
    const uid = currentUser?.uid;
    if (!wsId || !uid) return;

    getUserTodayCheckin(wsId, uid)
      .then((existing) => {
        if (!ignore) {
          setTodayCheckin(existing);
          if (existing) {
            setSelectedId(existing.selectedOptionId);
          }
        }
      })
      .catch((err) => {
        if (!ignore) console.error('[UNSAID Load Checkin Error]', err);
      });

    return () => {
      ignore = true;
    };
  }, [workspace?.id, currentUser?.uid]);

  const handleSelectOption = async (option) => {
    if (todayCheckin || submitting || !workspace?.id || !currentUser?.uid) return;
    setSubmitting(true);
    setSelectedId(option.id);
    try {
      const activeQuestion = workspace?.checkinQuestion || DEFAULT_CHECKIN_CONFIG.question;
      const res = await submitDailyCheckin({
        workspaceId: workspace.id,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: userProfile?.fullName || currentUser.displayName || 'Member',
        selectedOptionId: option.id,
        question: activeQuestion,
        anonymous: isAnonymous,
      });
      setTodayCheckin(res.checkin);
    } catch (err) {
      console.error('[UNSAID Check-in Submit Error]', err);
    } finally {
      setSubmitting(false);
    }
  };

  const question = workspace?.checkinQuestion || DEFAULT_CHECKIN_CONFIG.question;
  const options = DEFAULT_CHECKIN_CONFIG.options;

  return (
    <GlassCard variant="panel" glow className={`p-5 sm:p-6 space-y-4 border border-[var(--glass-border)] ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--glass-border)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--pink)] to-[var(--primary)] flex items-center justify-center text-white shadow-xs">
            <HeartHandshake className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">
              <span>Daily Pulse Check-in</span>
              <span className="text-[10px] font-normal text-[var(--text-muted)]">· 1 submission/day</span>
            </h4>
            <p className="text-xs text-[var(--text-muted)]">{question}</p>
          </div>
        </div>

        {todayCheckin ? (
          <Badge variant="cyan" size="sm" dot>
            Completed Today
          </Badge>
        ) : (
          <Badge variant="primary" size="sm">
            Open for Today
          </Badge>
        )}
      </div>

      {todayCheckin ? (
        <div className="py-3 px-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] flex items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl sm:text-3xl" role="img" aria-label={todayCheckin.selectedLabel}>
              {todayCheckin.selectedEmoji}
            </span>
            <div>
              <span className="font-bold text-[var(--text)] text-sm block">
                Your response: {todayCheckin.selectedEmoji} {todayCheckin.selectedLabel}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Completed today for {workspace?.name || 'this workspace'}. Next check-in becomes available at midnight.
              </span>
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {options.map((option) => {
            const isSelected = selectedId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={submitting}
                onClick={() => handleSelectOption(option)}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-center group ${
                  isSelected
                    ? 'bg-[var(--primary-light)] border-[var(--primary)] shadow-sm scale-102'
                    : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] hover:scale-101'
                }`}
              >
                <span className="text-2xl sm:text-3xl mb-1.5 group-hover:scale-110 transition-transform">
                  {option.emoji}
                </span>
                <span className="text-xs font-semibold text-[var(--text)]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};

import React, { useState, useEffect } from 'react';
import { Calendar, History } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { GlassCard } from '../ui/GlassCard';
import { getWorkspace10DayHistory } from '../../services/historyService';

export const WorkspaceHistoryModal = ({ isOpen, onClose, workspace }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (isOpen && workspace?.id) {
      queueMicrotask(() => {
        if (!ignore) setLoading(true);
      });
      getWorkspace10DayHistory(workspace.id)
        .then((data) => {
          if (!ignore) {
            setSnapshots(data);
          }
        })
        .catch((err) => {
          if (!ignore) console.error('[UNSAID History Error]', err);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    } else if (!isOpen) {
      queueMicrotask(() => {
        if (!ignore) setSnapshots([]);
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, workspace?.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="10-Day History & Rolling Archive"
      subtitle={`Daily aggregated snapshots for "${workspace?.name || 'Workspace'}"`}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-2">
        {loading ? (
          <div className="py-16 text-center text-xs text-[var(--text-muted)] animate-pulse">
            Loading 10-day historical archives...
          </div>
        ) : snapshots.length === 0 ? (
          <div className="py-16 text-center text-xs text-[var(--text-muted)] space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
              <History className="w-6 h-6" />
            </div>
            <p className="font-semibold text-[var(--text)] text-sm">No historical snapshots recorded yet</p>
            <p className="max-w-xs mx-auto leading-relaxed text-xs text-[var(--text-muted)]">
              As community problems and daily check-ins accumulate, daily snapshots for {workspace?.name} will be archived here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {snapshots.map((snap, idx) => (
              <GlassCard key={snap.id || idx} variant="panel" className="p-4 space-y-3 border border-[var(--glass-border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--text)] font-mono">
                      {formatDate(snap.dateKey || snap.date)}
                    </span>
                  </div>
                  <Badge variant="cyan" size="sm">
                    Day #{idx + 1}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)]">
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Total Queries</span>
                    <span className="font-bold text-sm text-[var(--text)]">{snap.totalQueries || 0}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)]">
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Resolved</span>
                    <span className="font-bold text-sm text-[var(--success)]">{snap.resolvedQueries ?? snap.resolvedCount ?? 0}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)]">
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Avg Pulse</span>
                    <span className="font-bold text-sm text-[var(--cyan)]">{snap.averagePulse ?? snap.pulseAverage ?? '--'}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)]">
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Emergencies</span>
                    <span className="font-bold text-sm text-[var(--danger)]">{snap.emergencyCount || 0}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};

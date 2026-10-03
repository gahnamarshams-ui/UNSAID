import React, { useState } from 'react';
import { Building2, Sparkles, AlertCircle } from 'lucide-react';

import { useWorkspace } from '../../hooks/useWorkspace';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { getFriendlyFirestoreErrorMessage } from '../../utils/firebaseErrors';

export const CreateWorkspaceModal = ({ isOpen, onClose, onCreated }) => {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('college');
  const [customDomain, setCustomDomain] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const DOMAIN_OPTIONS = [
    { id: 'college', label: 'College / University' },
    { id: 'hostel', label: 'Hostel / Campus Housing' },
    { id: 'office', label: 'Office / Corporate' },
    { id: 'enterprise', label: 'Enterprise / Organization' },
    { id: 'custom', label: 'Custom Domain' },
  ];

  const resetForm = () => {
    setName('');
    setDescription('');
    setCustomDomain('');
    setDomain('college');
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate clicks/submissions

    const finalDomain = domain === 'custom' ? customDomain.trim() : domain;

    if (!name.trim()) {
      setError('Please provide a workspace name.');
      return;
    }
    if (!finalDomain) {
      setError('Please specify a domain type.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const created = await createWorkspace({
        name: name.trim(),
        domain: finalDomain,
        description: description.trim(),
      });

      resetForm();
      onClose();
      if (onCreated) {
        onCreated(created);
      }
    } catch (err) {
      console.error('[UNSAID Create Workspace Error]', err);
      setError(
        getFriendlyFirestoreErrorMessage(
          err,
          "Workspace couldn't be created. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Workspace"
      subtitle="Establish a generic resolution container for your institution or enterprise."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Workspace Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Workspace Name
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Apex Engineering Campus"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        {/* Domain Type Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Domain Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DOMAIN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDomain(opt.id)}
                className={`p-2.5 rounded-2xl border text-xs text-left transition-all ${
                  domain === opt.id
                    ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold shadow-sm'
                    : 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {domain === 'custom' && (
            <div className="pt-1.5">
              <input
                type="text"
                required
                value={customDomain}
                onChange={(e) => {
                  setCustomDomain(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter custom domain (e.g. Healthcare, Community)"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Description / Overview
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe who this resolution workspace serves..."
            className="w-full p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={loading}
            disabled={loading || !name.trim()}
            icon={<Sparkles className="w-4 h-4" />}
          >
            {loading ? 'Creating...' : 'Create Workspace'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};

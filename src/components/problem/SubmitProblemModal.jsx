import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Send,
  Clock,
  ShieldAlert,
  Tag,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { submitProblem } from '../../services/problemService';
import { uploadProblemImage, validateImageFile } from '../../services/storageService';
import { getActiveQuickPicks } from '../../config/quickPicksConfig';
import { getShiftStatus } from '../../config/shiftConfig';
import { useIdentity } from '../../hooks/useIdentity';
import { getFriendlyFirestoreErrorMessage } from '../../utils/firebaseErrors';

export const SubmitProblemModal = ({
  isOpen,
  onClose,
  workspace,
  currentUser,
  userProfile,
  onProblemSubmitted,
  defaultEmergency = false,
}) => {
  const { isAnonymous: defaultAnonymous, pseudonym, displayName } = useIdentity();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [isEmergency, setIsEmergency] = useState(defaultEmergency);
  const [isAnonPost, setIsAnonPost] = useState(defaultAnonymous);
  const [workaround, setWorkaround] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Photo Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Sync defaultEmergency when modal opens with emergency intent
  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore && isOpen) {
        setIsEmergency(defaultEmergency);
        setIsAnonPost(defaultAnonymous);
      }
    });
    return () => {
      ignore = true;
    };
  }, [isOpen, defaultEmergency, defaultAnonymous]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const quickPicks = getActiveQuickPicks(workspace?.quickPicks);
  const shiftStatus = getShiftStatus(workspace?.shiftConfig);

  const handleSelectQuickPick = (qp) => {
    setCategory(qp.category || qp.value);
    if (!title || quickPicks.some((p) => p.value === title || p.label === title)) {
      setTitle(qp.value);
    }
  };

  const handleImagePicked = (file) => {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError('');
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a brief problem title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a clear description of the issue.');
      return;
    }
    if (!workspace?.id) {
      setError('Active workspace context is missing.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      let imageUrl = null;
      let imagePath = null;

      // Upload image to Firebase Storage if selected
      if (selectedImage) {
        try {
          const uploadRes = await uploadProblemImage({
            workspaceId: workspace.id,
            userId: currentUser?.uid || 'anon',
            file: selectedImage,
          });
          if (uploadRes) {
            imageUrl = uploadRes.imageUrl;
            imagePath = uploadRes.imagePath;
          }
        } catch (uploadErr) {
          console.warn('[UNSAID Problem Submit] Photo upload failed:', uploadErr.message);
          // Alert user clearly if Firebase Storage is not activated in Console
          setError(uploadErr.message || 'Image upload failed.');
          setSubmitting(false);
          return;
        }
      }

      const created = await submitProblem({
        workspaceId: workspace.id,
        title,
        description,
        category,
        isEmergency,
        workaround,
        shiftStatus: shiftStatus.label,
        currentUser,
        userProfile,
        isAnonymous: isAnonPost,
        pseudonym,
        imageUrl,
        imagePath,
      });

      if (onProblemSubmitted) {
        onProblemSubmitted(created);
      }

      handleClose();
    } catch (err) {
      console.error('[UNSAID Problem Submit Error]', err);
      setError(getFriendlyFirestoreErrorMessage(err, 'Failed to submit problem. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setCategory('General');
    setIsEmergency(false);
    setWorkaround('');
    setError('');
    handleRemoveImage();
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title={isEmergency ? 'Report Emergency Problem' : 'Report Workspace Problem'}
      subtitle={`Submitting to "${workspace?.name || 'Workspace'}"`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {/* Shift Awareness Notice */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span className="text-[var(--text-muted)]">
              Current Workspace Window:{' '}
              <strong className="text-[var(--text)]">{shiftStatus.label}</strong> ({shiftStatus.shiftSummary})
            </span>
          </div>
          <Badge variant={shiftStatus.isShiftActive ? 'low' : 'neutral'} size="sm" dot>
            {shiftStatus.isShiftActive ? 'Online Triage' : 'Off Hours Queue'}
          </Badge>
        </div>

        {/* Identity & Posting Attribution */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium">Posting as:</span>
            <strong className={`font-semibold ${isAnonPost ? 'text-[var(--cyan)] font-mono' : 'text-[var(--text)]'}`}>
              {isAnonPost ? pseudonym : displayName}
            </strong>
          </div>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--glass-border)]">
            <button
              type="button"
              onClick={() => setIsAnonPost(false)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                !isAnonPost
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => setIsAnonPost(true)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                isAnonPost
                  ? 'bg-[var(--cyan)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Anonymous
            </button>
          </div>
        </div>

        {/* Emergency Alert Banner when toggled */}
        {isEmergency && (
          <div className="p-4 rounded-2xl bg-[var(--danger-light)] border-2 border-[var(--danger)]/60 text-[var(--danger)] text-xs space-y-1 shadow-sm ring-2 ring-[var(--danger)]/20 animate-pulse motion-reduce:animate-none">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
              <span>Emergency query</span>
            </div>
            <p className="leading-relaxed text-[var(--text)] font-medium">
              Emergency queries are prioritized for immediate attention.
            </p>
          </div>
        )}

        {/* Quick Picks Shortcuts */}
        {quickPicks.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[var(--cyan)]" />
              Quick Issue Templates
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPicks.map((qp) => (
                <button
                  key={qp.id}
                  type="button"
                  onClick={() => handleSelectQuickPick(qp)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    title === qp.value
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                      : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                  }`}
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-title">
            Problem Title <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            id="prob-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 3rd Floor Wi-Fi Dropping Repeatedly"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Category & Emergency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-cat">
              Category
            </label>
            <select
              id="prob-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
            >
              <option value="General">General</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Access">Access</option>
              <option value="Facilities">Facilities</option>
              <option value="Technical">Technical</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Emergency Checkbox / Toggle */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label
              htmlFor="prob-emergency"
              className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                isEmergency
                  ? 'bg-[var(--danger-light)] border-[var(--danger)] text-[var(--danger)]'
                  : 'bg-[var(--surface)] border-[var(--glass-border)] text-[var(--text)]'
              }`}
            >
              <input
                id="prob-emergency"
                type="checkbox"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--danger)] accent-[var(--danger)] cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold block">Mark as Emergency</span>
                <span className="text-[10px] text-[var(--text-muted)]">Elevates query priority</span>
              </div>
            </label>
          </div>
        </div>

        {/* Detailed Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-desc">
            Description <span className="text-[var(--danger)]">*</span>
          </label>
          <textarea
            id="prob-desc"
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what is happening, where it occurs, and how it impacts people in this workspace..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
          />
        </div>

        {/* Photo Upload Section */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Photo / Visual Proof <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleImagePicked(e.target.files[0]);
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleImagePicked(e.target.files[0]);
            }}
          />

          {imagePreviewUrl ? (
            <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={imagePreviewUrl}
                  alt="Attachment Preview"
                  className="w-14 h-14 rounded-xl object-cover border border-[var(--glass-border)] shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text)] truncate">
                    {selectedImage?.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {(selectedImage?.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[var(--danger)] hover:bg-[var(--danger-light)]"
                  onClick={handleRemoveImage}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<ImageIcon className="w-4 h-4 text-[var(--cyan)]" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Add Photo
              </Button>
              {typeof navigator !== 'undefined' && navigator.mediaDevices && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Camera className="w-4 h-4 text-[var(--primary)]" />}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  Use Camera
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Optional Proposed Workaround */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-workaround">
            Proposed Workaround <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
          </label>
          <input
            id="prob-workaround"
            type="text"
            value={workaround}
            onChange={(e) => setWorkaround(e.target.value)}
            placeholder="Have you or others found a temporary workaround?"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={isEmergency ? 'danger' : 'primary'}
            size="md"
            isLoading={submitting}
            disabled={submitting}
            icon={isEmergency ? <AlertTriangle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          >
            {isEmergency ? 'Broadcast Emergency' : 'Submit Problem'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};

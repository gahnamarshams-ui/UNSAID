import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Check,
  Clock,
  Touchpad,
  Eye,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { SectionHeader } from '../components/ui/SectionHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { LiquidButton } from '../components/ui/LiquidButton';
import { ModalShell } from '../components/ui/ModalShell';
import { BADGE_VARIANTS } from '../data';

/**
 * ComponentShowcase Page
 * Interactive playground demonstrating all design system primitives,
 * CSS variables, liquid hold interactions, and responsive behaviors.
 */
export const ComponentShowcase = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [liquidTriggerCount, setLiquidTriggerCount] = useState(0);
  const [interactiveCardClicked, setInteractiveCardClicked] = useState(false);

  return (
    <PageContainer size="lg" className="space-y-12">
      {/* 1. Header */}
      <SectionHeader
        title="Design System & UI Component Showcase"
        subtitle="Live testing suite for UNSAID glassmorphism tokens, buttons, badges, and iOS liquid hold physics."
        badge={
          <Badge variant="cyan" size="md">
            Design Tokens
          </Badge>
        }
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Eye className="w-4 h-4" />}
            onClick={() => setModalOpen(true)}
          >
            Launch Modal Shell
          </Button>
        }
      />

      {/* 2. Liquid Hold Interaction Section */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <Touchpad className="w-5 h-5 text-[var(--cyan)]" />
          <span>iOS-Inspired Liquid Hold Interaction</span>
        </h3>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl">
          Press and hold with a mouse, touch, or trackpad. Notice the scale elevation,
          expanding radial glow, and liquid progress fill. Release early to reset, or hold for ~550ms to trigger.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <GlassCard glow className="space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-xs uppercase font-mono tracking-wider text-[var(--primary)] font-semibold">
                Interactive Liquid Hold
              </span>
              <h4 className="text-base font-semibold text-[var(--text)]">
                Try Pressing & Holding Below:
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Triggers completed: <strong className="text-[var(--primary)]">{liquidTriggerCount}</strong>
              </p>
            </div>

            <LiquidButton
              className="w-full py-4 px-6 text-base font-semibold bg-[var(--surface)] text-[var(--text)]"
              holdDuration={550}
              onHoldComplete={() => {
                setLiquidTriggerCount((prev) => prev + 1);
              }}
              onClick={() => {
                // Short click feedback
              }}
            >
              <Sparkles className="w-5 h-5 text-[var(--cyan)]" />
              <span>Press & Hold (550ms)</span>
            </LiquidButton>
          </GlassCard>

          <GlassCard className="space-y-4">
            <span className="text-xs uppercase font-mono tracking-wider text-[var(--cyan)] font-semibold">
              Interaction Specifications
            </span>
            <ul className="text-xs text-[var(--text-secondary)] space-y-2.5 list-disc pl-4">
              <li>
                <strong>Pointer & Touch Events:</strong> Supports <code>onPointerDown</code>, <code>onTouchStart</code>, and mouse events with multi-platform compatibility.
              </li>
              <li>
                <strong>Liquid Glow Physics:</strong> Dynamic CSS variable <code>var(--liquid-glow)</code> triggers soft bloom without repainting the entire viewport.
              </li>
              <li>
                <strong>Haptic Feedback:</strong> Automatically triggers subtle vibration on supported mobile hardware (iOS/Android).
              </li>
              <li>
                <strong>Smooth Reset:</strong> Canceling or releasing before threshold smoothly returns the button to resting scale.
              </li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* 3. Button System */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[var(--text)]">Button System</h3>
        <GlassCard className="space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Variants (.btn-primary, .btn-secondary, .btn-ghost)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="primary" isLoading>
                Loading State
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Sizes & Icon Placement
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" icon={<Zap className="w-3.5 h-3.5" />}>
                Small (sm)
              </Button>
              <Button size="md" variant="primary" icon={<Sparkles className="w-4 h-4" />}>
                Medium (md)
              </Button>
              <Button size="lg" variant="secondary" iconRight={<Clock className="w-4 h-4" />}>
                Large (lg)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Icon Buttons
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <IconButton icon={<Zap className="w-4 h-4" />} ariaLabel="Zap" variant="glass" />
              <IconButton icon={<Clock className="w-4 h-4" />} ariaLabel="Clock" variant="ghost" />
              <IconButton icon={<Sparkles className="w-4 h-4" />} ariaLabel="Sparkles" variant="primary" />
              <IconButton icon={<Check className="w-4 h-4" />} ariaLabel="Check" variant="glass" active />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* 4. Badges & Avatar System */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[var(--text)]">Badges & Avatars</h3>
        <GlassCard className="space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Data Configuration Badges
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {BADGE_VARIANTS.map((b) => (
                <Badge key={b.type} variant={b.type} dot>
                  {b.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Avatars & Status Indicators
            </span>
            <div className="flex items-center gap-4">
              <Avatar name="Sarah Connor" size="sm" isOnline={false} />
              <Avatar name="Alex Vance" size="md" isOnline={true} />
              <Avatar name="Marcus Wright" size="lg" isOnline={true} />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* 5. Glass Surfaces & Cards */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[var(--text)]">Glass Surfaces</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <GlassCard variant="default">
            <h4 className="font-semibold text-[var(--text)] mb-1">Standard Glass Card</h4>
            <p className="text-xs text-[var(--text-muted)]">
              Frosted 20px blur, subtle border, and soft elevation shadow.
            </p>
          </GlassCard>

          <GlassCard variant="panel">
            <h4 className="font-semibold text-[var(--text)] mb-1">Panel Glass Surface</h4>
            <p className="text-xs text-[var(--text-muted)]">
              Higher opacity, 24px blur, ideal for containers and modal shells.
            </p>
          </GlassCard>

          <GlassCard
            variant="interactive"
            glow
            onClick={() => setInteractiveCardClicked(!interactiveCardClicked)}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-[var(--text)]">Interactive Card</h4>
              <Badge variant="primary" size="sm">
                Click me
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {interactiveCardClicked
                ? 'State toggled! Keyboard and click accessible.'
                : 'Click to test interactive active scale.'}
            </p>
          </GlassCard>
        </div>
      </section>

      {/* 6. Semantic Color Tokens Swatch */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[var(--text)]">Semantic Color Swatches</h3>
        <GlassCard className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center space-y-1">
            <div className="w-full h-8 rounded-lg bg-[var(--primary)] shadow-sm" />
            <span className="text-[11px] font-mono text-[var(--text)] font-medium">--primary</span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center space-y-1">
            <div className="w-full h-8 rounded-lg bg-[var(--cyan)] shadow-sm" />
            <span className="text-[11px] font-mono text-[var(--text)] font-medium">--cyan</span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center space-y-1">
            <div className="w-full h-8 rounded-lg bg-[var(--danger)] shadow-sm" />
            <span className="text-[11px] font-mono text-[var(--text)] font-medium">--danger</span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center space-y-1">
            <div className="w-full h-8 rounded-lg bg-[var(--warning)] shadow-sm" />
            <span className="text-[11px] font-mono text-[var(--text)] font-medium">--warning</span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center space-y-1">
            <div className="w-full h-8 rounded-lg bg-[var(--success)] shadow-sm" />
            <span className="text-[11px] font-mono text-[var(--text)] font-medium">--success</span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center space-y-1">
            <div className="w-full h-8 rounded-lg bg-[var(--glass)] border border-[var(--glass-border)] shadow-sm" />
            <span className="text-[11px] font-mono text-[var(--text)] font-medium">--glass</span>
          </div>
        </GlassCard>
      </section>

      {/* Modal Shell Verification */}
      <ModalShell
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Reusable Glassmorphic Modal"
        subtitle="Backdrop blur, focus trapped, escape key enabled"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          This modal dialog shell is fully styled with the frosted glassmorphism system.
          It listens to the <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--glass-border)] font-mono text-xs">Escape</kbd> key, locks body scrolling when open, and dismisses when clicking the blurred backdrop.
        </p>
      </ModalShell>
    </PageContainer>
  );
};

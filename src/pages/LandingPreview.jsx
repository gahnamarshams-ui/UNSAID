import React from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LiquidButton } from '../components/ui/LiquidButton';
import { APP_CONFIG } from '../config/appConfig';

/**
 * LandingPreview Page
 * High-impact hero screen showcasing the liquid glass design language.
 */
export const LandingPreview = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <PageContainer size="lg" className="space-y-12 sm:space-y-16">
      {/* 1. Hero Section */}
      <section className="relative pt-6 sm:pt-12 text-center max-w-4xl mx-auto space-y-6">
        {/* Status Pill Badge */}
        <div className="inline-flex items-center gap-2">
          <Badge variant="cyan" size="md" dot>
            PART 2 · Authentication & Workspace Shell
          </Badge>
          <span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">
            Liquid Glass V2 Spatial Design System
          </span>
        </div>

        {/* Main Brand Title & Subtitle */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--text)]">
            <span className="bg-gradient-to-r from-[var(--primary)] via-[#a855f7] to-[var(--cyan)] bg-clip-text text-transparent">
              {APP_CONFIG.name}
            </span>
          </h1>
          <p className="text-lg sm:text-2xl font-medium text-[var(--text-secondary)] tracking-tight">
            {APP_CONFIG.tagline}
          </p>
        </div>

        {/* Short Description */}
        <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
          {APP_CONFIG.shortDescription}
        </p>

        {/* Call-to-Action Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          {isAuthenticated ? (
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight className="w-5 h-5" />}
              onClick={() => navigate(isAdmin ? '/admin' : '/app')}
            >
              Open My Workspace
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                size="lg"
                iconRight={<ArrowRight className="w-5 h-5" />}
                onClick={() => navigate('/app')}
              >
                Explore User Portal
              </Button>

              <Button
                variant="secondary"
                size="lg"
                icon={<ShieldCheck className="w-5 h-5 text-[var(--primary)]" />}
                onClick={() => navigate('/admin')}
              >
                Admin Control
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate('/showcase')}
          >
            Design System Gallery
          </Button>
        </div>


        {/* Interactive Liquid Hold Feature Banner */}
        <div className="pt-4 max-w-md mx-auto">
          <LiquidButton
            className="w-full py-3 px-5 text-sm font-medium bg-[var(--surface)] text-[var(--text)]"
            holdDuration={500}
            onHoldComplete={() => {
              // Liquid hold completed silently with haptics
            }}
          >
            <Sparkles className="w-4 h-4 text-[var(--cyan)] animate-spin" />
            <span>Press & Hold for Liquid Effect (Touch / Mouse)</span>
          </LiquidButton>
        </div>
      </section>

      {/* 2. Floating Glass Highlight Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Card 1 */}
        <GlassCard
          glow
          className="space-y-4 hover:-translate-y-1.5 transition-transform duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Intelligent Escalation
              </h3>
              <Badge variant="high" size="sm">
                High
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Automated query prioritization routing unresolved concerns to administrative tiers with speed and transparency.
            </p>
          </div>
        </GlassCard>

        {/* Card 2 */}
        <GlassCard
          className="space-y-4 hover:-translate-y-1.5 transition-transform duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--cyan-light)] text-[var(--cyan)] flex items-center justify-center border border-[var(--cyan)]/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Resolution Tracking
              </h3>
              <Badge variant="medium" size="sm">
                Medium
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Clear end-to-end progress lifecycle giving every stakeholder real-time visibility into query status.
            </p>
          </div>
        </GlassCard>

        {/* Card 3 */}
        <GlassCard
          className="space-y-4 hover:-translate-y-1.5 transition-transform duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center border border-[var(--success)]/30">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Liquid Glass Architecture
              </h3>
              <Badge variant="low" size="sm">
                Low
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Ultra-smooth translucent liquid glass with dynamic refraction, floating depth, and specular edge lighting.
            </p>
          </div>
        </GlassCard>
      </section>

      {/* 3. Hero Visual Preview Panel */}
      <section className="relative">
        <GlassCard variant="panel" className="p-6 sm:p-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs font-mono text-[var(--text-muted)] ml-2">
                  UNSAID · UI Shell Architecture
                </span>
              </div>
              <h3 className="text-xl font-bold text-[var(--text)]">
                Scalable 6-Part Platform Architecture
              </h3>
            </div>
            <Badge variant="primary" size="md">
              Foundation Ready
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
              <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Part 1: Design Shell
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Active. Glassmorphism, CSS tokens, responsive navigation, liquid hold interaction.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] space-y-2 opacity-75">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold text-sm">
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
                Part 2: Auth & Routing
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Firebase Authentication & role-based routing foundations.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] space-y-2 opacity-75">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold text-sm">
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
                Part 3: User Portal
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Query submission, community upvoting, and progress timeline.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] space-y-2 opacity-75">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold text-sm">
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">4</span>
                Part 4: Admin Console
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Escalation triage, AI response management, and resolution updates.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] space-y-2 opacity-75">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold text-sm">
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">5</span>
                Part 5: Flask + Gemini API
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                AI categorizer, summary generator, and backend service integration.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--glass-border)] space-y-2 opacity-75">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold text-sm">
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">6</span>
                Part 6: Integration & QA
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                End-to-end testing, responsive audits, and production readiness.
              </p>
            </div>
          </div>
        </GlassCard>
      </section>
    </PageContainer>
  );
};

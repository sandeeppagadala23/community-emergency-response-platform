import React, { useState } from 'react';
import { StatusBadge } from '../components/common/StatusBadge';
import { ChannelTag } from '../components/common/ChannelTag';
import { SimulatedBadge } from '../components/common/SimulatedBadge';
import { SosHoldButton } from '../components/resident/SosHoldButton';
import { CategoryRadioGroup } from '../components/resident/CategoryRadioGroup';
import { LocationStatus } from '../components/resident/LocationStatus';
import { StatusStepper } from '../components/resident/StatusStepper';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { EmptyState } from '../components/common/EmptyState';
import { EmergencyType } from '../types/incident';
import { Palette, Shield, Info, Type, Layers } from 'lucide-react';

export const DesignSystemPage: React.FC = () => {
  const [selectedCat, setSelectedCat] = useState<EmergencyType | null>('MEDICAL');
  const [sosTriggerCount, setSosTriggerCount] = useState<number>(0);

  const colorTokens = [
    { name: 'paper', hex: '#FAF7F2', desc: 'Page background (warm off-white, not pure white)' },
    { name: 'surface', hex: '#FFFFFF', desc: 'Panels, card surfaces, table rows' },
    { name: 'ink', hex: '#1C1A17', desc: 'Primary readable text' },
    { name: 'ink-muted', hex: '#5E584F', desc: 'Secondary text (passes 4.5:1 contrast)' },
    { name: 'rule', hex: '#DDD6CA', desc: 'Dividers, 1px rules and borders' },
    { name: 'signal', hex: '#C8281E', desc: 'SOS button, critical status only' },
    { name: 'action', hex: '#1F4E5F', desc: 'Primary buttons, links (deep teal-blue)' },
    { name: 'ok', hex: '#2E6B3F', desc: 'Delivered, resolved states' },
    { name: 'warn', hex: '#A86500', desc: 'Pending, location unavailable' },
    { name: 'sim', hex: '#5B4B8A', desc: '“Simulated” provider badge only' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      {/* Title */}
      <div className="border-b border-rule dark:border-rule-dark pb-4">
        <div className="flex items-center gap-2 text-action dark:text-teal-400 mb-1">
          <Palette className="w-5 h-5" />
          <span className="font-mono text-xs uppercase tracking-wider font-semibold">
            CERP Design System & Component Reference
          </span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-ink dark:text-ink-dark">
          Milestone 2 Design Tokens & UI Guidelines
        </h1>
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1 max-w-2xl">
          Crafted specifically for Indian residential community emergencies. Calm, honest, high-contrast, free from AI templates, gradients, glassmorphism, or fake metrics.
        </p>
      </div>

      {/* 1. Design Tokens: Colors */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink dark:text-ink-dark flex items-center gap-2">
          <span>1. Color Tokens</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {colorTokens.map((token) => (
            <div
              key={token.name}
              className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-3 space-y-2 shadow-sm"
            >
              <div
                className="w-full h-12 rounded-control border border-rule/50"
                style={{ backgroundColor: token.hex }}
              />
              <div>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-ink dark:text-ink-dark">{token.name}</span>
                  <span className="text-ink-muted">{token.hex}</span>
                </div>
                <p className="text-[11px] text-ink-muted dark:text-ink-muted-dark mt-1 leading-tight">
                  {token.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Typography Guidelines */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink dark:text-ink-dark flex items-center gap-2">
          <span>2. Typography Hierarchy</span>
        </h2>
        <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 space-y-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Serif Headings (Source Serif 4 / Fraunces)
            </span>
            <div className="font-serif text-2xl font-bold text-ink dark:text-ink-dark">
              Emergency SOS · Green Meadows Apartments
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t border-rule/50 dark:border-rule-dark/50">
            <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Body & UI (Noto Sans / Public Sans - Base 18px for Seniors)
            </span>
            <p className="text-base text-ink dark:text-ink-dark max-w-xl">
              Your alert has been recorded. Help is being notified. Responders from Main Gate security desk have received your dispatch.
            </p>
          </div>
          <div className="space-y-1 pt-2 border-t border-rule/50 dark:border-rule-dark/50">
            <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Data & IDs (IBM Plex Mono / JetBrains Mono)
            </span>
            <div className="font-mono text-xs text-action dark:text-teal-400">
              INC-2026-BLR-1082 · 12.92490° N, 77.67480° E · 14:30:15 IST
            </div>
          </div>
        </div>
      </section>

      {/* 3. Status Badges & Honest Vocabulary */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink dark:text-ink-dark">
          3. Status Vocabulary & Badges
        </h2>
        <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 space-y-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted mb-2">
              Incident Statuses:
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="OPEN" type="incident" />
              <StatusBadge status="INVESTIGATING" type="incident" />
              <StatusBadge status="RESOLVED" type="incident" />
              <StatusBadge status="CLOSED" type="incident" />
            </div>
          </div>

          <div className="pt-3 border-t border-rule/50 dark:border-rule-dark/50">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted mb-1">
              Delivery Statuses (SENT vs DELIVERED distinct):
            </h3>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark mb-2">
              Hover/focus over SENT to verify tooltip explanation ("Handed to the provider. Not confirmed as received.")
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="PENDING" type="notification" />
              <StatusBadge status="SENT" type="notification" />
              <StatusBadge status="DELIVERED" type="notification" />
              <StatusBadge status="FAILED" type="notification" />
            </div>
          </div>

          <div className="pt-3 border-t border-rule/50 dark:border-rule-dark/50">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted mb-2">
              Channels & Environment Tags:
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <ChannelTag channel="PUSH" />
              <ChannelTag channel="SMS" />
              <ChannelTag channel="EMAIL" />
              <ChannelTag channel="IN_APP" />
              <SimulatedBadge size="sm" />
              <SimulatedBadge size="md" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Live Interactive Component Showcase */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink dark:text-ink-dark">
          4. Interactive Resident Components
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Hold Button Demo */}
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted">
              SosHoldButton (1.5s hold with progress ring & cancel)
            </h3>
            <p className="text-xs text-ink-muted">
              Hold the button for 1.5 seconds. Releasing early cleanly cancels without trigger.
            </p>
            <SosHoldButton
              onTrigger={() => setSosTriggerCount((prev) => prev + 1)}
              holdDurationMs={1500}
            />
            {sosTriggerCount > 0 && (
              <p className="text-xs text-center font-mono text-ok font-semibold">
                SOS successfully triggered {sosTriggerCount} time(s)!
              </p>
            )}
          </div>

          {/* Category Selector */}
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted">
              CategoryRadioGroup (Min 48px tap targets)
            </h3>
            <CategoryRadioGroup
              selected={selectedCat}
              onSelect={(cat) => setSelectedCat(cat)}
            />
          </div>
        </div>

        {/* Location & Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted">
              LocationStatus
            </h3>
            <LocationStatus
              location={{
                latitude: 12.9249,
                longitude: 77.6748,
                accuracy: 12,
                captured_at: new Date().toISOString(),
              }}
              isLoading={false}
              onRetry={() => {}}
            />
            <LocationStatus
              location={null}
              isLoading={false}
              onRetry={() => {}}
            />
          </div>

          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-muted">
              StatusStepper (Dispatch and resident arrival confirmation)
            </h3>
            <StatusStepper
              stages={{
                recorded: true,
                sent: true,
                delivered: false,
                acknowledged: false,
              }}
              counts={{
                total_recipients: 3,
                sent: 3,
                delivered: 0,
                failed: 0,
                acknowledged: 0,
              }}
            />
          </div>
        </div>
      </section>

      {/* 5. Error & Empty States */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink dark:text-ink-dark">
          5. Honest Error & Empty States
        </h2>
        <div className="space-y-3">
          <ErrorBanner
            message="Alert not sent due to network connection failure. Tap to try again."
            onRetry={() => alert('Retried submission')}
          />
          <EmptyState
            message="You haven’t raised any alerts."
            actionText="Raise an alert"
            onAction={() => {}}
          />
        </div>
      </section>
    </div>
  );
};

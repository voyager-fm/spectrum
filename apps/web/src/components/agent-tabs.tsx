'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.tsx';

const STORAGE_KEY = 'spectrum:agent';

export interface AgentTab {
  key: string;
  label: string;
  installed: boolean;
  panel: ReactNode;
}

/**
 * One tab per coding agent, like a package-manager switcher in install docs. The chosen agent
 * is remembered in this browser only; without storage the first installed agent is shown.
 */
export function AgentTabs({ tabs, initial }: { tabs: AgentTab[]; initial: string }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && tabs.some((tab) => tab.key === saved)) setValue(saved);
    } catch {
      // Storage can be unavailable (private windows, blocked site data); keep the default.
    }
  }, [tabs]);
  const choose = (next: unknown) => {
    if (typeof next !== 'string') return;
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; the choice still applies on this page.
    }
  };
  return (
    <Tabs value={value} onValueChange={choose} className="max-w-xl gap-3">
      <TabsList aria-label="Coding agent" className="w-full sm:w-fit">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className="px-1.5 text-xs sm:px-2.5 sm:text-sm"
          >
            {tab.label}
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                tab.installed ? 'bg-foreground' : 'border border-muted-foreground/60',
              )}
            />
            <span className="sr-only">{tab.installed ? ', installed' : ', not installed'}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="flex flex-col gap-2">
          {tab.panel}
        </TabsContent>
      ))}
    </Tabs>
  );
}

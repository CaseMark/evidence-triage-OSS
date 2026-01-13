"use client";

import { useState, useEffect } from "react";
import { X, Lightning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface DemoModeBannerProps {
  className?: string;
  dismissible?: boolean;
}

export function DemoModeBanner({
  className,
  dismissible = true,
}: DemoModeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem("demo-banner-dismissed");
    if (isDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("demo-banner-dismissed", "true");
  };

  if (dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-950/50 dark:to-orange-950/50",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              <Lightning className="h-3 w-3" weight="fill" />
              DEMO MODE
            </span>
            <span className="text-sm text-amber-800 dark:text-amber-200">
              You&apos;re using a demo version of Evidence Triage. Please avoid uploading sensitive or confidential data.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="rounded p-1 text-amber-600 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-800"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

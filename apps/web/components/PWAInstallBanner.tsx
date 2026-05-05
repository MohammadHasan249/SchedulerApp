"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // iOS detection (no beforeinstallprompt, show manual instructions)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Dismissed previously this session
    if (sessionStorage.getItem("pwa-banner-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setPrompt(null);
  };

  if (isInstalled || dismissed || (!prompt && !isIOS)) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe bg-slate-900 border-t border-slate-700 flex items-center gap-3 shadow-2xl lg:max-w-sm lg:left-auto lg:right-4 lg:bottom-4 lg:rounded-xl lg:border">
      <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
        <Download className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Install the app</p>
        {isIOS ? (
          <p className="text-xs text-slate-400">
            Tap <span className="font-medium text-slate-300">Share</span> → <span className="font-medium text-slate-300">Add to Home Screen</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400">Get quick access from your home screen</p>
        )}
      </div>
      {!isIOS && (
        <Button size="sm" onClick={install} className="flex-shrink-0">
          Install
        </Button>
      )}
      <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

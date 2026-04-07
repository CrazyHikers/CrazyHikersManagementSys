"use client";

import { useEffect, useRef, useCallback } from "react";
import Script from "next/script";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const renderedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (
      renderedRef.current ||
      !containerRef.current ||
      !window.turnstile
    )
      return;

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey) {
      console.error("[TURNSTILE] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set");
      return;
    }

    renderedRef.current = true;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      callback: onVerify,
      "expired-callback": onExpire,
      theme: "auto",
      size: "normal",
    });
  }, [onVerify, onExpire]);

  useEffect(() => {
    // If script already loaded, render immediately
    if (window.turnstile) {
      renderWidget();
    }
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
        renderedRef.current = false;
      }
    };
  }, [renderWidget]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={containerRef} />
    </>
  );
}

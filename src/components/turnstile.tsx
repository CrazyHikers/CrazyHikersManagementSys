"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import Script from "next/script";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export interface TurnstileHandle {
  reset: () => void;
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

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  function Turnstile({ onVerify, onExpire }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const renderedRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          onExpire?.();
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      }),
      [onExpire]
    );

    const renderWidget = useCallback(() => {
      if (
        renderedRef.current ||
        !containerRef.current ||
        !window.turnstile
      )
        return;

      // Cloudflare's official "always passes" testing site key — used on any
      // non-production deploy so Vercel preview URLs work without adding each
      // random *.vercel.app hostname to the Turnstile allowlist.
      // https://developers.cloudflare.com/turnstile/troubleshooting/testing/
      const TEST_SITE_KEY_ALWAYS_PASS = "1x00000000000000000000AA";
      const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
      const sitekey = isProduction
        ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
        : TEST_SITE_KEY_ALWAYS_PASS;
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
);

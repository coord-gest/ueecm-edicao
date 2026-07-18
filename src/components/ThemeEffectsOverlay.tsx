import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_THEME_CONFIG,
  fetchThemeConfig,
  getPreset,
  type ThemeConfig,
} from "@/lib/theme-effects";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

/**
 * Overlay global que renderiza partículas (emojis) caindo suavemente
 * conforme o tema sazonal ativo. Não intercepta cliques (pointer-events:none).
 * Respeita prefers-reduced-motion.
 */
export function ThemeEffectsOverlay() {
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchThemeConfig().then((c) => {
      if (alive) setConfig(c);
    });

    // realtime updates: quando um staff alterar, reflete em todos os clientes
    const channel = supabase
      .channel(uniqueRealtimeChannelName("configuracoes_tema_changes"))
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_tema" }, () => {
        fetchThemeConfig().then((c) => alive && setConfig(c));
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const preset = getPreset(config.tema);
  const sprites = preset.images && preset.images.length > 0 ? preset.images : null;
  const hasAny = sprites ? sprites.length > 0 : preset.emojis.length > 0;

  const particles = useMemo(() => {
    if (!config.ativo || !hasAny) return [];
    const count = reduced ? Math.min(8, Math.floor(config.intensidade / 4)) : config.intensidade;
    const pool = sprites ?? preset.emojis;
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      sprite: pool[i % pool.length],
      left: Math.random() * 100,
      delay: Math.random() * 12,
      duration: 10 + Math.random() * 14,
      size: sprites ? 36 + Math.random() * 36 : 16 + Math.random() * 20,
      drift: (Math.random() - 0.5) * 40,
      rotate: Math.random() * 360,
      opacity: 0.7 + Math.random() * 0.25,
    }));
  }, [config, preset, reduced, sprites, hasAny]);

  if (!config.ativo || !hasAny || hidden) return null;

  return (
    <>
      <style>{`
        @keyframes theme-fx-fall {
          0%   { transform: translate3d(0, -15vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: var(--fx-op, 0.85); }
          90%  { opacity: var(--fx-op, 0.85); }
          100% { transform: translate3d(var(--fx-drift, 0px), 115vh, 0) rotate(var(--fx-rot, 180deg)); opacity: 0; }
        }
        .theme-fx-root {
          position: fixed; inset: 0; z-index: 40;
          pointer-events: none; overflow: hidden;
          contain: strict;
        }
        .theme-fx-glow {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at top, var(--fx-glow, transparent), transparent 60%);
          pointer-events: none;
        }
        .theme-fx-particle {
          position: absolute; top: 0;
          will-change: transform, opacity;
          animation-name: theme-fx-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          user-select: none;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }
        .theme-fx-particle img {
          width: 100%; height: 100%;
          object-fit: contain;
          display: block;
          pointer-events: none;
          -webkit-user-drag: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .theme-fx-particle { animation-duration: 30s !important; }
        }
      `}</style>
      <div className="theme-fx-root" aria-hidden="true">
        {preset.glow && (
          <div className="theme-fx-glow" style={{ ["--fx-glow" as string]: preset.glow }} />
        )}
        {particles.map((p) => (
          <span
            key={p.key}
            className="theme-fx-particle"
            style={{
              left: `${p.left}%`,
              width: sprites ? `${p.size}px` : undefined,
              height: sprites ? `${p.size}px` : undefined,
              fontSize: sprites ? undefined : `${p.size}px`,
              animationDelay: `-${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--fx-drift" as string]: `${p.drift}vw`,
              ["--fx-rot" as string]: `${p.rotate}deg`,
              ["--fx-op" as string]: p.opacity,
            }}
          >
            {sprites ? (
              <img src={p.sprite as string} alt="" loading="lazy" decoding="async" />
            ) : (
              p.sprite
            )}
          </span>
        ))}
      </div>
    </>
  );
}

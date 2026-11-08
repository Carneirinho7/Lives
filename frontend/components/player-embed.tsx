"use client";

import { useEffect, useRef, useState } from "react";
import type { Stream } from "@/shared/types";

type Props = {
  stream: Stream;
  onPing: (streamId: string) => Promise<void>;
  onActivity: (streamId: string, active: boolean) => void;
};

export function PlayerEmbed({ stream, onPing, onActivity }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [pageActive, setPageActive] = useState(false);
  const [parentDomain, setParentDomain] = useState("localhost");
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [pingBusy, setPingBusy] = useState(false);
  const isActive = inView && pageActive;

  useEffect(() => {
    onActivity(stream.id, isActive);
    return () => onActivity(stream.id, false);
  }, [isActive, onActivity, stream.id]);

  // IntersectionObserver pausa o contador quando pelo menos metade do card sai da tela.
  useEffect(() => {
    setParentDomain(window.location.hostname);
  }, []);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A Page Visibility API pausa a contagem em abas minimizadas ou em segundo plano.
  useEffect(() => {
    const syncVisibility = () => setPageActive(document.visibilityState === "visible");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  // Só avança o relógio enquanto esta live está visível e a aba está ativa.
  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;
        setPingBusy(true);
        void onPing(stream.id).finally(() => setPingBusy(false));
        return 60;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isActive, onPing, stream.id]);

  const playerUrl = stream.platform === "twitch"
    ? `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelName)}&parent=${encodeURIComponent(parentDomain)}&autoplay=false&muted=true`
    : `https://player.kick.com/${encodeURIComponent(stream.channelName)}?autoplay=false&muted=true`;

  return (
    <div ref={wrapperRef} className="player-frame">
      <iframe
        src={playerUrl}
        title={`Live de ${stream.channelName} no ${stream.platform}`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        // Kick envia a origem como Referer, sem parâmetros de embed não documentados.
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="player-status">
        <span className={`status-dot ${isActive ? "status-dot-active" : ""}`} />
        <span>{pingBusy ? "Registrando pontos LiveLoot…" : isActive ? `Ponto LiveLoot em ${secondsLeft}s` : "Pontos LiveLoot pausados"}</span>
      </div>
    </div>
  );
}

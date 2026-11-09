"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Stream } from "@/shared/types";

type TwitchPlayer = {
  addEventListener: (event: string, callback: () => void) => void;
  isPaused: () => boolean;
};

type TwitchEmbedInstance = {
  addEventListener: (event: string, callback: () => void) => void;
  getPlayer: () => TwitchPlayer;
};

type TwitchEmbedConstructor = {
  new (elementId: string, options: Record<string, unknown>): TwitchEmbedInstance;
  VIDEO_READY: string;
  VIDEO_PLAY: string;
};

declare global {
  interface Window {
    Twitch?: { Embed: TwitchEmbedConstructor; Player: Record<string, string> };
  }
}

type PlayerStatus = "loading" | "ready" | "playing" | "paused" | "offline" | "unavailable" | "unverified";

let twitchSdkPromise: Promise<void> | undefined;

function loadTwitchSdk() {
  if (window.Twitch?.Embed) return Promise.resolve();
  if (!twitchSdkPromise) {
    twitchSdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://embed.twitch.tv/embed/v1.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Twitch SDK could not be loaded"));
      document.head.appendChild(script);
    });
  }
  return twitchSdkPromise;
}

const statusText: Record<PlayerStatus, string> = {
  loading: "Carregando player oficial…",
  ready: "Player pronto. Inicie a reprodução.",
  playing: "Reprodução detectada; pontos oficiais não confirmados.",
  paused: "Player pausado. Clique para reproduzir.",
  offline: "Canal offline no player.",
  unavailable: "Não foi possível carregar o player. Abra o canal oficial.",
  unverified: "Player carregado; reprodução e pontos não são verificáveis aqui.",
};

export function PlayerEmbed({ stream }: { stream: Stream }) {
  const elementId = useId().replaceAll(":", "");
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [kickLoaded, setKickLoaded] = useState(false);
  const twitchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stream.platform !== "twitch") return;
    let cancelled = false;
    let pollId: number | undefined;
    let player: TwitchPlayer | undefined;
    const mount = twitchRef.current;

    void loadTwitchSdk().then(() => {
      if (cancelled || !mount || !window.Twitch?.Embed) return;
      const embed = new window.Twitch.Embed(elementId, {
        channel: stream.channelName,
        width: "100%",
        height: "100%",
        layout: "video",
        autoplay: false,
        muted: true,
        parent: [window.location.hostname],
      });

      embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
        if (cancelled) return;
        player = embed.getPlayer();
        setStatus("ready");
        const syncPlayback = () => {
          try {
            setStatus(player?.isPaused() ? "paused" : "playing");
          } catch {
            setStatus("unavailable");
          }
        };
        pollId = window.setInterval(syncPlayback, 3000);
        const pauseEvent = window.Twitch?.Player.PAUSE;
        if (pauseEvent) player.addEventListener(pauseEvent, () => setStatus("paused"));
        const offlineEvent = window.Twitch?.Player.OFFLINE;
        if (offlineEvent) player.addEventListener(offlineEvent, () => setStatus("offline"));
      });
      embed.addEventListener(window.Twitch.Embed.VIDEO_PLAY, () => {
        if (!cancelled) setStatus("playing");
      });
    }).catch(() => {
      if (!cancelled) setStatus("unavailable");
    });

    return () => {
      cancelled = true;
      if (pollId !== undefined) window.clearInterval(pollId);
      mount?.replaceChildren();
    };
  }, [elementId, stream.channelName, stream.platform]);

  const channelUrl = `https://${stream.platform === "twitch" ? "www.twitch.tv" : "kick.com"}/${encodeURIComponent(stream.channelName)}`;
  const displayedStatus = stream.platform === "kick" && kickLoaded ? "unverified" : status;
  const needsAttention = displayedStatus !== "playing";

  return (
    <>
      <div className="player-frame">
        {stream.platform === "twitch" ? (
          <div id={elementId} ref={twitchRef} className="twitch-player-mount" />
        ) : (
          <iframe
            src={`https://player.kick.com/${encodeURIComponent(stream.channelName)}?autoplay=false&muted=true`}
            title={`Live de ${stream.channelName} na Kick`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setKickLoaded(true)}
            onError={() => { setKickLoaded(false); setStatus("unavailable"); }}
          />
        )}
      </div>
      <div className={`player-status ${needsAttention ? "player-status-attention" : "player-status-playing"}`} role="status" aria-live="polite">
        <span className={`status-dot ${needsAttention ? "" : "status-dot-active"}`} />
        <span>{statusText[displayedStatus]}</span>
        <a href={channelUrl} target="_blank" rel="noopener noreferrer">Abrir canal oficial ↗</a>
      </div>
    </>
  );
}

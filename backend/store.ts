import type { Stream } from "@/shared/types";

const seedStreams: Stream[] = [
  { id: "twitch-clovaobengala", channelName: "clovaobengala", platform: "twitch", category: "PokéIdle", viewers: "ao vivo", title: "PokéIdle — clovaobengala" },
  { id: "kick-clovaobengalalol", channelName: "clovaobengalalol", platform: "kick", category: "PokéIdle", viewers: "ao vivo", title: "PokéIdle — clovaobengalalol" },
  { id: "twitch-surskity11", channelName: "surskity11", platform: "twitch", category: "PokéIdle", viewers: "ao vivo", title: "PokéIdle — surskity11" },
  { id: "twitch-kennzy", channelName: "kennzy", platform: "twitch", category: "PokéIdle", viewers: "ao vivo", title: "PokéIdle — kennzy" },
  { id: "twitch-rodil", channelName: "rodil", platform: "twitch", category: "PokéIdle", viewers: "ao vivo", title: "PokéIdle — rodil" },
];

export function getStreams() {
  return seedStreams;
}

const pingRuntime = globalThis as typeof globalThis & { liveLootLocalPings?: Map<string, number> };
const localPings = (pingRuntime.liveLootLocalPings ??= new Map());

export function applyLocalPing(userId: string, streamId: string, increment: () => number) {
  const key = `${userId}:${streamId}`;
  const now = Date.now();
  const lastPingAt = localPings.get(key);
  const retryAfter = lastPingAt === undefined ? 0 : Math.ceil((60_000 - (now - lastPingAt)) / 1000);
  if (retryAfter > 0) {
    return { ok: false as const, status: 429, error: "Aguarde para receber os proximos pontos.", retryAfter };
  }
  const pointsBalance = increment();
  localPings.set(key, now);
  return { ok: true as const, pointsBalance, awarded: 5 };
}

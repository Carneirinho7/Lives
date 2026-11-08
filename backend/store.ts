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

const pingRuntime = globalThis as typeof globalThis & {
  livePointsPings?: Map<string, number>;
};
const lastPings = (pingRuntime.livePointsPings ??= new Map());

export function applyPing(userId: string, streamId: string, increment: () => number) {
  if (!seedStreams.some((stream) => stream.id === streamId)) {
    return { ok: false as const, status: 404, error: "Live não encontrada." };
  }

  const key = `${userId}:${streamId}`;
  const now = Date.now();
  const lastPingAt = lastPings.get(key) ?? null;
  const retryAfter = lastPingAt === null ? 0 : Math.ceil((60_000 - (now - lastPingAt)) / 1000);

  if (retryAfter > 0) {
    return { ok: false as const, status: 429, error: "Aguarde para receber os próximos pontos.", retryAfter };
  }

  const pointsBalance = increment();
  lastPings.set(key, now);
  return { ok: true as const, pointsBalance, awarded: 5 };
}

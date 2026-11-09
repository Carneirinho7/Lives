import type { Stream } from "@/shared/types";

const seedStreams: Stream[] = [
  { id: "twitch-clovaobengala", channelName: "clovaobengala", platform: "twitch", category: "PokéIdle", title: "Canal clovaobengala" },
  { id: "kick-clovaobengalalol", channelName: "clovaobengalalol", platform: "kick", category: "PokéIdle", title: "Canal clovaobengalalol" },
  { id: "twitch-surskity11", channelName: "surskity11", platform: "twitch", category: "PokéIdle", title: "Canal surskity11" },
  { id: "twitch-kennzy", channelName: "kennzy", platform: "twitch", category: "PokéIdle", title: "Canal kennzy" },
  { id: "twitch-rodil", channelName: "rodil", platform: "twitch", category: "PokéIdle", title: "Canal rodil" },
];

export function getStreams() {
  return seedStreams;
}

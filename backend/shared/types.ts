export type Platform = "twitch" | "kick";

export type User = {
  id: string;
  name: string;
  email: string;
  pointsBalance: number;
  role: string;
};

export type Stream = {
  id: string;
  channelName: string;
  platform: Platform;
  category: string;
  viewers: string;
  title: string;
};

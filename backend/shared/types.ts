export type Platform = "twitch" | "kick";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type Stream = {
  id: string;
  channelName: string;
  platform: Platform;
  category: string;
  title: string;
};

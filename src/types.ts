export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  order: number;
}

export interface AppConfig {
  initialAdDuration: number;
  hourlyAdInterval: number;
  adVideoUrl: string;
}

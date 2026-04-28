import { Channel, AppConfig } from './types';

export const MOCK_CHANNELS: Channel[] = [
  {
    id: '1',
    name: 'Titas Live 1',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    logo: 'https://cdn-icons-png.flaticon.com/512/716/716429.png',
    order: 1
  },
  {
    id: '2',
    name: 'Titas Live 2',
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    logo: 'https://cdn-icons-png.flaticon.com/512/716/716429.png',
    order: 2
  },
  {
    id: '3',
    name: 'Titas Sports',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    logo: 'https://cdn-icons-png.flaticon.com/512/716/716429.png',
    order: 3
  }
];

export const DEFAULT_CONFIG: AppConfig = {
  initialAdDuration: 5,
  hourlyAdInterval: 3600,
  adVideoUrl: 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd'
};

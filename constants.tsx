
import { VideoTemplate } from './types';

export const TEMPLATES: VideoTemplate[] = [
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    previewUrl: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-gradient-to-tr from-amber-900 via-yellow-700 to-amber-900',
    textStyle: 'text-amber-50 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] font-serif'
  },
  {
    id: 'ocean-calm',
    name: 'Ocean Calm',
    previewUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-gradient-to-b from-cyan-900 via-blue-800 to-slate-900',
    textStyle: 'text-cyan-50 drop-shadow-md'
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Deen',
    previewUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-gradient-to-br from-emerald-900 to-teal-950',
    textStyle: 'text-emerald-50'
  },
  {
    id: 'minimalist-white',
    name: 'Pure White',
    previewUrl: 'https://images.unsplash.com/photo-1470790376778-a9fbc86d70e2?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-slate-50 border-x-8 border-slate-200',
    textStyle: 'text-slate-900 font-bold'
  },
  {
    id: 'sunset-prayer',
    name: 'Maghrib Sky',
    previewUrl: 'https://images.unsplash.com/photo-1472120482482-d43ba79ff510?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-gradient-to-t from-orange-600 via-purple-900 to-black',
    textStyle: 'text-orange-50 drop-shadow-lg'
  },
  {
    id: 'midnight-quran',
    name: 'Midnight Reflection',
    previewUrl: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-slate-950',
    textStyle: 'text-indigo-200'
  },
  {
    id: 'vintage-paper',
    name: 'Ancient Script',
    previewUrl: 'https://images.unsplash.com/photo-1519750783826-e2420f4d687f?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-[#f4e4bc] border-8 border-[#d4c49c]',
    textStyle: 'text-sepia-900 font-serif italic'
  },
  {
    id: 'modern-dark',
    name: 'Slate Modern',
    previewUrl: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-slate-900',
    textStyle: 'text-slate-100 font-light'
  },
  {
    id: 'soft-lavender',
    name: 'Peaceful Lilac',
    previewUrl: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=200&h=355',
    bgClass: 'bg-gradient-to-tr from-purple-100 to-indigo-200',
    textStyle: 'text-indigo-900 font-medium'
  }
];

export const VOICES = [
  { id: 'Kore', name: 'Kore (Authoritative)', lang: 'English' },
  { id: 'Puck', name: 'Puck (Narrative)', lang: 'English' },
  { id: 'Zephyr', name: 'Zephyr (Friendly)', lang: 'English' },
  { id: 'Charon', name: 'Charon (Deep/Calm)', lang: 'English' },
  { id: 'Fenrir', name: 'Fenrir (Fast/Direct)', lang: 'English' }
];

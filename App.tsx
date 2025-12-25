
import React, { useState, useEffect, useRef } from 'react';
import { Hadith, VideoSettings, GenerationState } from './types.ts';
import { TEMPLATES, VOICES, HADITH_CATEGORIES } from './constants.tsx';
import { HadithService } from './services/geminiService.ts';
import VideoPreview, { VideoPreviewHandle } from './components/VideoPreview.tsx';

async function decodeRawPcm(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [hadith, setHadith] = useState<Hadith | null>(null);
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<VideoSettings>({
    templateId: TEMPLATES[0].id,
    fontSize: 24,
    voice: 'Kore',
    includeArabic: true,
    category: 'random'
  });
  
  const [genState, setGenState] = useState<GenerationState>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  const previewRef = useRef<VideoPreviewHandle>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initial Load
  useEffect(() => {
    fetchHadith('random');
  }, []);

  const fetchHadith = async (categoryOverride?: string) => {
    const catId = categoryOverride || settings.category;
    const activeCategory = HADITH_CATEGORIES.find(c => c.id === catId) || HADITH_CATEGORIES[0];
    
    setGenState({ status: 'fetching_hadith', progress: 10, message: `Discovering ${activeCategory.name}...` });
    setFinalVideoUrl(null);
    try {
      const data = await HadithService.getRandomAuthenticHadith(activeCategory.query);
      setHadith(data);
      
      const template = TEMPLATES.find(t => t.id === settings.templateId);
      const bgQuery = `islamic mosque architecture ${catId === 'random' ? 'peaceful nature' : catId}`;
      const video = await HadithService.getPexelsVideo(bgQuery);
      setBackgroundVideo(video);
      
      setGenState({ status: 'idle', progress: 0, message: '' });
    } catch (error: any) {
      console.error("Fetch error:", error);
      setGenState({ status: 'error', progress: 0, message: 'Source unavailable. Trying again...' });
      setTimeout(() => fetchHadith(catId), 2000);
    }
  };

  const handleCategoryChange = (catId: string) => {
    setSettings(prev => ({ ...prev, category: catId }));
    fetchHadith(catId);
  };

  const generateFullVideo = async () => {
    if (!hadith || !previewRef.current) return;
    
    setGenState({ status: 'generating_tts', progress: 10, message: 'Narrating with AI...' });
    setFinalVideoUrl(null);
    
    try {
      const base64Audio = await HadithService.generateVoiceover(hadith.english, settings.voice);
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioBuffer = await decodeRawPcm(bytes, audioContextRef.current, 24000, 1);

      setGenState({ status: 'generating_video', progress: 40, message: 'Crafting Final Short...' });
      const canvas = previewRef.current.getCanvas();
      const bgVideo = previewRef.current.getVideoElement();
      if (!canvas) throw new Error("Studio Monitor not ready");

      const canvasStream = canvas.captureStream(30);
      const audioDest = audioContextRef.current.createMediaStreamDestination();
      const audioSource = audioContextRef.current.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(audioDest);

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks()
      ]);

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Recording not supported");

      const recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 6000000 
      });
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        setFinalVideoUrl(URL.createObjectURL(finalBlob));
        setGenState({ status: 'complete', progress: 100, message: 'Short Production Complete!' });
      };

      recorder.start();
      audioSource.start();

      if (bgVideo && bgVideo.paused) {
        bgVideo.play().catch(console.error);
      }

      const durationMs = audioBuffer.duration * 1000;
      let elapsed = 0;
      const progressInterval = setInterval(() => {
        elapsed += 100;
        const p = Math.min(40 + (elapsed / durationMs) * 60, 99);
        setGenState(prev => ({ ...prev, progress: Math.floor(p) }));
        
        if (elapsed >= durationMs) {
          clearInterval(progressInterval);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, 100);

    } catch (error: any) {
      console.error("Recording error:", error);
      setGenState({ 
        status: 'error', 
        progress: 0, 
        message: `Error: ${error.message}` 
      });
    }
  };

  const activeCategory = HADITH_CATEGORIES.find(c => c.id === settings.category) || HADITH_CATEGORIES[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-lg text-white font-bold shadow-md shadow-emerald-100">HS</div>
          <h1 className="text-xl font-bold tracking-tight">HadithShorts <span className="text-emerald-600">AI</span></h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-1 space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-4">Choose Category</h2>
          <div className="grid grid-cols-1 gap-2">
            {HADITH_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all hover:translate-x-1 ${settings.category === cat.id ? 'border-emerald-600 bg-emerald-50 shadow-md' : 'border-transparent bg-white hover:bg-slate-50 opacity-80 hover:opacity-100'}`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <div className="text-left">
                  <div className={`text-sm font-bold ${settings.category === cat.id ? 'text-emerald-700' : 'text-slate-700'}`}>{cat.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{cat.description}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="font-black text-xl text-slate-900">Current Narration</h2>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Category: <span className="text-emerald-600 font-bold">{activeCategory.name}</span></p>
              </div>
              <button 
                onClick={() => fetchHadith()} 
                disabled={genState.status === 'fetching_hadith'}
                className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 group"
              >
                <svg className={`w-5 h-5 transition-transform group-hover:rotate-180 duration-500 ${genState.status === 'fetching_hadith' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Shuffle {activeCategory.name}
              </button>
            </div>
            
            {hadith ? (
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-500 relative overflow-hidden">
                <p className="font-arabic text-right text-4xl mb-8 leading-[1.8] text-slate-900">{hadith.arabic}</p>
                <div className="h-px bg-slate-200 mb-8 w-full" />
                <p className="text-slate-700 italic text-xl leading-relaxed font-medium">"{hadith.english}"</p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <div className="flex flex-col gap-1 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</span>
                    <span className="text-xs font-bold text-slate-800">{hadith.source}</span>
                  </div>
                  <div className="flex flex-col gap-1 bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-2xl shadow-sm">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Grade</span>
                    <span className="text-xs font-bold text-emerald-800">{hadith.grade}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50">
                <p className="text-sm font-black uppercase tracking-widest animate-pulse">Seeking authentic wisdom...</p>
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="font-black text-xl text-slate-900 mb-8">Video Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Visual Style</label>
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATES.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setSettings(s => ({...s, templateId: t.id}))}
                      className={`relative aspect-[9/16] rounded-2xl overflow-hidden border-[3px] transition-all hover:scale-105 active:scale-95 ${settings.templateId === t.id ? 'border-emerald-600 ring-4 ring-emerald-500/10' : 'border-transparent opacity-60'}`}
                    >
                      <img src={t.previewUrl} className="w-full h-full object-cover" alt={t.name} />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-md text-[8px] text-white py-2 text-center font-black uppercase">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-8 flex flex-col justify-center">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Narrator Voice</label>
                  <select 
                    className="w-full bg-slate-50 p-5 rounded-2xl border-2 border-slate-100 outline-none focus:border-emerald-500 font-bold transition-all"
                    value={settings.voice}
                    onChange={(e) => setSettings(s => ({...s, voice: e.target.value as any}))}
                  >
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>

                <div 
                  className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 transition-all cursor-pointer" 
                  onClick={() => setSettings(s => ({...s, includeArabic: !s.includeArabic}))}
                >
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-slate-900 uppercase">Arabic Text</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase">Enable Calligraphy</span>
                  </div>
                  <div className={`w-14 h-8 rounded-full transition-all relative ${settings.includeArabic ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${settings.includeArabic ? 'left-7' : 'left-1'}`} />
                  </div>
                </div>

                <button 
                  onClick={generateFullVideo}
                  disabled={!hadith || genState.status !== 'idle'}
                  className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-200 hover:bg-black transition-all transform active:scale-[0.98] flex items-center justify-center gap-4 group"
                >
                  <div className="bg-emerald-500 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </div>
                  Produce Short
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Studio Monitor */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Studio Monitor</h2>
          
          <div className="relative">
            <VideoPreview 
              ref={previewRef}
              hadith={hadith}
              template={TEMPLATES.find(t => t.id === settings.templateId)!}
              settings={settings}
              videoUrl={backgroundVideo || undefined}
              isGenerating={genState.status !== 'idle' && genState.status !== 'complete' && genState.status !== 'error'}
            />
          </div>

          {(genState.status !== 'idle' && genState.status !== 'complete') && (
            <div className="bg-white p-6 rounded-[2rem] border-2 border-emerald-50 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{genState.message}</span>
                <span className="text-xs font-black text-emerald-600">{Math.floor(genState.progress)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${genState.progress}%` }} />
              </div>
            </div>
          )}

          {genState.status === 'complete' && finalVideoUrl && (
            <div className="bg-white p-6 rounded-[2rem] border-4 border-emerald-500 shadow-2xl animate-in slide-in-from-top-4 duration-500">
              <video src={finalVideoUrl} controls className="w-full aspect-[9/16] rounded-2xl mb-6 bg-black" playsInline autoPlay />
              <a 
                href={finalVideoUrl} 
                download={`HadithShort_${settings.category}_${Date.now()}.webm`}
                className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download HD
              </a>
            </div>
          )}
        </div>
      </main>

      <footer className="py-12 text-center opacity-40">
        <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">HadithShorts AI • Verified Authentic Content</div>
      </footer>
    </div>
  );
};

export default App;

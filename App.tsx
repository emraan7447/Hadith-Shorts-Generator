
import React, { useState, useEffect, useRef } from 'react';
import { Hadith, VideoSettings, GenerationState } from './types';
import { TEMPLATES, VOICES } from './constants';
import { HadithService } from './services/geminiService';
import VideoPreview, { VideoPreviewHandle } from './components/VideoPreview';

/**
 * Manual decoder for raw PCM audio data returned by Gemini TTS.
 * The browser's native decodeAudioData expects a file header (WAV/MP3),
 * which the raw PCM data from the API does not have.
 */
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
      // Convert 16-bit PCM to float range [-1, 1]
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
    includeArabic: true
  });
  
  const [genState, setGenState] = useState<GenerationState>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  const previewRef = useRef<VideoPreviewHandle>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const fetchHadith = async () => {
    setGenState({ status: 'fetching_hadith', progress: 10, message: 'Fetching authentic Hadith...' });
    setFinalVideoUrl(null);
    try {
      const data = await HadithService.getRandomAuthenticHadith();
      setHadith(data);
      
      const template = TEMPLATES.find(t => t.id === settings.templateId);
      const query = `islamic ${template?.name || 'mosque'} calm scenery prayer landscape`;
      const video = await HadithService.getPexelsVideo(query);
      setBackgroundVideo(video);
      
      setGenState({ status: 'idle', progress: 0, message: '' });
    } catch (error: any) {
      console.error("Hadith fetch error:", error);
      setGenState({ status: 'error', progress: 0, message: 'Check your internet or API keys.' });
    }
  };

  const generateFullVideo = async () => {
    if (!hadith || !previewRef.current) return;
    
    setGenState({ status: 'generating_tts', progress: 10, message: 'Preparing voiceover...' });
    setFinalVideoUrl(null);
    
    try {
      // 1. Generate Voiceover Audio (Raw PCM Base64)
      const base64Audio = await HadithService.generateVoiceover(hadith.english, settings.voice);
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Initialize AudioContext if not already done
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000 // Match TTS default
        });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // 2. Manual Decode of Raw PCM (24kHz Mono)
      const audioBuffer = await decodeRawPcm(bytes, audioContextRef.current, 24000, 1);

      setGenState({ status: 'generating_video', progress: 40, message: 'Rendering video & audio...' });
      const canvas = previewRef.current.getCanvas();
      const bgVideo = previewRef.current.getVideoElement();
      if (!canvas) throw new Error("Canvas monitor not ready");

      // 3. Setup Recording Stream
      // Ensure the canvas is "active" by capturing the stream
      const canvasStream = canvas.captureStream(30);
      const audioDest = audioContextRef.current.createMediaStreamDestination();
      const audioSource = audioContextRef.current.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(audioDest);

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks()
      ]);

      // Detect supported container
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ].find(type => MediaRecorder.isTypeSupported(type));
      
      if (!mimeType) throw new Error("No supported video format in this browser.");

      const recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 5000000 // 5Mbps for high quality
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

      // 4. Start the Process
      recorder.start();
      audioSource.start();

      // Ensure background video plays if it exists
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
      console.error("Recording process error:", error);
      setGenState({ 
        status: 'error', 
        progress: 0, 
        message: `Error: ${error.message || 'System failed to initialize.'}` 
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-lg text-white font-bold shadow-md shadow-emerald-100">HS</div>
          <h1 className="text-xl font-bold tracking-tight">HadithShorts <span className="text-emerald-600">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
            Standard Version
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Content Selector */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="font-bold text-lg text-slate-800">1. Source Selection</h2>
                <p className="text-xs text-slate-500">Authentic Hadiths from verified databases</p>
              </div>
              <button 
                onClick={fetchHadith} 
                disabled={genState.status === 'fetching_hadith'}
                className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-100"
              >
                {genState.status === 'fetching_hadith' ? 'Fetching...' : 'Random Hadith'}
              </button>
            </div>
            
            {hadith ? (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-in fade-in duration-500">
                <p className="font-arabic text-right text-3xl mb-6 leading-[1.8] text-slate-900">{hadith.arabic}</p>
                <div className="h-px bg-slate-200 mb-6 w-full" />
                <p className="text-slate-700 italic text-lg leading-relaxed">"{hadith.english}"</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Ref</span>
                    <span className="text-xs font-bold text-slate-700">{hadith.source}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Grade</span>
                    <span className="text-xs font-bold text-emerald-700">{hadith.grade}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <svg className="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm font-medium">Click the button to load a Hadith</p>
              </div>
            )}
          </div>

          {/* Customization */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg text-slate-800 mb-6">2. Production Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Atmospheric Visuals (Pexels)</label>
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATES.slice(0, 6).map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => {
                        setSettings(s => ({...s, templateId: t.id}));
                        setFinalVideoUrl(null);
                      }}
                      className={`relative aspect-[9/16] rounded-xl overflow-hidden border-4 transition-all hover:scale-105 active:scale-95 ${settings.templateId === t.id ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-transparent grayscale-[20%] opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                    >
                      <img src={t.previewUrl} className="w-full h-full object-cover" alt={t.name} />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm text-[9px] text-white py-1.5 text-center font-bold">{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Narrator Voice (TTS)</label>
                  <select 
                    className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
                    value={settings.voice}
                    onChange={(e) => {
                      setSettings(s => ({...s, voice: e.target.value as any}));
                      setFinalVideoUrl(null);
                    }}
                  >
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200 transition-all hover:bg-slate-100/50 cursor-pointer" onClick={() => setSettings(s => ({...s, includeArabic: !s.includeArabic}))}>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-slate-800">Arabic Overlay</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Render Calligraphy</span>
                  </div>
                  <div className={`w-14 h-8 rounded-full transition-all relative ${settings.includeArabic ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${settings.includeArabic ? 'left-7' : 'left-1'}`} />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={generateFullVideo}
                    disabled={!hadith || genState.status !== 'idle'}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 disabled:opacity-50 hover:bg-black transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Produce Video Short
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Studio Panel */}
        <div className="space-y-6">
          <h2 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Live Production Feed</h2>
          
          <VideoPreview 
            ref={previewRef}
            hadith={hadith}
            template={TEMPLATES.find(t => t.id === settings.templateId)!}
            settings={settings}
            videoUrl={backgroundVideo || undefined}
            isGenerating={genState.status !== 'idle' && genState.status !== 'complete' && genState.status !== 'error'}
          />

          {/* Progress Monitor */}
          {(genState.status !== 'idle' && genState.status !== 'complete') && (
            <div className={`bg-white p-6 rounded-3xl border-2 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${genState.status === 'error' ? 'border-red-100 bg-red-50/50' : 'border-emerald-50'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-black uppercase tracking-wider ${genState.status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
                  {genState.message}
                </span>
                {genState.status !== 'error' && (
                  <span className="text-xs font-black text-emerald-600 tabular-nums">
                    {Math.floor(genState.progress)}%
                  </span>
                )}
              </div>
              {genState.status !== 'error' && (
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-emerald-600 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                    style={{ width: `${genState.progress}%` }} 
                  />
                </div>
              )}
            </div>
          )}

          {/* Result Preview & Action */}
          {genState.status === 'complete' && finalVideoUrl && (
            <div className="bg-white p-6 rounded-3xl border-4 border-emerald-500 shadow-[0_20px_50px_rgba(16,185,129,0.2)] animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Master Video Ready</p>
              </div>
              
              <video 
                src={finalVideoUrl} 
                controls 
                className="w-full aspect-[9/16] rounded-2xl mb-6 bg-black shadow-lg" 
                playsInline
                autoPlay
              />
              
              <div className="space-y-3">
                <a 
                  href={finalVideoUrl} 
                  download={`HadithShort_${Date.now()}.webm`}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download HD Result
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
        Authentic Narrations • © 2025 HadithShorts AI
      </footer>
    </div>
  );
};

export default App;

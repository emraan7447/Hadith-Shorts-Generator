
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Hadith, VideoTemplate, VideoSettings } from '../types.ts';

interface VideoPreviewProps {
  hadith: Hadith | null;
  template: VideoTemplate;
  settings: VideoSettings;
  videoUrl?: string;
  isGenerating: boolean;
}

export interface VideoPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getVideoElement: () => HTMLVideoElement | null;
}

const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(({ 
  hadith, 
  template, 
  settings, 
  videoUrl, 
  isGenerating 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getVideoElement: () => videoRef.current
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;

      // 1. Draw Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      
      if (videoUrl && video.readyState >= 2) {
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = W / H;
        let drawW, drawH, drawX, drawY;

        if (videoAspect > canvasAspect) {
          drawH = H;
          drawW = H * videoAspect;
          drawX = (W - drawW) / 2;
          drawY = 0;
        } else {
          drawW = W;
          drawH = W / videoAspect;
          drawX = 0;
          drawY = (H - drawH) / 2;
        }
        ctx.drawImage(video, drawX, drawY, drawW, drawH);
        
        // Darken overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // 2. Draw Content
      if (hadith) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = 'white';

        const padding = 120;
        const maxWidth = W - (padding * 2);
        
        // Dynamic Font Sizing Logic
        let baseArabicSize = 64;
        let baseEnglishSize = 48;
        
        // Safety: If Hadith is very long, reduce font sizes to prevent cropping
        const totalCharCount = hadith.arabic.length + hadith.english.length;
        if (totalCharCount > 800) {
          baseArabicSize = 42;
          baseEnglishSize = 32;
        } else if (totalCharCount > 500) {
          baseArabicSize = 52;
          baseEnglishSize = 40;
        }

        // Prepare Arabic Text
        let arabicLines: string[] = [];
        if (settings.includeArabic) {
          ctx.font = `bold ${baseArabicSize}px Amiri, serif`;
          arabicLines = wrapText(ctx, hadith.arabic, maxWidth);
        }

        // Prepare English Text
        ctx.font = `500 ${baseEnglishSize}px Inter, sans-serif`;
        const englishLines = wrapText(ctx, `"${hadith.english}"`, maxWidth);

        // Calculate heights
        const arabicLineHeight = baseArabicSize * 1.5;
        const englishLineHeight = baseEnglishSize * 1.4;
        const arabicHeight = settings.includeArabic ? arabicLines.length * arabicLineHeight : 0;
        const englishHeight = englishLines.length * englishLineHeight;
        const spacing = 80;
        
        const totalContentHeight = arabicHeight + (arabicHeight > 0 ? spacing : 0) + englishHeight;
        
        // Determine start Y (Centered vertically within safe bounds)
        const headerSpace = 250;
        const footerSpace = 400;
        const availableHeight = H - headerSpace - footerSpace;
        
        let currentY = headerSpace + (availableHeight - totalContentHeight) / 2;

        // Draw Arabic
        if (settings.includeArabic) {
          ctx.font = `bold ${baseArabicSize}px Amiri, serif`;
          ctx.fillStyle = '#fef3c7'; // Soft gold for Arabic
          arabicLines.forEach((line) => {
            ctx.fillText(line, W / 2, currentY + (arabicLineHeight / 2));
            currentY += arabicLineHeight;
          });
          currentY += spacing;
        }

        // Draw English
        ctx.font = `500 ${baseEnglishSize}px Inter, sans-serif`;
        ctx.fillStyle = 'white';
        englishLines.forEach((line) => {
          ctx.fillText(line, W / 2, currentY + (englishLineHeight / 2));
          currentY += englishLineHeight;
        });

        // 3. Draw Reference & Grade (Prominent Footer)
        const footerCenterY = H - 240;
        
        // Decorative Box for Reference
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect(W/2 - 400, footerCenterY - 80, 800, 160, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Source Reference (Book, Volume, Number)
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'black';
        ctx.font = 'bold 38px Inter, sans-serif';
        ctx.fillStyle = '#fbbf24'; // Amber-400
        ctx.fillText(hadith.source.toUpperCase(), W / 2, footerCenterY - 15);

        // Grade Status
        ctx.font = '800 28px Inter, sans-serif';
        ctx.fillStyle = '#34d399'; // Emerald-400
        ctx.fillText(`VERIFIED: ${hadith.grade.toUpperCase()}`, W / 2, footerCenterY + 45);
      }

      // Branding Header
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#10b981'; // Emerald-500
      ctx.beginPath();
      ctx.roundRect(W/2 - 160, 100, 320, 70, 15);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = 'black 32px Inter, sans-serif';
      ctx.fillText('HADITH SHORTS', W/2, 138);

      requestRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [hadith, settings, videoUrl, isGenerating]);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  return (
    <div className="relative aspect-[9/16] w-full max-w-[360px] mx-auto rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] bg-black border-[14px] border-slate-900">
      <video 
        ref={videoRef}
        src={videoUrl} 
        style={{ display: 'none' }}
        autoPlay 
        loop 
        muted 
        crossOrigin="anonymous"
        playsInline
      />
      <canvas 
        ref={canvasRef}
        width={1080}
        height={1920}
        className="w-full h-full object-contain"
      />

      {isGenerating && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center z-50">
          <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-8" />
          <h3 className="text-white text-xl font-black mb-2">Finalizing Short</h3>
          <p className="text-emerald-400 text-sm font-medium animate-pulse">Syncing Audio & References...</p>
        </div>
      )}
    </div>
  );
});

export default VideoPreview;

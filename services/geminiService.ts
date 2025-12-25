
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Hadith } from "../types";

const HADITH_API_KEY = "$2y$10$jbHREOhejIkUNGEnqnX4eq49Y55wzlBVf2UVDAPoQKgK0Jpb2XDy";
const PEXELS_API_KEY = "b88Ldc0xcVaGbF3g5znBOiurvWee3OG5SvIcZuOoyQP2ZrYcG9IIGItp";

export class HadithService {
  /**
   * Fetches a real Hadith from hadithapi.com.
   */
  static async getRandomAuthenticHadith(): Promise<Hadith> {
    try {
      const randomPage = Math.floor(Math.random() * 50) + 1;
      const response = await fetch(
        `https://hadithapi.com/api/hadiths?apiKey=${HADITH_API_KEY}&paginate=10&page=${randomPage}`
      );
      
      if (!response.ok) throw new Error("Hadith API Request Failed");
      
      const data = await response.json();
      const hadiths = data.hadiths?.data || [];
      
      if (hadiths.length === 0) throw new Error("No Hadiths found");
      
      const raw = hadiths[Math.floor(Math.random() * hadiths.length)];

      // Robust extraction to avoid 'undefined'
      const bookName = raw.bookName || (raw.book && raw.book.bookName) || "Sahih Hadith";
      const hadithNum = raw.hadithNumber || raw.id || "N/A";
      const volume = raw.volume ? `Vol. ${raw.volume}` : "";
      
      return {
        arabic: raw.hadithArabic || "",
        english: raw.hadithEnglish || "Translation not available.",
        source: `${bookName} ${volume} - Hadith No. ${hadithNum}`,
        grade: raw.status || "Sahih"
      };
    } catch (error) {
      console.warn("External Hadith API failed, using fallback:", error);
      
      // Handle potential key selection requirement
      if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Provide one authentic Sahih Hadith from Sahih Bukhari or Sahih Muslim. Output ONLY a JSON object with keys: arabic, english, source (Include Book Name, Volume if possible, and Hadith Number), and grade.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              arabic: { type: Type.STRING },
              english: { type: Type.STRING },
              source: { type: Type.STRING },
              grade: { type: Type.STRING },
            },
            required: ["arabic", "english", "source", "grade"],
          },
        },
      });
      return JSON.parse(aiResponse.text || "{}");
    }
  }

  /**
   * Fetches a relevant video background from Pexels (using your provided key).
   */
  static async getPexelsVideo(query: string = "islamic scenery"): Promise<string> {
    try {
      const response = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`,
        { headers: { Authorization: PEXELS_API_KEY } }
      );
      if (!response.ok) throw new Error("Pexels fetch failed");
      const data = await response.json();
      const videos = data.videos || [];
      if (videos.length === 0) return "";
      const video = videos[Math.floor(Math.random() * videos.length)];
      const file = video.video_files.find((f: any) => f.width >= 720 && f.width <= 1080) || video.video_files[0];
      return file.link;
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  /**
   * Generates audio using Gemini TTS.
   */
  static async generateVoiceover(text: string, voiceName: string = "Kore"): Promise<string> {
    // Handle potential key selection requirement
    if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Please narrate this Hadith clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS failed. Please verify your API Key has access to the Gemini 2.5 Flash TTS model.");
    return base64Audio;
  }
}

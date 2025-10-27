
import { GoogleGenAI, Chat } from '@google/genai';
import type { GroundingSource } from '../types';

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private chat: Chat | null = null;

  constructor() {
    const apiKey = (import.meta as any)?.env?.VITE_API_KEY || (typeof process !== 'undefined' ? (process as any)?.env?.API_KEY : undefined);
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      // Sem API key: mantemos a UI funcionando e desabilitamos o chat.
      this.ai = null;
      console.warn('VITE_API_KEY/API_KEY not set. Gemini features are disabled.');
    }
  }

  private initializeChat() {
    if (!this.ai) return;
    this.chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'Você é um assistente prestativo e amigável da Federal Express, especializado em processos de solicitação de visto para o Canadá, EUA e México. Forneça informações claras, concisas e precisas. Se for perguntado sobre tópicos fora deste escopo, gentilmente guie o usuário de volta para questões relacionadas a vistos.',
        tools: [{googleSearch: {}}]
      },
    });
  }

  public resetChat() {
    this.chat = null;
  }

  public async sendChatMessage(message: string): Promise<{ text: string, sources: GroundingSource[] }> {
    if (!this.ai) {
      return { text: 'Assistente desabilitado (sem API).', sources: [] };
    }
    if (!this.chat) {
      this.initializeChat();
    }
    
    const response = await this.chat!.sendMessage({ message });
    const text = response.text;
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = groundingChunks
      .map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || '',
      }))
      .filter((source: GroundingSource) => source.uri);

    return { text, sources };
  }
  
  public async findNearbyVisaCenters(location: GeolocationCoordinates): Promise<GroundingSource[]> {
    const prompt = `Quais são os centros de solicitação de visto ou consulados oficiais para o Canadá, Estados Unidos e México perto da latitude ${location.latitude} e longitude ${location.longitude}?`;

    const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        // FIX: Moved `toolConfig` inside the `config` object as per the API specification.
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                    }
                }
            }
        },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const centers: GroundingSource[] = groundingChunks
        .map((chunk: any) => ({
            uri: chunk.maps?.uri || '',
            title: chunk.maps?.title || ''
        }))
        .filter((center: GroundingSource) => center.uri && center.title);

    if (centers.length === 0) {
        // Fallback or additional info if no specific places found
        console.log("No specific map locations found, providing text response.");
    }
    
    // For this app, we prioritize the grounded map results.
    return centers;
  }
}

export const geminiService = new GeminiService();

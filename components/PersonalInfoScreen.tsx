
import React, { useState, useEffect, useRef } from 'react';
import type { UserData } from '../types';
import { validateCPF, validateEmail, validatePhone } from '../services/validationService';
// FIX: Removed 'LiveSession' as it is not an exported member of '@google/genai'.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

// Base64 encoding/decoding functions for audio data
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const InputField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder: string;
  type?: string;
}> = ({ id, label, value, onChange, error, placeholder, type = "text" }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      id={id}
      name={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-600'}`}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);


interface PersonalInfoScreenProps {
  onNext: () => void;
  userData: Partial<UserData>;
  setUserData: React.Dispatch<React.SetStateAction<Partial<UserData>>>;
}

const PersonalInfoScreen: React.FC<PersonalInfoScreenProps> = ({ onNext, userData, setUserData }) => {
  const [formData, setFormData] = useState({
    cpf: userData.cpf || '',
    phone: userData.phone || '',
    email: userData.email || '',
  });

  const [errors, setErrors] = useState({
    cpf: '',
    phone: '',
    email: '',
  });

  const [isFormValid, setIsFormValid] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [transcriptionError, setTranscriptionError] = useState('');

  // FIX: Replaced 'LiveSession' with 'any' as it is not a valid type.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const apiKey = (import.meta as any)?.env?.VITE_API_KEY || (typeof process !== 'undefined' ? (process as any)?.env?.API_KEY : undefined);
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const validateField = (name: keyof typeof formData, value: string) => {
    let error = '';
    switch (name) {
      case 'cpf':
        error = validateCPF(value) ? '' : 'Por favor, insira um CPF válido.';
        break;
      case 'phone':
        error = validatePhone(value) ? '' : 'Por favor, insira um número de telefone válido (ex: +55 11 99999-9999).';
        break;
      case 'email':
        error = validateEmail(value) ? '' : 'Por favor, insira um endereço de e-mail válido.';
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return !error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as { name: keyof typeof formData, value: string };
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };
  
  useEffect(() => {
    // FIX: Add type check for `field` to ensure it's a string before accessing `length`.
    const allFieldsFilled = Object.values(formData).every(field => typeof field === 'string' && field.length > 0);
    const noErrors = Object.values(errors).every(error => error === '');
    setIsFormValid(allFieldsFilled && noErrors);
  }, [formData, errors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      setUserData(prev => ({ ...prev, ...formData }));
      onNext();
    }
  };

  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startTranscription = async () => {
    setIsRecording(true);
    setTranscribedText('');
    setTranscriptionError('');
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      if (!ai) throw new Error('AI desabilitado (sem API key).');
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
            scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                if (sessionPromiseRef.current) {
                    sessionPromiseRef.current.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    }).catch(console.error);
                }
            };
            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current!.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if(message.serverContent?.inputTranscription) {
                setTranscribedText(prev => prev + message.serverContent!.inputTranscription!.text);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e);
            setTranscriptionError('Ocorreu um erro durante a transcrição.');
            stopTranscription();
          },
          onclose: () => {
            console.log('Live session closed.');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO], // Required but we only use transcription
          inputAudioTranscription: {},
        }
      });
    } catch (err) {
      console.error('Failed to get user media', err);
      setTranscriptionError('Não foi possível acessar o microfone. Por favor, conceda a permissão.');
      setIsRecording(false);
    }
  };

  const stopTranscription = () => {
    setIsRecording(false);
    
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if(scriptProcessorRef.current){
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Informações Pessoais</h2>
      <p className="text-gray-600 mb-6">Por favor, forneça seus dados de contato. Esta informação será mantida confidencial.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField id="cpf" label="CPF" value={formData.cpf} onChange={handleChange} error={errors.cpf} placeholder="000.000.000-00" />
        <InputField id="phone" label="Telefone Celular" value={formData.phone} onChange={handleChange} error={errors.phone} placeholder="+55 11 99999-9999" />
        <InputField id="email" label="Email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="voce@exemplo.com" type="email" />
        
        <div className="pt-4 space-y-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-md font-medium text-gray-800">Ou, preencha por voz:</h3>
            <button
                type="button"
                onClick={isRecording ? stopTranscription : startTranscription}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-full transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-700 hover:bg-purple-800'}`}
            >
                {isRecording ? 'Parar Gravação' : 'Iniciar Gravação'}
            </button>
          </div>
          {isRecording && <div className="text-sm text-gray-600 animate-pulse">Ouvindo... por favor, dite seus dados claramente.</div>}
          {transcribedText && (
            <div className="p-3 bg-gray-100 rounded-md">
                <p className="text-sm text-gray-800 font-medium">Transcrição:</p>
                <p className="text-sm text-gray-700">{transcribedText}</p>
            </div>
          )}
          {transcriptionError && <p className="text-sm text-red-600">{transcriptionError}</p>}
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300"
          >
            Próximo
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalInfoScreen;

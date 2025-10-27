
import React, { useState, useEffect } from 'react';
import { Camera, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

interface WelcomeScreenProps {
  onNext: () => void;
}

const PermissionItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  isGranted: boolean | null;
  onRequest: () => void;
}> = ({ icon, title, description, isGranted, onRequest }) => (
  <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
    <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">{icon}</div>
    <div className="flex-grow">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
    <div className="flex-shrink-0">
      {isGranted === true && <CheckCircle className="w-6 h-6 text-green-500" />}
      {isGranted === false && <AlertCircle className="w-6 h-6 text-red-500" />}
      {isGranted === null && (
        <button
          onClick={onRequest}
          className="px-3 py-1 text-sm font-semibold text-white bg-purple-700 rounded-md hover:bg-purple-800 transition-colors"
        >
          Permitir
        </button>
      )}
    </div>
  </div>
);

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPermissions = async () => {
    try {
      const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraGranted(cameraStatus.state === 'granted');
      cameraStatus.onchange = () => setCameraGranted(cameraStatus.state === 'granted');

      const locationStatus = await navigator.permissions.query({ name: 'geolocation' });
      setLocationGranted(locationStatus.state === 'granted');
      locationStatus.onchange = () => setLocationGranted(locationStatus.state === 'granted');
    } catch (err) {
      console.error("Permission query failed:", err);
      // Fallback for browsers that don't support query
      setCameraGranted(null);
      setLocationGranted(null);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const requestCamera = async () => {
    try {
      setError(null);
      await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraGranted(true);
    } catch (err) {
      console.error("Camera permission denied:", err);
      setCameraGranted(false);
      setError("O acesso à câmera foi negado. Por favor, habilite-o nas configurações do seu navegador.");
    }
  };

  const requestLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("A geolocalização não é suportada pelo seu navegador.");
      setLocationGranted(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationGranted(true);
      },
      (err) => {
        console.error("Location permission denied:", err);
        setLocationGranted(false);
        setError("O acesso à localização foi negado. Por favor, habilite-o nas configurações do seu navegador para um serviço preciso.");
      }
    );
  };

  const isNextDisabled = !cameraGranted || !locationGranted || !termsAccepted;

  return (
    <div className="flex flex-col animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo ao Assistente de Vistos FedEx</h1>
      <p className="text-gray-600 mb-6">Vamos começar com sua solicitação de visto. Primeiro, precisamos de algumas permissões para garantir um processo tranquilo.</p>
      
      <div className="space-y-4 mb-6">
        <PermissionItem
          icon={<Camera className="w-6 h-6" />}
          title="Acesso à Câmera"
          description="Necessário para digitalizar documentos e verificação de identidade."
          isGranted={cameraGranted}
          onRequest={requestCamera}
        />
        <PermissionItem
          icon={<MapPin className="w-6 h-6" />}
          title="Localização Precisa"
          description="Usado para encontrar locais da FedEx e consulados próximos."
          isGranted={locationGranted}
          onRequest={requestLocation}
        />
      </div>

      {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

      <div className="flex items-start space-x-3 mb-8">
        <input
          id="terms"
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="h-5 w-5 mt-1 text-purple-700 border-gray-300 rounded focus:ring-purple-600"
        />
        <label htmlFor="terms" className="text-gray-700">
          Eu li e concordo com os <a href="#" className="font-semibold text-purple-700 hover:underline">Termos de Uso</a> e a <a href="#" className="font-semibold text-purple-700 hover:underline">Política de Privacidade</a>.
        </label>
      </div>

      <button
        onClick={onNext}
        disabled={isNextDisabled}
        className="w-full py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300"
      >
        Próximo
      </button>
    </div>
  );
};

export default WelcomeScreen;
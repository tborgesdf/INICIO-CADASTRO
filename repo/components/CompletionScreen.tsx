
import React, { useState, useEffect } from 'react';
import type { UserData, GroundingSource } from '../types';
import { geminiService } from '../services/geminiService';
import { PartyPopper, Map, Link, AlertTriangle, Loader2 } from 'lucide-react';

interface CompletionScreenProps {
  userData: Partial<UserData>;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({ userData }) => {
    const [centers, setCenters] = useState<GroundingSource[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<GeolocationCoordinates | null>(null);

    useEffect(() => {
        if(userData.location) {
            setLocation(userData.location);
        } else {
            // As a fallback, try to get location again
            navigator.geolocation.getCurrentPosition(
                (position) => setLocation(position.coords),
                () => setError("Não foi possível obter sua localização para encontrar centros próximos.")
            );
        }
    }, [userData.location]);


    const findCenters = async () => {
        if (!location) {
            setError("Localização não está disponível. Por favor, certifique-se de que concedeu as permissões de localização.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setCenters([]);

        try {
            const results = await geminiService.findNearbyVisaCenters(location);
            setCenters(results);
        } catch (err) {
            console.error("Error finding visa centers:", err);
            setError("Desculpe, não conseguimos encontrar centros de visto no momento. Por favor, tente novamente mais tarde.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="text-center animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <PartyPopper className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Obrigado!</h2>
            <p className="mt-2 text-gray-600">
                Suas informações iniciais foram enviadas com sucesso.
            </p>
            <p className="mt-1 text-gray-600">
                As próximas etapas do seu processo de solicitação de visto estarão disponíveis em breve.
            </p>

            <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Qual o próximo passo?</h3>
                <p className="mt-2 text-sm text-gray-600">
                    Você pode encontrar centros de solicitação de visto para o Canadá, EUA e México perto de você.
                </p>
                <button
                    onClick={findCenters}
                    disabled={isLoading || !location}
                    className="mt-4 inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                            Buscando...
                        </>
                    ) : (
                        <>
                            <Map className="-ml-1 mr-2 h-5 w-5" />
                            Encontrar Centros Próximos
                        </>
                    )}
                </button>

                {error && (
                    <div className="mt-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}
                
                {centers.length > 0 && (
                    <div className="mt-6 text-left">
                        <h4 className="font-semibold text-gray-800 mb-3">Centros de Visto Próximos:</h4>
                        <ul className="space-y-3">
                            {centers.map((center, index) => (
                                <li key={index} className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                                    <a href={center.uri} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 text-purple-700 hover:underline">
                                        <Link className="w-4 h-4 flex-shrink-0" />
                                        <span className="font-medium">{center.title || 'Centro de Visto'}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompletionScreen;
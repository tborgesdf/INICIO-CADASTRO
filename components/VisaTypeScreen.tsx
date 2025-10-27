
import React, { useState } from 'react';
import type { UserData } from '../types';
import { databaseService } from '../services/databaseService';
import { Send } from 'lucide-react';

interface VisaTypeScreenProps {
  onNext: () => void;
  userData: Partial<UserData>;
  setUserData: React.Dispatch<React.SetStateAction<Partial<UserData>>>;
}

const VisaTypeScreen: React.FC<VisaTypeScreenProps> = ({ onNext, userData, setUserData }) => {
  const [visaType, setVisaType] = useState<'renewal' | 'first_visa' | null>(userData.visaType || null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(userData.countries || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const countries = [
    { name: 'Canadá', flag: '🇨🇦' },
    { name: 'Estados Unidos', flag: '🇺🇸' },
    { name: 'México', flag: '🇲🇽' },
  ];

  const handleCountryChange = (countryName: string) => {
    setSelectedCountries(prev =>
      prev.includes(countryName)
        ? prev.filter(c => c !== countryName)
        : [...prev, countryName]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const finalUserData = {
      ...userData,
      visaType: visaType,
      countries: selectedCountries,
    } as UserData;

    setUserData(finalUserData);

    try {
      await databaseService.saveUserData(finalUserData);
      console.log('User data saved successfully:', finalUserData);
      onNext();
    } catch (error) {
      console.error('Failed to save user data:', error);
      // You could show an error message to the user here
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = visaType !== null && selectedCountries.length > 0;

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Tipo de Solicitação</h2>
      <p className="text-gray-600 mb-6">Selecione o tipo de visto e o(s) país(es) para o(s) qual(is) está aplicando.</p>

      <fieldset className="mb-6">
        <legend className="text-lg font-semibold text-gray-800 mb-3">Qual o tipo da sua solicitação?</legend>
        <div className="space-y-3">
          <div
            onClick={() => setVisaType('renewal')}
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${visaType === 'renewal' ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              id="renewal"
              name="visaType"
              value="renewal"
              checked={visaType === 'renewal'}
              onChange={() => setVisaType('renewal')}
              className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
            />
            <label htmlFor="renewal" className="ml-3 block text-sm font-medium text-gray-700">Renovação de Visto</label>
          </div>
          <div
            onClick={() => setVisaType('first_visa')}
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${visaType === 'first_visa' ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              id="first_visa"
              name="visaType"
              value="first_visa"
              checked={visaType === 'first_visa'}
              onChange={() => setVisaType('first_visa')}
              className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
            />
            <label htmlFor="first_visa" className="ml-3 block text-sm font-medium text-gray-700">Primeiro Visto</label>
          </div>
        </div>
      </fieldset>

      <fieldset className="mb-8">
        <legend className="text-lg font-semibold text-gray-800 mb-3">Para qual(is) país(es) você está aplicando?</legend>
        <div className="space-y-3">
          {countries.map(country => (
            <div
              key={country.name}
              onClick={() => handleCountryChange(country.name)}
              className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${selectedCountries.includes(country.name) ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                id={country.name}
                name="countries"
                value={country.name}
                checked={selectedCountries.includes(country.name)}
                onChange={() => handleCountryChange(country.name)}
                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor={country.name} className="ml-3 flex items-center text-sm font-medium text-gray-700">
                <span className="mr-3 text-2xl">{country.flag}</span>
                {country.name}
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <button
        onClick={handleSubmit}
        disabled={!isFormValid || isSubmitting}
        className="w-full py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Enviando...
          </>
        ) : (
          <>
            Finalizar
            <Send className="w-5 h-5 ml-2" />
          </>
        )}
      </button>
    </div>
  );
};

export default VisaTypeScreen;
import React, { useState } from 'react';
import type { UserData } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import PersonalInfoScreen from './components/PersonalInfoScreen';
import SocialMediaScreen from './components/SocialMediaScreen';
import CompletionScreen from './components/CompletionScreen';
import VisaTypeScreen from './components/VisaTypeScreen';
import Chatbot from './components/Chatbot';
import LoginScreen from './components/LoginScreen';

const FedExLogo: React.FC = () => (
    <svg className="h-16 w-auto" viewBox="0 0 380 100" xmlns="http://www.w3.org/2000/svg">
        {/* Symbol group */}
        <g transform="scale(1.1)">
            {/* The blue 'F' shape is a serif-style letter */}
            <path d="M0 0 H5 L10 0 L50 0 L55 0 L55 12 L25 12 L25 30 L48 30 L48 42 L25 42 L25 85 L18 85 L18 12 L5 12 L0 0 Z" fill="#004A99"/>
            {/* The 'E' color bars within the F */}
            <rect x="28" y="3" width="24" height="10" fill="#D92B27"/>
            <rect x="28" y="18" width="24" height="10" fill="#FDB813"/>
            <rect x="28" y="33" width="20" height="10" fill="#009C45"/>
        </g>
        
        {/* Text group */}
        <g transform="translate(75, 0)">
            <text y="35" fontFamily="Georgia, serif" fontSize="28" fill="#606060" fontWeight="600">
                Federal
            </text>
            <text y="65" fontFamily="Georgia, serif" fontSize="28" fill="#606060" fontWeight="600">
                Express
            </text>
            <text y="82" fontFamily="Arial, sans-serif" fontSize="11" fill="#808080" letterSpacing="0.5">
                ASSESSORIA CONSULAR
            </text>
        </g>
    </svg>
);


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState<Partial<UserData>>({});

  const nextStep = () => setStep(prev => prev + 1);
  const handleLoginSuccess = () => setIsAuthenticated(true);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <WelcomeScreen onNext={nextStep} />;
      case 2:
        return <PersonalInfoScreen onNext={nextStep} userData={userData} setUserData={setUserData} />;
      case 3:
        return <SocialMediaScreen onNext={nextStep} userData={userData} setUserData={setUserData} />;
      case 4:
        return <VisaTypeScreen onNext={nextStep} userData={userData} setUserData={setUserData} />;
      case 5:
        return <CompletionScreen userData={userData} />;
      default:
        return <WelcomeScreen onNext={nextStep} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-800 font-sans">
        <div className="w-full max-w-2xl mx-auto">
            <header className="flex justify-center items-center mb-8">
                <FedExLogo />
            </header>
            <main className="bg-white p-6 sm:p-10 rounded-2xl shadow-lg transition-all duration-500">
                {isAuthenticated ? renderStep() : <LoginScreen onLoginSuccess={handleLoginSuccess} />}
            </main>
        </div>
        {isAuthenticated && <Chatbot />}
    </div>
  );
}

export default App;
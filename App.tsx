import React, { useState } from 'react';
import type { UserData } from './types';
// import WelcomeScreen from './components/WelcomeScreen';
import LocationGate from './components/LocationGate';
import PersonalInfoScreen from './components/PersonalInfoScreen';
import SocialMediaScreen from './components/SocialMediaScreen';
import CompletionScreen from './components/CompletionScreen';
import VisaTypeScreen from './components/VisaTypeScreen';
import Chatbot from './components/Chatbot';
import LoginScreen from './components/LoginScreen';
import PostLoginMenu from './components/PostLoginMenu';
import MyProcesses from './components/MyProcesses';
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';

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
  const [postLoginChoice, setPostLoginChoice] = useState<null | 'new' | 'continue' | 'track'>(null);
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState<Partial<UserData>>({});

  const nextStep = () => setStep(prev => prev + 1);
  const handleLoginSuccess = () => { setIsAuthenticated(true); setPostLoginChoice(null); };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <LocationGate onNext={nextStep} />;
      case 2:
        return <PersonalInfoScreen onNext={nextStep} userData={userData} setUserData={setUserData} />;
      case 3:
        return <SocialMediaScreen onNext={nextStep} userData={userData} setUserData={setUserData} />;
      case 4:
        return <VisaTypeScreen onNext={nextStep} userData={userData} setUserData={setUserData} />;
      case 5:
        return <CompletionScreen userData={userData} />;
      default:
        return <LocationGate onNext={nextStep} />;
    }
  };

  const isAdminRoute = typeof window !== 'undefined' && (window.location.hash === '#/admin' || window.location.hash === '#/admin-users');
  const isMyProcesses = typeof window !== 'undefined' && window.location.hash === '#/my-processes';
  const containerMax = isAdminRoute ? 'max-w-6xl' : 'max-w-2xl';
  const isAdminUsers = typeof window !== 'undefined' && window.location.hash === '#/admin-users';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 bg-gray-50 text-gray-800 font-sans">
        <div className={`w-full ${containerMax} mx-auto`}>
            <header className="flex justify-center items-center mb-8">
                <FedExLogo />
            </header>
            <main className="bg-white p-4 sm:p-8 rounded-2xl shadow-lg transition-all duration-500">
                {isAdminRoute ? (
                  isAdminUsers ? <AdminUsers /> : <AdminDashboard />
                ) : (
                  isAuthenticated ? (
                    isMyProcesses ? (
                      <MyProcesses />
                    ) : (
                    postLoginChoice === null ? (
                      <PostLoginMenu
                        onNew={()=>{ setUserData({}); setStep(2); setPostLoginChoice('new'); }}
                        onContinue={()=>{ setPostLoginChoice('continue'); (async()=>{ try{ const r=await fetch('/api/me-latest'); const j=await r.json(); if(r.ok && j.ok && j.latest){ const u=j.latest; const pre:any={}; pre.email=u.email; pre.cpf=u.cpf; pre.phone=u.phone; pre.visa_type=u.visa_type; if(Array.isArray(j.countries)&&j.countries.length){ pre.countries=j.countries.map((c:any)=>c.country); } if(Array.isArray(j.social)){ pre.socialMedia=j.social; } setUserData((prev)=>({ ...prev, ...pre })); } }catch{} setStep(2); })(); }}
                        onTrack={()=>{ window.location.hash = '#/my-processes'; setPostLoginChoice('track'); }}
                      />
                    ) : renderStep())
                  ) : (
                    <LoginScreen onLoginSuccess={handleLoginSuccess} />
                  )
                )}
            </main>
        </div>
        {isAuthenticated && <Chatbot />}
    </div>
  );
}

export default App;

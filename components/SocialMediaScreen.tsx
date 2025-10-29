
import React, { useState, useEffect } from 'react';
import type { UserData, SocialMedia } from '../types';
import { Instagram, Linkedin, Twitter, Facebook, Youtube, Twitch, Pin, Star, MoreHorizontal } from 'lucide-react';

interface SocialMediaScreenProps {
  onNext: () => void;
  userData: Partial<UserData>;
  setUserData: React.Dispatch<React.SetStateAction<Partial<UserData>>>;
}

const socialPlatforms = [
  { name: 'instagram', icon: <Instagram className="w-5 h-5 text-gray-400" />, placeholder: 'usuario_instagram' },
  { name: 'linkedin', icon: <Linkedin className="w-5 h-5 text-gray-400" />, placeholder: 'linkedin.com/in/usuario' },
  { name: 'x', icon: <Twitter className="w-5 h-5 text-gray-400" />, placeholder: '@usuario_x' },
  { name: 'facebook', icon: <Facebook className="w-5 h-5 text-gray-400" />, placeholder: 'facebook.com/perfil' },
  { name: 'tiktok', icon: <Twitch className="w-5 h-5 text-gray-400" />, placeholder: '@usuario_tiktok' },
  { name: 'snapchat', icon: <Star className="w-5 h-5 text-gray-400" />, placeholder: 'usuario_snapchat' },
  { name: 'youtube', icon: <Youtube className="w-5 h-5 text-gray-400" />, placeholder: 'youtube.com/c/nomedocanal' },
  { name: 'pinterest', icon: <Pin className="w-5 h-5 text-gray-400" />, placeholder: 'pinterest.com/usuario' },
  { name: 'other', icon: <MoreHorizontal className="w-5 h-5 text-gray-400" />, placeholder: 'blog, portfólio, etc.' },
];

const SocialMediaScreen: React.FC<SocialMediaScreenProps> = ({ onNext, userData, setUserData }) => {
  const [socials, setSocials] = useState<SocialMedia>(userData.socialMedia || {});
  const [noSocials, setNoSocials] = useState(false);

  useEffect(() => {
    if (noSocials) {
      setSocials({});
    }
  }, [noSocials]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSocials(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const finalUserData = {
      ...userData,
      socialMedia: noSocials ? {} : socials,
    };
    
    try { await fetch('/api/save-draft', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ socialMedia: finalUserData.socialMedia }) }); } catch {}
    setUserData(finalUserData);
    onNext();
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Perfis de Redes Sociais</h2>
      <p className="text-gray-600 mb-6">Forneça links para seus perfis de redes sociais. Esta etapa é opcional.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {socialPlatforms.map(({ name, icon, placeholder }) => (
          <div key={name} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {icon}
            </div>
            <input
              type="text"
              name={name}
              value={socials[name as keyof SocialMedia] || ''}
              onChange={handleChange}
              placeholder={placeholder}
              disabled={noSocials}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        ))}
      </div>

      <div className="flex items-start space-x-3 mt-6 mb-8">
        <input
          id="no-socials"
          type="checkbox"
          checked={noSocials}
          onChange={(e) => setNoSocials(e.target.checked)}
          className="h-5 w-5 mt-1 text-purple-700 border-gray-300 rounded focus:ring-purple-600"
        />
        <label htmlFor="no-socials" className="text-gray-700">
          Não possuo ou não desejo fornecer meus perfis de redes sociais.
        </label>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300"
      >
        Próximo
      </button>
    </div>
  );
};

export default SocialMediaScreen;

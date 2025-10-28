import React, { useState } from 'react';
import { authService } from '../services/authService';
import { validateEmail } from '../services/validationService';
import { Loader2, Mail, Lock, User } from 'lucide-react';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.618-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.902,35.61,44,29.83,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

const AppleIcon = () => (
    <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.39,14.93a5.3,5.3,0,0,1-2.2-3.18,4.81,4.81,0,0,1,1.2-3.69,5.1,5.1,0,0,0-3.2-1.9A5.13,5.13,0,0,0,12.3,9,5,5,0,0,0,8.12,6.17a4.67,4.67,0,0,0-3.33,2,5.2,5.2,0,0,0,1,7.21,5.26,5.26,0,0,0,3.32,1.59,4.64,4.64,0,0,0,3-1.12,1.2,1.2,0,0,1,.84-.45,1.25,1.25,0,0,1,.85.46,4.64,4.64,0,0,0,3,1.12,5.32,5.32,0,0,0,2.6-.66M15,5.1a5.2,5.2,0,0,0-2.4-.64,4.89,4.89,0,0,0-3.5,1.5,4.72,4.72,0,0,0-1.2,3.3,5.38,5.38,0,0,0,2.4.5,4.8,4.8,0,0,0,3.5-1.55A4.63,4.63,0,0,0,15,5.1" />
    </svg>
);


const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [errors, setErrors] = useState({ name: '', email: '', password: '', confirmPassword: '', api: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '', api: '' }));
    };

    const validate = () => {
        const newErrors = { name: '', email: '', password: '', confirmPassword: '', api: '' };
        let isValid = true;
        
        if (!validateEmail(formData.email)) {
            newErrors.email = "Por favor, insira um email válido.";
            isValid = false;
        }
        if (!isLoginView && formData.name.trim() === '') {
            newErrors.name = "O nome é obrigatório.";
            isValid = false;
        }
        if (formData.password.length < 6) {
            newErrors.password = "A senha deve ter pelo menos 6 caracteres.";
            isValid = false;
        }
        if (!isLoginView && formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "As senhas não coincidem.";
            isValid = false;
        }
        
        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        
        setIsLoading(true);
        setErrors(prev => ({ ...prev, api: '' }));

        try {
            if (isLoginView) {
                await authService.loginWithEmail(formData.email, formData.password);
            } else {
                await authService.registerWithEmail(formData.name, formData.email, formData.password);
            }
            onLoginSuccess();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Ocorreu um erro. Tente novamente.";
            setErrors(prev => ({ ...prev, api: message }));
        } finally {
            setIsLoading(false);
        }
    };
    
    // Social logins desativados (Google/Apple/Microsoft removidos)

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{isLoginView ? 'Acesse sua Conta' : 'Crie sua Conta'}</h2>
            <p className="text-gray-600 mb-6">
                {isLoginView ? 'Bem-vindo de volta! Continue sua solicitação de visto.' : 'Vamos começar! Crie uma conta para iniciar o processo.'}
            </p>

            <div className="flex border-b border-gray-200 mb-6">
                <button onClick={() => setIsLoginView(true)} className={`flex-1 py-2 font-semibold transition-colors ${isLoginView ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Entrar</button>
                <button onClick={() => setIsLoginView(false)} className={`flex-1 py-2 font-semibold transition-colors ${!isLoginView ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Cadastrar</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {!isLoginView && <InputField icon={<User />} name="name" type="text" placeholder="Nome Completo" value={formData.name} onChange={handleInputChange} error={errors.name} />}
                <InputField icon={<Mail />} name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} error={errors.email} />
                <InputField icon={<Lock />} name="password" type="password" placeholder="Senha" value={formData.password} onChange={handleInputChange} error={errors.password} />
                {!isLoginView && <InputField icon={<Lock />} name="confirmPassword" type="password" placeholder="Confirmar Senha" value={formData.confirmPassword} onChange={handleInputChange} error={errors.confirmPassword} />}

                {errors.api && <p className="text-sm text-red-600">{errors.api}</p>}
                
                <button type="submit" disabled={isLoading} className="w-full mt-2 py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300">
                    {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : (isLoginView ? 'Entrar' : 'Criar Conta')}
                </button>
                 {isLoginView && <a href="#" className="block text-center text-sm text-purple-700 hover:underline mt-2">Esqueceu sua senha?</a>}
            </form>

            {/* Social logins removidos para simplificar o fluxo. */}
        </div>
    );
};

const InputField: React.FC<{ icon: React.ReactNode; name: string; type: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; error?: string; }> = ({ icon, name, type, placeholder, value, onChange, error }) => (
    <div>
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">{React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}</div>
            <input
                name={name}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className={`w-full pl-10 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-600'}`}
            />
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
);

const SocialButton: React.FC<{ icon: React.ReactNode; text: string; onClick: () => void; disabled: boolean; }> = ({ icon, text, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors">
        {icon}
        <span>{text}</span>
    </button>
);


export default LoginScreen;

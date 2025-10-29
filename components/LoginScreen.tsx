import React, { useState } from 'react';
import { authService } from '../services/authService';
import { validateEmail, validateCPF } from '../services/validationService';
import { Loader2, Mail, Lock, User } from 'lucide-react';

interface LoginScreenProps { onLoginSuccess: () => void; }

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginMode, setLoginMode] = useState<'email'|'cpf'>('email');
  const [formData, setFormData] = useState({ name: '', email: '', cpf: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({ name: '', email: '', cpf: '', password: '', confirmPassword: '', api: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<{ emailAvailable: boolean | null; cpfAvailable: boolean | null; checking: boolean }>({ emailAvailable: null, cpfAvailable: null, checking: false });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '', api: '' }));
  };

  const validate = () => {
    const newErrors = { name: '', email: '', cpf: '', password: '', confirmPassword: '', api: '' } as typeof errors;
    let isValid = true;
    if (isLoginView) {
      if (loginMode === 'email') {
        if (!validateEmail(formData.email)) { newErrors.email = 'Por favor, insira um e-mail válido.'; isValid = false; }
      } else {
        if (!validateCPF(formData.cpf)) { newErrors.cpf = 'CPF inválido.'; isValid = false; }
      }
    } else {
      if (formData.name.trim() === '') { newErrors.name = 'O nome é obrigatório.'; isValid = false; }
      if (!validateEmail(formData.email)) { newErrors.email = 'Por favor, insira um e-mail válido.'; isValid = false; }
      if (!validateCPF(formData.cpf)) { newErrors.cpf = 'CPF inválido.'; isValid = false; }
      // Bloqueia cadastro se já existir
      if (availability.emailAvailable === false) { newErrors.email = 'E-mail já cadastrado.'; isValid = false; }
      if (availability.cpfAvailable === false) { newErrors.cpf = 'CPF já cadastrado.'; isValid = false; }
    }
    if (formData.password.length < 6) { newErrors.password = 'A senha deve ter pelo menos 6 caracteres.'; isValid = false; }
    if (!isLoginView && formData.password !== formData.confirmPassword) { newErrors.confirmPassword = 'As senhas não coincidem.'; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  // Debounce de disponibilidade (apenas no cadastro)
  React.useEffect(() => {
    if (isLoginView) return; // só cadastrar
    let cancel = false;
    const run = async () => {
      const wantsEmail = validateEmail(formData.email);
      const wantsCpf = validateCPF(formData.cpf);
      if (!wantsEmail && !wantsCpf) {
        setAvailability(a => ({ ...a, emailAvailable: wantsEmail ? a.emailAvailable : null, cpfAvailable: wantsCpf ? a.cpfAvailable : null, checking: false }));
        return;
      }
      setAvailability(a => ({ ...a, checking: true }));
      try {
        const params: any = {};
        if (wantsEmail) params.email = formData.email;
        if (wantsCpf) params.cpf = formData.cpf;
        const r = await authService.checkAvailability(params);
        if (!cancel) setAvailability({ emailAvailable: wantsEmail ? r.emailAvailable : null, cpfAvailable: wantsCpf ? r.cpfAvailable : null, checking: false });
      } catch {
        if (!cancel) setAvailability(a => ({ ...a, checking: false }));
      }
    };
    const t = setTimeout(run, 450);
    return () => { cancel = true; clearTimeout(t); };
  }, [isLoginView, formData.email, formData.cpf]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setErrors(prev => ({ ...prev, api: '' }));
    try {
      if (isLoginView) {
        if (loginMode === 'email') {
          await authService.login({ email: formData.email }, formData.password);
        } else {
          await authService.login({ cpf: formData.cpf }, formData.password);
        }
      } else {
        await authService.register(formData.name, formData.email, formData.password, formData.cpf);
      }
      onLoginSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.';
      setErrors(prev => ({ ...prev, api: message }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{isLoginView ? 'Acesse sua Conta' : 'Crie sua Conta'}</h2>
      <p className="text-gray-600 mb-6">{isLoginView ? 'Bem-vindo de volta! Continue sua solicitação de visto.' : 'Vamos começar! Crie uma conta para iniciar o processo.'}</p>

      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setIsLoginView(true)} className={`flex-1 py-2 font-semibold transition-colors ${isLoginView ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Entrar</button>
        <button onClick={() => setIsLoginView(false)} className={`flex-1 py-2 font-semibold transition-colors ${!isLoginView ? 'text-purple-700 border-b-2 border-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Cadastrar</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLoginView && (
          <InputField icon={<User />} name="name" type="text" placeholder="Nome Completo" value={formData.name} onChange={handleInputChange} error={errors.name} />
        )}

        {isLoginView ? (
          <div>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setLoginMode('email')} className={`px-3 py-1 rounded border ${loginMode==='email' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'}`}>E-mail</button>
              <button type="button" onClick={() => setLoginMode('cpf')} className={`px-3 py-1 rounded border ${loginMode==='cpf' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'}`}>CPF</button>
            </div>
            {loginMode === 'email' ? (
              <InputField icon={<Mail />} name="email" type="email" placeholder="E-mail" value={formData.email} onChange={handleInputChange} error={errors.email} />
            ) : (
              <InputField icon={<User />} name="cpf" type="text" placeholder="CPF" value={formData.cpf} onChange={handleInputChange} error={errors.cpf} />
            )}
          </div>
        ) : (
          <>
            <InputField icon={<Mail />} name="email" type="email" placeholder="E-mail" value={formData.email} onChange={handleInputChange} error={errors.email} />
            {/* Indicador de disponibilidade do e-mail */}
            {validateEmail(formData.email) && availability.emailAvailable !== null && (
              <p className={`text-xs ${availability.emailAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {availability.emailAvailable ? 'E-mail disponível' : 'E-mail já cadastrado'}
              </p>
            )}
            <InputField icon={<User />} name="cpf" type="text" placeholder="CPF" value={formData.cpf} onChange={handleInputChange} error={errors.cpf} />
            {/* Indicador de disponibilidade do CPF */}
            {validateCPF(formData.cpf) && availability.cpfAvailable !== null && (
              <p className={`text-xs ${availability.cpfAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {availability.cpfAvailable ? 'CPF disponível' : 'CPF já cadastrado'}
              </p>
            )}
          </>
        )}

        <InputField icon={<Lock />} name="password" type="password" placeholder="Senha" value={formData.password} onChange={handleInputChange} error={errors.password} />
        {!isLoginView && (
          <InputField icon={<Lock />} name="confirmPassword" type="password" placeholder="Confirmar Senha" value={formData.confirmPassword} onChange={handleInputChange} error={errors.confirmPassword} />
        )}

        {errors.api && <p className="text-sm text-red-600">{errors.api}</p>}
        <button type="submit" disabled={isLoading || (!isLoginView && availability.checking)} className="w-full mt-2 py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300">
          {isLoading ? <Loader2 className="animate-spin h-6 w-6" /> : (isLoginView ? 'Entrar' : 'Criar Conta')}
        </button>
        {isLoginView && <a href="#" className="block text-center text-sm text-purple-700 hover:underline mt-2">Esqueceu sua senha?</a>}
      </form>
    </div>
  );
};

const InputField: React.FC<{ icon: React.ReactNode; name: string; type: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; error?: string; }> = ({ icon, name, type, placeholder, value, onChange, error }) => (
  <div>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">{React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}</div>
      <input name={name} type={type} placeholder={placeholder} value={value} onChange={onChange} className={`w-full pl-10 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-600'}`} />
    </div>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

export default LoginScreen;

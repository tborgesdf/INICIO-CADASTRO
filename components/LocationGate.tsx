import React, { useEffect, useState } from 'react';

type Props = { onNext: () => void };

const LocationGate: React.FC<Props> = ({ onNext }) => {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p: any = (navigator as any).permissions;
        if (p && p.query) {
          const st = await p.query({ name: 'geolocation' as PermissionName });
          setGranted(st.state === 'granted');
          st.onchange = () => setGranted(st.state === 'granted');
        }
      } catch {}
    })();
  }, []);

  const request = () => {
    setError(null);
    if (!navigator.geolocation) {
      setGranted(false);
      setError('Seu navegador não suporta geolocalização.');
      return;
    }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGranted(true);
        setAsking(false);
        setShowModal(false);
        // Coletar infos de ambiente e enviar ao backend
        try {
          const ua = navigator.userAgent || '';
          const nav: any = navigator as any;
          const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
          const connType = conn?.effectiveType || conn?.type || '';
          const downlink = conn?.downlink || undefined;
          const rtt = conn?.rtt || undefined;
          const getBrowser = () => {
            if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
            if (/Edg\//.test(ua)) return 'Edge';
            if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
            if (/Firefox\//.test(ua)) return 'Firefox';
            return 'Outro';
          };
          const getOS = () => {
            if (/Windows NT/.test(ua)) return 'Windows';
            if (/Mac OS X/.test(ua)) return 'macOS';
            if (/Android/.test(ua)) return 'Android';
            if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
            return 'Outro';
          };
          const body = {
            browser: getBrowser(), os: getOS(), ua,
            connType, downlink, rtt,
            clientLat: pos.coords.latitude, clientLng: pos.coords.longitude,
          } as any;
          fetch('/api/client-log', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }).catch(()=>{});
          // também salvar rascunho de localização para o processo do usuário
          try { fetch('/api/save-draft', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ location: { latitude: body.clientLat, longitude: body.clientLng } }) }); } catch {}
        } catch {}
        if (!advanced) { setAdvanced(true); onNext(); }
      },
      (err) => {
        setGranted(false);
        setAsking(false);
        setError('Permissão de localização negada. Habilite no navegador para continuar.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  // Se a permissão já estiver concedida (ou assim que for), avançar automaticamente
  React.useEffect(() => {
    if (granted === true && !advanced) {
      setAdvanced(true);
      onNext();
    }
  }, [granted]);

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Modal overlay obrigatório até conceder */}
      {showModal && granted !== true && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
              <h3 className="text-lg font-semibold">Permitir Localização</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Para prosseguir, toque em “Permitir”. O navegador exibirá um pedido de permissão.</p>
            {error && <div className="text-sm text-red-700 bg-red-100 p-2 rounded mb-3">{error}</div>}
            {asking ? (
              <button className="w-full py-2 rounded bg-gray-300 text-gray-700" disabled>Aguardando permissão…</button>
            ) : (
              <button onClick={request} className="w-full py-2 rounded bg-purple-700 text-white hover:bg-purple-800">Permitir agora</button>
            )}
            <div className="mt-3 text-xs text-gray-500">
              Dica: se o pedido não aparecer, verifique as permissões do site no cadeado da barra de endereço.
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo básico quando já concedido */}
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Iniciar</h1>
      <p className="text-gray-600 mb-4">Localização necessária para validar sua área de atendimento.</p>
      {granted === true ? (
        <div className="text-green-700 bg-green-50 border border-green-200 rounded p-3 mb-4">Permissão de localização concedida.</div>
      ) : (
        <div className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">Aguarde conceder a permissão no popup.</div>
      )}
      <button onClick={onNext} disabled={!granted} className="w-full py-3 px-4 text-lg font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed">Próximo</button>
    </div>
  );
};

export default LocationGate;

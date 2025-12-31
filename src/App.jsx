import React, { useState, useRef } from 'react';
import { 
  Clapperboard, 
  RotateCcw, 
  Wand2, 
  Lightbulb, 
  Zap, 
  Copy, 
  Check, 
  Microchip,
  Loader2,
  Image as ImageIcon,
  Upload,
  X,
  Clapperboard as ActionIcon // Usando ícone diferente se disponível ou reutilizando
} from 'lucide-react';

const App = () => {
  // --- State Management ---
  const [userIdea, setUserIdea] = useState('');     // Campo Cena
  const [userAction, setUserAction] = useState(''); // Novo Campo Ação
  const [finalOutput, setFinalOutput] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  
  const [isLoading, setIsLoading] = useState({ 
    enhance: false, 
    brainstorm: false, 
    generate: false,
    analyzeImage: false 
  });
  
  const [copySuccess, setCopySuccess] = useState(false);
  const [inputError, setInputError] = useState(false);
  const fileInputRef = useRef(null);

  // --- Constants & Config ---
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Configure em .env.local
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

  const BASE_PROMPT_TEMPLATE = `CINEMATIC CONTACT SHEET — PROMPT BASE (FINAL)
Analyze the entire scene and identify all main subjects and their spatial interaction.
Generate a 3x3 Cinematic Contact Sheet with 9 distinct shots, all taking place in the same environment, forming a clear visual narrative.
Each image must contain a small, subtle number overlay (1–9) in a corner. No titles, no text labels, no black borders, no dividers. Each frame must be a full cinematic image, edge-to-edge.

SHOT ORDER (MANDATORY SEQUENCE)
1. Extreme Long Shot (ELS) Subject(s) small within a vast environment.
2. Long Shot (LS) Full body of all main subjects visible.
3. Medium Long Shot (MLS / 3-4) Knees up, tension building.
4. Medium Shot (MS) Waist up, active interaction.
5. Medium Close-Up (MCU) Chest up, emotional intensity.
6. Close-Up (CU) Face or main focal point.
7. Extreme Close-Up (ECU) Macro detail (eyes, hands, claws, texture, impact).
8. Low Angle Shot Heroic, powerful perspective.
9. High Angle Shot Scale, aftermath, narrative closure.

CONSISTENCY RULES (VERY IMPORTANT)
• Same characters across all 9 images
• Same faces, bodies, outfits, materials
• Same environment and atmosphere
• Same lighting direction and color grading
• Same cinematic realism and proportions
Once a character is defined, its appearance must never change.

VISUAL STYLE
• Ultra-realistic
• Photorealism
• Cinematic film look
• Realistic depth of field (bokeh in close shots)
• Natural motion blur and textures
• NO cartoon
• NO illustration
• NO stylized or comic look`;

  // --- API Logic (Helper) ---

  const callGeminiAPI = async (userPrompt, isJsonMode = false) => {
    try {
      if (!apiKey) {
        console.error("Gemini API key ausente. Defina VITE_GEMINI_API_KEY no .env.local");
        return null;
      }
      // Configuração para forçar JSON se necessário
      const generationConfig = isJsonMode 
        ? { responseMimeType: "application/json" } 
        : {};

      const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: generationConfig
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      console.error("Gemini AI Error:", error);
      return null;
    }
  };

  const callGeminiVisionAPI = async (base64Data, mimeType) => {
    try {
      if (!apiKey) {
        console.error("Gemini API key ausente. Defina VITE_GEMINI_API_KEY no .env.local");
        return null;
      }
      const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ 
            role: "user",
            parts: [
              { text: "Analise esta imagem e descreva a cena detalhadamente em PORTUGUÊS. Foque na atmosfera, iluminação, estilo visual, personagens e ação. IMPORTANTE: SEJA DIRETO E CRU. NÃO comece com frases como 'A imagem mostra', 'A cena apresenta', 'Vemos aqui'. Comece descrevendo os elementos visuais imediatamente (ex: 'Homem solitário caminhando sob chuva ácida...')." },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ] 
          }] 
        })
      });

      if (!response.ok) throw new Error('Vision API Error');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      console.error("Gemini Vision Error:", error);
      return null;
    }
  };

  // --- Actions ---

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione apenas arquivos de imagem.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setImagePreview(base64String);
      const base64Data = base64String.split(',')[1];
      
      setIsLoading(prev => ({ ...prev, analyzeImage: true }));
      const analysis = await callGeminiVisionAPI(base64Data, file.type);
      
      if (analysis) {
        setUserIdea(analysis.trim());
      }
      setIsLoading(prev => ({ ...prev, analyzeImage: false }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    // Validação básica: Pelo menos a cena deve estar preenchida
    if (!userIdea.trim()) {
      triggerInputError();
      return;
    }

    setIsLoading(prev => ({ ...prev, generate: true }));

    // Combina Cena e Ação para a tradução
    const fullDescription = `SCENE: ${userIdea.trim()}\nACTION: ${userAction.trim()}`;

    // Prompt de tradução ajustado
    const translationPrompt = `Translate the following scene and action description to English strictly. Output ONLY the translation combined in a narrative format, no introductory text. If it is already in English, just return it as is.\n\nDescription:\n${fullDescription}`;
    
    const translatedText = await callGeminiAPI(translationPrompt);

    if (translatedText) {
      const combinedPrompt = `SCENE DESCRIPTION / SUBJECT:\n${translatedText.trim()}\n\n${BASE_PROMPT_TEMPLATE}`;
      setFinalOutput(combinedPrompt);
    } else {
      // Fallback
      const combinedPrompt = `SCENE DESCRIPTION / SUBJECT:\n${fullDescription}\n\n${BASE_PROMPT_TEMPLATE}`;
      setFinalOutput(combinedPrompt);
    }
    
    setIsLoading(prev => ({ ...prev, generate: false }));
  };

  const handleClear = () => {
    setUserIdea('');
    setUserAction('');
    setFinalOutput('');
    setInputError(false);
    removeImage();
  };

  const handleCopy = () => {
    if (!finalOutput) return;
    const textarea = document.createElement('textarea');
    textarea.value = finalOutput;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) { console.error('Failed to copy', err); } 
    finally { document.body.removeChild(textarea); }
  };

  const triggerInputError = () => {
    setInputError(true);
    setTimeout(() => setInputError(false), 500);
  };

  const handleEnhance = async () => {
    if (!userIdea.trim() && !userAction.trim()) {
      triggerInputError();
      return;
    }

    setIsLoading(prev => ({ ...prev, enhance: true }));
    
    // Prompt solicitando JSON para atualizar os dois campos
    const prompt = `Atue como um diretor de fotografia e roteirista. Aprimore os textos abaixo para serem cinematográficos, detalhados e visualmente ricos (estilo Midjourney).
    
    ENTRADA ATUAL:
    Cena: "${userIdea}"
    Ação: "${userAction}"

    INSTRUÇÃO:
    Retorne APENAS um objeto JSON válido com duas chaves: "scene" e "action".
    "scene": A descrição aprimorada do ambiente, iluminação e atmosfera.
    "action": A descrição aprimorada da ação que está ocorrendo.
    O texto deve estar em PORTUGUÊS.`;
    
    const result = await callGeminiAPI(prompt, true); // true ativa modo JSON
    
    if (result) {
      try {
        const json = JSON.parse(result);
        if (json.scene) setUserIdea(json.scene);
        if (json.action) setUserAction(json.action);
      } catch (e) {
        console.error("Erro ao parsear JSON de aprimoramento", e);
        // Fallback simples se falhar o JSON
        setUserIdea(result);
      }
    }
    setIsLoading(prev => ({ ...prev, enhance: false }));
  };

  const handleBrainstorm = async () => {
    setIsLoading(prev => ({ ...prev, brainstorm: true }));
    
    const prompt = `Gere uma ideia cinematográfica aleatória e criativa (Sci-Fi, Cyberpunk, Fantasia ou Thriller).
    Retorne APENAS um objeto JSON válido com duas chaves: "scene" e "action".
    "scene": Descrição visual detalhada do ambiente e personagem.
    "action": O que está acontecendo na cena.
    O texto deve estar em PORTUGUÊS.`;
    
    const result = await callGeminiAPI(prompt, true);
    
    if (result) {
      try {
        const json = JSON.parse(result);
        if (json.scene) setUserIdea(json.scene);
        if (json.action) setUserAction(json.action);
      } catch (e) {
        console.error("Erro ao parsear JSON de brainstorm", e);
      }
    }
    setIsLoading(prev => ({ ...prev, brainstorm: false }));
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 md:p-8 font-mono text-neutral-100 selection:bg-red-600 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'JetBrains Mono', monospace; background-color: #000; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #404040; }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* APP WINDOW */}
      <div className="w-full max-w-[1500px] h-[calc(100vh-4rem)] max-h-[1000px] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative ring-1 ring-white/10 animate-fade-in">

        {/* HEADER */}
        <header className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2.5 rounded-lg shadow-lg shadow-red-900/40 shrink-0">
              <Clapperboard className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-sans font-black italic text-2xl md:text-3xl tracking-tighter uppercase leading-none text-white">
                Cinematic Composer
              </h1>
              <p className="text-xs text-neutral-500 font-bold tracking-widest uppercase mt-1.5 flex items-center gap-2">
                Industrial V2.0 <span className="w-1 h-1 bg-red-600 rounded-full"></span> Live
              </p>
            </div>
          </div>

          <button 
            onClick={handleClear} 
            className="text-neutral-500 hover:text-white transition-colors p-2 hover:bg-neutral-900 rounded-full" 
            title="Resetar Tudo"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </header>

        {/* MAIN LAYOUT */}
        <div className="flex-1 flex overflow-hidden">

          {/* SIDEBAR */}
          <aside className="w-full md:w-[420px] bg-black border-r border-neutral-800 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar shrink-0">
            
            {/* Visual Reference Input (01) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2 tracking-widest">
                <span className="text-red-600 font-mono">01</span> Visual Ref
              </label>

              {!imagePreview ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-neutral-900 border border-dashed border-neutral-800 hover:border-red-600/50 hover:bg-neutral-900/80 rounded-lg p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group min-h-[220px]"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <div className="p-3 bg-neutral-950 rounded-full group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-8 h-8 text-neutral-500 group-hover:text-red-500 transition-colors" />
                  </div>
                  <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider group-hover:text-neutral-300">
                    Carregar Imagem
                  </span>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-neutral-800 group min-h-[220px] bg-neutral-900 flex items-center justify-center">
                   {isLoading.analyzeImage && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10 backdrop-blur-sm">
                      <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                      <span className="text-xs text-white font-bold tracking-widest uppercase">Analisando...</span>
                    </div>
                  )}
                  <img src={imagePreview} alt="Preview" className="w-full h-56 object-cover opacity-80" />
                  <button 
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors backdrop-blur-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Scene Input (02) */}
            <div className="flex flex-col gap-2 flex-1 min-h-[140px]">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2 tracking-widest">
                <span className="text-red-600 font-mono">02</span> Scene Input
              </label>
              <textarea 
                value={userIdea}
                onChange={(e) => setUserIdea(e.target.value)}
                className={`bg-neutral-900 border ${inputError && !userIdea ? 'border-red-600' : 'border-neutral-800'} rounded-lg p-4 text-sm text-neutral-300 focus:border-red-600 outline-none w-full h-full resize-none font-mono leading-relaxed placeholder-neutral-600 transition-colors custom-scrollbar`}
                placeholder={isLoading.analyzeImage ? "Aguardando análise visual..." : `DESCRIÇÃO DO AMBIENTE...\n\n> Rua chuvosa de Neo-Tokyo\n> Névoa densa e luzes de neon`}
                spellCheck="false"
              />
            </div>

             {/* Action Input (03) - NOVO */}
             <div className="flex flex-col gap-2 flex-1 min-h-[140px]">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2 tracking-widest">
                <span className="text-red-600 font-mono">03</span> Action Input
              </label>
              <textarea 
                value={userAction}
                onChange={(e) => setUserAction(e.target.value)}
                className={`bg-neutral-900 border ${inputError && !userAction ? 'border-red-600' : 'border-neutral-800'} rounded-lg p-4 text-sm text-neutral-300 focus:border-red-600 outline-none w-full h-full resize-none font-mono leading-relaxed placeholder-neutral-600 transition-colors custom-scrollbar`}
                placeholder={`DESCRIÇÃO DA AÇÃO...\n\n> Samurai saca a katana lentamente\n> Drone sobrevoa em rasante`}
                spellCheck="false"
              />
            </div>

            {/* AI Tools */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleEnhance} 
                  disabled={isLoading.enhance || isLoading.generate || isLoading.analyzeImage}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg py-4 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:border-neutral-600 hover:text-white transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {isLoading.enhance ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 text-neutral-600 group-hover:text-red-500 transition-colors" />}
                  Aprimorar
                </button>
                <button 
                  onClick={handleBrainstorm}
                  disabled={isLoading.brainstorm || isLoading.generate || isLoading.analyzeImage} 
                  className="bg-neutral-900 border border-neutral-800 rounded-lg py-4 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:border-neutral-600 hover:text-white transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {isLoading.brainstorm ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3 text-neutral-600 group-hover:text-yellow-500 transition-colors" />}
                  Ideia
                </button>
              </div>
            </div>

            {/* Generate Button (Primary) */}
            <button 
              onClick={handleGenerate}
              disabled={isLoading.generate || isLoading.enhance || isLoading.brainstorm || isLoading.analyzeImage}
              className="bg-red-600 text-white font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-red-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all py-4 rounded-lg flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 w-full"
            >
              {isLoading.generate ? (
                <>
                  <span>Traduzindo...</span>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </>
              ) : (
                <>
                  <span>Gerar Prompt</span>
                  <Zap className="w-4 h-4 group-hover:animate-pulse" />
                </>
              )}
            </button>

          </aside>

          {/* PREVIEW PANE */}
          <main className="flex-1 bg-neutral-950 p-8 flex flex-col overflow-hidden relative">
            
            <div className="flex justify-between items-end mb-3 shrink-0">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2 tracking-widest">
                <span className="text-red-600 font-mono">04</span> Prompt Output
              </label>
              
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-neutral-600 tracking-widest font-mono">
                  {finalOutput.length} CHARS
                </span>
                <button 
                  onClick={handleCopy}
                  className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${copySuccess ? 'text-green-500' : 'text-neutral-500 hover:text-white'}`}
                  title="Copiar para a área de transferência"
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative flex-1 rounded-lg overflow-hidden border border-neutral-800 bg-black group shadow-2xl shadow-black">
              <textarea 
                value={finalOutput}
                readOnly
                className="w-full h-full bg-transparent p-6 text-sm text-neutral-400 font-mono leading-relaxed resize-none outline-none custom-scrollbar"
                placeholder="// O OUTPUT TRADUZIDO E FORMATADO APARECERÁ AQUI..."
              />
              
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-600 via-red-900 to-transparent opacity-50"></div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
};

export default App;

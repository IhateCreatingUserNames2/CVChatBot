import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Import Source type.
import { Message, UserInfo, Job, ResumeData, Source } from './types';
import { findJobs, generateResume } from './services/geminiService';
import { createPdf } from './services/pdfService';

const BotTypingIndicator: React.FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
  </div>
);

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isBot = message.sender === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl ${isBot ? 'bg-white text-gray-800 rounded-bl-none' : 'bg-blue-600 text-white rounded-br-none'}`}>
        <div className="text-sm">{message.text}</div>
        {message.options && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.options.map((opt, index) => (
              <button key={index} className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full hover:bg-blue-200 transition-colors">
                {opt.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [userInfo, setUserInfo] = useState<UserInfo>({ name: '', phone: '', email: '', location: '' });
    const [userExperiences, setUserExperiences] = useState('');
    const [foundJobs, setFoundJobs] = useState<Job[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);

    const addMessage = useCallback((text: string | React.ReactNode, sender: 'bot' | 'user', options?: { text: string; value: any }[]) => {
        setMessages(prev => [...prev, { id: Date.now(), text, sender, options }]);
    }, []);

    const handleUserInput = async (value: string) => {
        if (!value.trim()) return;

        addMessage(value, 'user');
        setInput('');
        setIsLoading(true);

        try {
            switch (step) {
                case 1:
                    setUserInfo(prev => ({ ...prev, name: value }));
                    addMessage('Ótimo! Agora, me diga seu telefone com DDD.', 'bot');
                    setStep(2);
                    break;
                case 2:
                    setUserInfo(prev => ({ ...prev, phone: value }));
                    addMessage('Perfeito. E seu melhor e-mail?', 'bot');
                    setStep(3);
                    break;
                case 3:
                    setUserInfo(prev => ({ ...prev, email: value }));
                    addMessage('Para finalizar os contatos, qual sua cidade e estado?', 'bot');
                    setStep(4);
                    break;
                case 4:
                    setUserInfo(prev => ({ ...prev, location: value }));
                    addMessage(`Excelente, ${userInfo.name || 'pessoa'}! Agora, a parte mais importante. Me conte, com suas palavras, o que você sabe fazer? Pense nas suas últimas experiências, mesmo que não tenham sido de carteira assinada.`, 'bot');
                    setStep(5);
                    break;
                case 5:
                    setUserExperiences(prev => prev ? `${prev}\n${value}` : value);
                    addMessage('Entendi. Você tem mais alguma experiência ou habilidade que gostaria de adicionar? Se não, apenas diga "só isso".', 'bot');
                    setStep(6);
                    break;
                case 6:
                    if (value.toLowerCase().includes('só isso')) {
                        addMessage('Perfeito. Agora, vou usar essas informações para encontrar uma vaga para você. Qual o cargo ou área que você está procurando?', 'bot');
                        setStep(7);
                    } else {
                        setUserExperiences(prev => `${prev}\n${value}`);
                        addMessage('Ok, adicionado! Algo mais? Se não, diga "só isso".', 'bot');
                    }
                    break;
                case 7:
                    addMessage(`Ok, buscando vagas de "${value}" em "${userInfo.location}"...`, 'bot');
                    // FIX: Handle new return type from findJobs to get both jobs and sources.
                    const { jobs, sources } = await findJobs(value, userInfo.location);
                    setFoundJobs(jobs);
                    const jobOptions = jobs.map(j => `${j.id}. ${j.title} - ${j.company}`).join('\n');
                    
                    // FIX: Create component to display grounding sources, as per guidelines.
                    const sourcesList = sources.length > 0 ? (
                        <div className="mt-4 border-t border-gray-200 pt-2">
                            <p className="text-xs font-bold text-gray-500">Fontes da pesquisa:</p>
                            <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                                {sources.map((source: Source, index: number) => (
                                    <li key={index}>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null;

                    addMessage(
                        <div>
                            <p>Encontrei estas 3 vagas. Qual delas te interessa mais? (Digite 1, 2 ou 3)</p>
                            <pre className="whitespace-pre-wrap mt-2 text-xs bg-gray-100 p-2 rounded">{jobOptions}</pre>
                            {sourcesList}
                        </div>,
                        'bot'
                    );
                    setStep(8);
                    break;
                case 8:
                    const selectedJobIndex = parseInt(value, 10) - 1;
                    if (foundJobs[selectedJobIndex]) {
                        const selectedJob = foundJobs[selectedJobIndex];
                        addMessage(`Ótima escolha! Agora, a mágica acontece. Vou pegar tudo o que você me disse e criar um currículo focado nessa vaga da ${selectedJob.company}, destacando as palavras-chave importantes. Um momento...`, 'bot');
                        setStep(9);
                        const resumeData = await generateResume(userInfo, userExperiences, selectedJob);
                        addMessage(
                            <span>
                                Pronto! Seu currículo profissional está pronto. Clique no botão para baixar. Lembre-se, para cada vaga nova, você pode voltar aqui e criar um currículo novo e otimizado.
                            </span>,
                            'bot'
                        );
                        const DownloadButton = () => (
                            <button
                                onClick={() => createPdf(resumeData)}
                                className="mt-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Baixar meu Currículo em PDF
                            </button>
                        );
                        addMessage(<DownloadButton />, 'bot');
                        addMessage(`Muito sucesso na sua busca, ${userInfo.name}! Estou aqui sempre que precisar. Boa sorte!`, 'bot');
                        setStep(10);
                    } else {
                        addMessage('Opção inválida. Por favor, digite 1, 2 ou 3.', 'bot');
                    }
                    break;
                default:
                    addMessage('Não entendi. Poderia repetir?', 'bot');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
            addMessage(`Desculpe, algo deu errado. ${errorMessage}`, 'bot');
        } finally {
            setIsLoading(false);
        }
    };
    
    const startChat = () => {
        setMessages([]);
        setStep(0);
        setTimeout(() => {
          addMessage(
            "Olá! Eu sou o Meu Currículo Express, seu assistente de carreira digital. Em poucos minutos, vamos criar um currículo poderoso para você. Vamos começar?",
            'bot'
          );
          setStep(1);
        }, 500);
      };

    useEffect(() => {
        startChat();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInitialChoice = (start: boolean) => {
        if (start) {
            addMessage("Sim, vamos lá!", 'user');
            setIsLoading(true);
            setTimeout(() => {
                addMessage("Primeiro, qual seu nome completo?", 'bot');
                setIsLoading(false);
            }, 1000);
        } else {
            addMessage("Agora não", 'user');
            addMessage("Tudo bem! Estarei aqui quando precisar. Até logo!", 'bot');
            setStep(99); // End conversation state
        }
    }

    return (
        <div className="flex flex-col h-screen font-sans">
            <header className="bg-white shadow-sm p-4 text-center">
                <h1 className="text-xl font-bold text-gray-800">Meu Currículo Express 📄✨</h1>
                <p className="text-sm text-gray-500">Seu assistente de carreira digital</p>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                <div className="max-w-3xl mx-auto">
                    {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                    ))}
                    {isLoading && (
                       <div className="flex justify-start mb-4">
                            <div className="max-w-md px-4 py-3 rounded-2xl bg-white text-gray-800 rounded-bl-none">
                                <BotTypingIndicator />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </main>

            <footer className="bg-white border-t p-4">
                <div className="max-w-3xl mx-auto">
                    {step === 1 && messages.length > 0 && !isLoading ? (
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleInitialChoice(true)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
                                Sim, vamos lá!
                            </button>
                            <button onClick={() => handleInitialChoice(false)} className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors">
                                Agora não
                            </button>
                        </div>
                    ) : (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleUserInput(input);
                            }}
                            className="flex items-center space-x-2"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={isLoading ? "Aguarde..." : "Digite sua resposta..."}
                                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                disabled={isLoading || (step !== 1 && step >= 9)}
                            />
                            <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors" disabled={isLoading || (step !== 1 && step >= 9)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                                </svg>
                            </button>
                        </form>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default App;

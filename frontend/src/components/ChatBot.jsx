import { useState, useRef, useEffect } from "react";
import { ChatTeardropText, PaperPlaneRight, X, Sparkle, Gear, ArrowLeft } from "@phosphor-icons/react";
import api from "../lib/api";

const SUGGESTIONS = [
  "🌿 Recommend Face Care",
  "💆 Suggest Hair Care",
  "🧼 Tell me about your Soaps",
  "📖 What is Ayutree's story?",
];

// Helper to format Markdown inline and blocks
function formatMarkdown(text) {
  if (!text) return "";
  
  const lines = text.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeLang = "";
  let listItems = [];
  let listType = null; // "ul" or "ol"
  
  const flushList = (key) => {
    if (listItems.length > 0) {
      if (listType === "ul") {
        elements.push(
          <ul key={key} className="list-disc pl-5 my-2 space-y-1 text-sm text-[#12221C]/90">
            {listItems.map((item, idx) => (
              <li key={idx}>{parseInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
      } else if (listType === "ol") {
        elements.push(
          <ol key={key} className="list-decimal pl-5 my-2 space-y-1 text-sm text-[#12221C]/90">
            {listItems.map((item, idx) => (
              <li key={idx}>{parseInlineMarkdown(item)}</li>
            ))}
          </ol>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  const parseInlineMarkdown = (inlineText) => {
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    const tokens = inlineText.split(regex);
    
    return tokens.map((token, i) => {
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code key={i} className="bg-black/10 px-1 py-0.5 rounded font-mono text-[11px] text-[#1A3B32]">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={i} className="font-semibold text-[#1A3B32]">{token.slice(2, -2)}</strong>;
      } else if (token.startsWith('*') && token.endsWith('*')) {
        return <em key={i} className="italic text-[#1A3B32]/90">{token.slice(1, -1)}</em>;
      }
      return token;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${i}`} className="bg-neutral-900 text-neutral-100 rounded-lg p-3 my-2.5 font-mono text-xs overflow-x-auto shadow-inner leading-relaxed">
            {codeLang && <div className="text-[10px] text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-1 mb-1.5">{codeLang}</div>}
            <pre className="m-0"><code className="whitespace-pre-wrap">{codeBlockLines.join("\n")}</code></pre>
          </div>
        );
        codeBlockLines = [];
        inCodeBlock = false;
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = line.replace("```", "").trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }
    
    // Unordered list match
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.*)/);
    if (ulMatch) {
      flushList(`list-before-${i}`);
      listType = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }
    
    // Ordered list match
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);
    if (olMatch) {
      flushList(`list-before-${i}`);
      listType = "ol";
      listItems.push(olMatch[1]);
      continue;
    }
    
    if (line.trim() === "") {
      flushList(`list-flush-${i}`);
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      flushList(`list-flush-${i}`);
      elements.push(
        <div key={`p-${i}`} className="my-1.5 text-sm leading-relaxed text-[#12221C]/90">
          {parseInlineMarkdown(line)}
        </div>
      );
    }
  }
  
  flushList("list-final");
  return elements;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Namaste! I am AyuBot, your Ayutree wellness guide. How can I help you discover the perfect Ayurvedic ritual today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // AI settings
  const [provider, setProvider] = useState(() => localStorage.getItem("ayubot_provider") || "gemini");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("ayubot_api_key") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempProvider, setTempProvider] = useState(provider);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isSettingsOpen]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    if (!textToSend) setInput("");
    
    // Add user message
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await api.post("/chat", {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        provider: apiKey ? provider : undefined,
        api_key: apiKey ? apiKey : undefined,
      });
      setMessages(prev => [...prev, { role: "assistant", content: response.data.reply }]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I apologize, I'm having trouble connecting right now. Please check your API key in settings or try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 font-sans">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all text-[#C2A878] hover:bg-[#12221C]"
          style={{ background: "#1A3B32" }}
          title="Chat with AyuBot"
        >
          <ChatTeardropText size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[calc(100vw-32px)] sm:w-[380px] h-[480px] sm:h-[520px] bg-white border border-[#E8E1D5] shadow-2xl flex flex-col overflow-hidden animate-fade-in relative rounded-xl">
          
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between text-white border-b border-[#C2A878]/20" style={{ background: "#1A3B32" }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#C2A878]/10 flex items-center justify-center text-[#C2A878]">
                <Sparkle size={18} weight="fill" className={apiKey ? "animate-pulse text-[#C2A878]" : "text-[#C2A878]"} />
              </div>
              <div>
                <div className="font-serif-display font-medium text-[#C2A878] leading-tight flex items-center gap-1.5">
                  AyuBot
                  {apiKey && (
                    <span className="text-[8px] bg-[#C2A878]/20 text-[#C2A878] px-1.5 py-0.5 rounded-full border border-[#C2A878]/30 font-sans tracking-wide uppercase font-medium">
                      {provider === "gemini" ? "Gemini" : "ChatGPT"}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#E8E1D5]/80 uppercase tracking-widest">
                  {apiKey ? "Advanced Wellness AI" : "Ayutree Guide"}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Settings Toggle */}
              <button
                onClick={() => {
                  setTempProvider(provider);
                  setTempApiKey(apiKey);
                  setIsSettingsOpen(!isSettingsOpen);
                }}
                className="text-[#E8E1D5] hover:text-white transition-colors p-1"
                title="AI Settings"
              >
                {isSettingsOpen ? <ArrowLeft size={18} /> : <Gear size={18} />}
              </button>
              
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsOpen(false);
                }}
                className="text-[#E8E1D5] hover:text-white transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {isSettingsOpen ? (
            <div className="flex-1 overflow-y-auto p-5 bg-[#F9F6F0] space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#1A3B32] font-serif border-b border-[#E8E1D5] pb-2">
                  <Gear size={20} className={apiKey ? "animate-spin" : ""} style={{ animationDuration: "12s" }} />
                  <span className="text-base font-semibold">AyuBot AI Settings</span>
                </div>
                
                <p className="text-xs text-[#5C6B64] leading-relaxed">
                  Power AyuBot with advanced LLM capabilities to ask general-knowledge, lifestyle, or recipes queries (like ChatGPT or Gemini).
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-[#1A3B32]">AI Provider</label>
                  <select
                    value={tempProvider}
                    onChange={(e) => {
                      setTempProvider(e.target.value);
                      if (e.target.value !== provider) {
                        setTempApiKey("");
                      } else {
                        setTempApiKey(apiKey);
                      }
                    }}
                    className="w-full bg-white border border-[#E8E1D5] px-3 py-2 text-sm rounded-md outline-none focus:border-[#1A3B32] text-[#12221C] transition-colors"
                  >
                    <option value="gemini">Google Gemini (Recommended)</option>
                    <option value="openai">OpenAI ChatGPT</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-[#1A3B32]">API Key</label>
                    {tempProvider === "gemini" ? (
                      <a
                        href="https://aistudio.google.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#C2A878] hover:underline"
                      >
                        Get Free Key ↗
                      </a>
                    ) : (
                      <a
                        href="https://platform.openai.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#C2A878] hover:underline"
                      >
                        Get Key ↗
                      </a>
                    )}
                  </div>
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder={tempProvider === "gemini" ? "AIzaSy..." : "sk-proj-..."}
                    className="w-full bg-white border border-[#E8E1D5] px-3 py-2 text-sm rounded-md outline-none focus:border-[#1A3B32] text-[#12221C] font-mono transition-colors"
                  />
                  <p className="text-[10px] text-[#5C6B64] italic leading-tight">
                    Your key is saved locally in your browser and is sent directly to the local server.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-[#E8E1D5]">
                <button
                  onClick={() => {
                    localStorage.setItem("ayubot_provider", tempProvider);
                    localStorage.setItem("ayubot_api_key", tempApiKey);
                    setProvider(tempProvider);
                    setApiKey(tempApiKey);
                    setIsSettingsOpen(false);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-white rounded-md transition-colors bg-[#1A3B32] hover:bg-[#12221C]"
                >
                  Save Settings
                </button>
                {apiKey && (
                  <button
                    onClick={() => {
                      localStorage.removeItem("ayubot_provider");
                      localStorage.removeItem("ayubot_api_key");
                      setProvider("gemini");
                      setApiKey("");
                      setTempProvider("gemini");
                      setTempApiKey("");
                      setIsSettingsOpen(false);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-[#A23B22] border border-[#A23B22]/30 rounded-md hover:bg-[#A23B22]/10 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => {
                    setTempProvider(provider);
                    setTempApiKey(apiKey);
                    setIsSettingsOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-[#5C6B64] border border-[#E8E1D5] rounded-md hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F6F0] no-scrollbar">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2.5 rounded-lg text-sm shadow-sm ${
                        m.role === "user"
                          ? "bg-[#1A3B32] text-white rounded-br-none"
                          : "bg-white text-[#12221C] border border-[#E8E1D5] rounded-bl-none"
                      }`}
                    >
                      {m.role === "user" ? m.content : formatMarkdown(m.content)}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-[#12221C] border border-[#E8E1D5] px-4 py-2.5 rounded-lg rounded-bl-none shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#C2A878] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-[#C2A878] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-[#C2A878] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions List (only shown when not loading and is first message) */}
              {messages.length === 1 && !loading && (
                <div className="px-4 py-2 bg-[#F3EFE6] border-t border-[#E8E1D5] flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-[#5C6B64] font-medium mb-0.5">Quick Questions</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s.replace(/^[^\s]+\s/, ""))}
                        className="text-left text-xs bg-white hover:bg-[#1A3B32] hover:text-white border border-[#E8E1D5] hover:border-[#1A3B32] px-2.5 py-1.5 transition-all truncate"
                        style={{ color: "#1A3B32" }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="p-3 bg-white border-t border-[#E8E1D5] flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask AyuBot about skin care, soaps..."
                  className="flex-1 bg-[#F9F6F0] border border-[#E8E1D5] focus:border-[#1A3B32] px-3.5 py-2 text-sm rounded-md outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 bg-[#1A3B32] hover:bg-[#12221C] disabled:bg-[#E8E1D5] text-white disabled:text-[#9AA6A0] rounded-md flex items-center justify-center transition-colors shadow-md"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </button>
              </form>
            </>
          )}

        </div>
      )}
    </div>
  );
}

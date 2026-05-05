import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2, AlertCircle, Terminal, Copy, Download, Share2, Save, ExternalLink, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import confetti from "canvas-confetti";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || "" });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function Analyze() {
  const { "*": encodedUrl } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!encodedUrl) return;

    const analyze = async () => {
      const url = decodeURIComponent(encodedUrl);
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      
      addLog(`Initializing extraction for ${fullUrl}...`);
      
      try {
        addLog("Routing through Hyperbrowser instance...");
        const captureRes = await axios.post("/api/analyze", { url: fullUrl });
        const { screenshotBase64, mimeType, markdown: pageText, metadata: pageMeta } = captureRes.data;
        
        addLog("Hyperbrowser capture complete. Performing Deep Audit with Gemini...");
        
        const prompt = `
          You are a world-class Lead Product Designer and Design Systems Architect.
          Your task is to analyze the provided screenshot AND the extracted page metadata (for technical clues like font families and CSS classes) to generate an exhaustive, high-fidelity DESIGN.md file.

          WEBSITE URL: ${fullUrl}
          
          ### TECHNICAL CONTEXT (Extracted from DOM):
          ${pageText ? `PAGE TEXT/MARKDOWN:\n${pageText.slice(0, 10000)}` : "No page markdown available."}
          ${pageMeta ? `METADATA:\n${JSON.stringify(pageMeta)}` : ""}

          ### CRITICAL INSTRUCTIONS:
          1. **Typography Source of Truth**: DO NOT GUESS if technical clues are available. Look at the CSS class names or content in the Page Markdown to identify exact font names (e.g., Montserrat vs Inter). If the brand uses a specific font, document it exactly. Specify font-family, weights, and treatments.
          2. **Color Precision**: Identify the exact Brand Colors. Cross-reference the visual with common branding patterns found in the metadata/text. Provide HEX values.
          3. **Component Logic**: Break down the UI into atomic components (Buttons, Inputs, Cards, Navigation).
          4. **Design Tokens**: Output a valid JSON block of design tokens.
          5. **Visual Direction**: Define the "vibe" and how it's achieved visually.

          ### OUTPUT STRUCTURE (DESIGN.md):
          # DESIGN.md for [Site Name]

          ## 1. Foundations
          ### Brand Identity & Mood
          ### Color Palette
          ### Typography (Explicit identification)

          ## 2. Layout & Grid
          ### Spacing System
          ### Grid Logic

          ## 3. UI Components
          ### Navigation
          ### Primary & Secondary Buttons
          ### Input Fields & Controls
          ### Cards & Containers

          ## 4. Interaction Design
          ### Micro-animations
          ### State Transitions
          ### Iconography Style

          ## 5. Development Strategy
          ### Design Tokens (JSON)
          \`\`\`json
          { "colors": {...}, "fonts": {...}, "spacing": {...} }
          \`\`\`
          ### Implementation Guidelines

          ## 6. AI Generation Meta-Prompt

          (Ensure the output is beautifully formatted in Markdown for a Notion-like experience).
        `;

        const result = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { data: screenshotBase64, mimeType: mimeType } }
            ]
          }]
        });

        const designMarkdown = result.text;
        
        if (!designMarkdown) {
          throw new Error("Gemini returned an empty response.");
        }

        setMarkdown(designMarkdown);
        setStatus("success");
        addLog("Design system extraction complete.");
        
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#2dd4bf", "#ffffff", "#134e4a"]
        });
      } catch (err: any) {
        console.error(err);
        const errorMessage = err.response?.data?.error || err.message || "Unknown error";
        setError(errorMessage);
        setStatus("error");
        addLog(`FATAL ERROR: ${errorMessage.slice(0, 50)}...`);
      }
    };

    analyze();
  }, [encodedUrl]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const saveToGallery = async () => {
    if (!markdown || !encodedUrl) return;
    setIsSaving(true);
    
    const url = decodeURIComponent(encodedUrl);
    const designId = btoa(url).replace(/=/g, "").slice(0, 16); // Simple ID from URL
    
    try {
      await setDoc(doc(db, "designs", designId), {
        url,
        markdown,
        userId: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });
      setSavedId(designId);
      addLog("Successfully saved to gallery.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `designs/${designId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(markdown);
  };

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "DESIGN.md";
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-20"
          >
            <div className="relative mb-8">
              <Loader2 className="w-16 h-16 text-teal-500 animate-spin" />
              <div className="absolute inset-0 bg-teal-400 blur-2xl opacity-20 animate-pulse" />
            </div>
            
            <h2 className="text-[40px] md:text-[56px] font-black tracking-tighter leading-none uppercase mb-4">Ingesting Interface</h2>
            <p className="text-zinc-500 mb-12 font-medium tracking-tight">This typically takes 10-20 seconds...</p>

            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden font-mono text-[11px] shadow-2xl relative rotate-1">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <span className="ml-2 text-zinc-500 uppercase tracking-widest text-[9px]">DESIGN_PIPELINE.LOG</span>
                </div>
              </div>
              <div className="p-6 h-56 overflow-y-auto space-y-2 text-white/90">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-zinc-600">[{i.toString().padStart(2, '0')}]</span>
                    {log.split('] ')[1]}
                  </div>
                ))}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1.5 h-3.5 bg-blue-500 inline-block align-middle ml-1"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center -rotate-12 shadow-xl">
                <span className="text-white font-black text-center text-[10px] leading-tight whitespace-pre">GEMINI\nINTEL</span>
              </div>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-20 text-center"
          >
            <div className="w-20 h-20 bg-red-50 border-4 border-red-100 rounded-full flex items-center justify-center mb-8">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Pipeline Error</div>
            <h2 className="text-[40px] md:text-[56px] font-black tracking-tighter leading-none uppercase mb-4">Analysis Failed</h2>
            <p className="text-zinc-500 max-w-md mx-auto mb-10 font-medium text-lg">
              {error || "An unexpected error occurred during the design processing sequence."}
            </p>
            <button 
              onClick={() => {
                setStatus("loading");
                setError(null);
                setLogs([]);
                window.location.reload();
              }}
              className="bg-black text-white px-10 py-5 rounded-full font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Retry Pipeline
            </button>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-100 pb-10">
              <div>
                <div className="flex items-center gap-3 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  ANALYSIS_COMPLETE / {decodeURIComponent(encodedUrl || "")}
                </div>
                <h1 className="text-[56px] md:text-[80px] font-black tracking-tighter leading-none uppercase">DESIGN.md</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors shadow-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button 
                  onClick={downloadMd}
                  className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button 
                  onClick={saveToGallery}
                  disabled={isSaving || !!savedId}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savedId ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            <div className="max-w-4xl mx-auto bg-white border border-zinc-100 rounded-[40px] shadow-2xl shadow-zinc-200/50 overflow-hidden">
              {/* Document Header Decor */}
              <div className="h-48 bg-zinc-50 relative overflow-hidden border-b border-zinc-100">
                <div className="absolute inset-0 pattern-dots opacity-20" />
                <div className="absolute bottom-10 left-12 flex items-center gap-4">
                   <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-zinc-100">
                     <FileText className="w-8 h-8 text-blue-600" />
                   </div>
                   <div>
                     <h2 className="text-2xl font-black tracking-tight text-zinc-900 leading-none">Extraction result</h2>
                     <p className="text-zinc-500 font-medium text-sm mt-1">Generated Design System & Metadata</p>
                   </div>
                </div>
              </div>

              <div className="px-12 py-20 prose prose-zinc prose-headings:font-black prose-headings:tracking-tight prose-headings:text-zinc-900 prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-16 prose-h3:text-xl prose-p:text-zinc-600 prose-p:leading-relaxed prose-li:text-zinc-600 prose-strong:text-zinc-900 prose-code:text-blue-600 prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-bold prose-code:before:content-none prose-code:after:content-none max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline && match ? (
                        <div className="my-10 rounded-2xl overflow-hidden border border-zinc-100 shadow-sm">
                          <SyntaxHighlighter
                            style={oneLight}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                            customStyle={{
                              margin: 0,
                              padding: "32px",
                              fontSize: "0.9rem",
                              lineHeight: "1.7",
                              backgroundColor: "#fafafa",
                            }}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="my-10 overflow-x-auto border border-zinc-100 rounded-2xl shadow-sm">
                          <table className="w-full text-left border-collapse table-auto">{children}</table>
                        </div>
                      );
                    },
                    thead({ children }) {
                      return <thead className="bg-zinc-50/80 border-b border-zinc-100">{children}</thead>;
                    },
                    th({ children }) {
                      return <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-zinc-400">{children}</th>;
                    },
                    td({ children }) {
                      return <td className="px-5 py-4 text-sm text-zinc-600 border-t border-zinc-50">{children}</td>;
                    },
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


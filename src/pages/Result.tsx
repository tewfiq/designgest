import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Globe, Calendar, Copy, Download, CheckCircle2, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export function Result() {
  const { id } = useParams();
  const [design, setDesign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDesign = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "designs", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDesign(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching design:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDesign();
  }, [id]);

  const copyToClipboard = () => {
    if (design?.markdown) {
      navigator.clipboard.writeText(design.markdown);
    }
  };

  const downloadMd = () => {
    if (design?.markdown) {
      const blob = new Blob([design.markdown], { type: "text/markdown" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DESIGN-${design.url.replace(/\W/g, '-')}.md`;
      a.click();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
        <p className="mt-4 text-[#A1A1AA] font-mono animate-pulse">Retrieving archived design...</p>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="text-center py-40">
        <h2 className="text-2xl font-bold mb-4">Design Not Found</h2>
        <p className="text-[#A1A1AA] mb-8">The design you are looking for doesn't exist or has been removed.</p>
        <Link to="/gallery" className="text-teal-500 hover:underline">Back to Gallery</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <Link to="/gallery" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Gallery
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-100 pb-12">
        <div>
          <div className="flex items-center gap-4 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {design.url}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 
              {design.createdAt?.toDate ? design.createdAt.toDate().toLocaleDateString() : 'Recent'}
            </span>
          </div>
          <h1 className="text-[56px] md:text-[80px] font-black tracking-tighter leading-none uppercase">
            {design.url.split('.')[0]}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors"
          >
            <Copy className="w-4 h-4 text-blue-600" />
            Copy
          </button>
          <button 
            onClick={downloadMd}
            className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download MD
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="prose prose-zinc prose-lg max-w-none bg-zinc-50 border border-zinc-100 rounded-[32px] p-8 md:p-12 shadow-sm"
      >
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              return !inline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-2xl !bg-zinc-900 !p-6 !my-8 shadow-xl"
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              ) : (
                <code className="bg-zinc-200 px-1.5 py-0.5 rounded text-blue-600 font-bold" {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {design.markdown}
        </ReactMarkdown>
      </motion.div>
    </div>
  );
}


import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Globe, Zap, Shield, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function Home() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    let cleanUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    navigate(`/u/${encodeURIComponent(cleanUrl)}`);
  };

  return (
    <div className="flex flex-col min-h-[70vh] justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-blue-600">
          Intelligence Layer for AI Builders
        </div>
        
        <h1 className="text-[64px] md:text-[112px] leading-[0.88] font-black tracking-tighter mb-12 uppercase">
          Turn any URL<br/>into a <span className="text-zinc-400 font-black">Design.md</span>
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-3xl relative group mb-12">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="https://stripe.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-zinc-100 border-2 border-transparent focus:border-black rounded-full py-8 px-10 pr-40 text-xl lg:text-2xl font-medium outline-none transition-all placeholder:text-zinc-300 shadow-sm"
            />
            <button
              type="submit"
              className="absolute right-3 bg-black text-white px-8 lg:px-12 py-5 rounded-full font-bold uppercase text-[10px] lg:text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Analyze
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-4 mb-20">
          <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Recent Ingests</span>
          <div className="flex flex-wrap gap-2">
            {["anthropic.com", "linear.app", "apple.com", "stripe.com"].map(site => (
              <Link 
                key={site}
                to={`/u/${site}`}
                className="text-xs font-medium px-4 py-1.5 bg-zinc-100 rounded-full border border-zinc-200 hover:border-black hover:bg-white transition-all"
              >
                {site}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-zinc-100 pt-16">
          <FeatureCard 
            title="SYSTEM AUDIT"
            description="Gemini 2.0 analyzes layout logic, typography scales, and interaction patterns with senior-level precision."
          />
          <FeatureCard 
            title="AI READABLE"
            description="Optimized markdown files ready to be dropped into Claude, ChatGPT, or Gemini for instant context."
          />
          <FeatureCard 
            title="TOKEN EXTRACTION"
            description="Extract functional color tokens and spacing systems directly into JSON or Tailwind configurations."
          />
        </div>
      </motion.div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-black">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

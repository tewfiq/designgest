import { Outlet, Link } from "react-router-dom";
import { Search, Github, Library, Zap } from "lucide-react";
import { motion } from "motion/react";

export function Layout() {
  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-blue-600/30">
      <header className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tighter uppercase">
            DesignIngest
          </Link>

          <nav className="flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            <Link to="/" className="hover:text-black transition-colors">
              Analyze
            </Link>
            <Link to="/gallery" className="hover:text-black transition-colors">
              Gallery
            </Link>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="text-black"
            >
              Star on GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-12">
        <Outlet />
      </main>

      <footer className="relative z-10 border-t border-zinc-100 p-8 flex flex-col md:flex-row justify-between items-end gap-8 mt-20">
        <div className="max-w-xs w-full">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Viral Integration</div>
          <div className="text-xs font-mono text-zinc-600">designingest.app/stripe.com</div>
        </div>
        <div className="text-right">
          <div className="text-[32px] md:text-[40px] font-black leading-none tracking-tighter uppercase">Design System as Code</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Powered by Gemini 2.0 Flash & Hyperbrowser</div>
        </div>
      </footer>
    </div>
  );
}

import { Sparkles, X } from "lucide-react";

export function AISetupNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside aria-label="AI setup guidance" className="relative rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-3.5">
      <button type="button" onClick={onDismiss} aria-label="Dismiss recommendation" className="absolute right-2.5 top-2.5 w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-2.5 pr-7">
        <Sparkles className="w-4 h-4 text-[#0071E3] shrink-0 mt-0.5" />
        <div className="space-y-2 text-xs leading-relaxed text-[#6E6E73]">
          <p className="font-semibold text-[#1D1D1F]">Set up your AI assistant</p>
          <p>Choose a provider, add its API key, then select a model. Start with a recommended model in the list, or discover the models available to your key.</p>
          <p>For a local model, choose Custom / Local and enter your server address. Built-in analysis works without an API key.</p>
        </div>
      </div>
    </aside>
  );
}

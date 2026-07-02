import { Heart } from "lucide-react";

// Single-line footer credit, reused at the bottom of every page.
export default function AppFooter() {
  return (
    <p className="text-center text-sm font-bold text-emerald-800/70 py-5">
      Made with <Heart size={14} className="inline -mt-0.5 text-emerald-500 fill-emerald-500" /> by{" "}
      <span className="font-black text-emerald-950">Team Synapse</span> · IIM Lucknow
    </p>
  );
}

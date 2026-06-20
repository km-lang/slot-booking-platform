import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAF7] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mx-auto mb-6">
          <ShieldX size={32} />
        </div>
        <h1 className="text-2xl font-black text-emerald-950 mb-2">
          Access Restricted
        </h1>
        <p className="text-sm font-semibold text-emerald-700/60 mb-8 max-w-xs mx-auto">
          You don't have permission to view this page. Contact Team Disha if
          you believe this is an error.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-3 px-8 rounded-xl text-sm transition-colors shadow-md"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

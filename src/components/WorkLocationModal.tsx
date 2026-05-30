import React, { useState } from 'react';
import { MapPin, Search, Check, AlertCircle, Building, CheckCircle2 } from 'lucide-react';

interface WorkLocationModalProps {
  employeeName: string;
  onConfirm: (locationName: string) => void;
  onCancel?: () => void; // Optional cancel/dismiss if applicable, but we will block it by default
}

const PREDEFINED_LOCATIONS = [
  "Ajanta Pharma",
  "Hetero Palashbari",
  "Natco Pharma",
  "Hetero Changsari",
  "Caltech Office"
];

export default function WorkLocationModal({
  employeeName,
  onConfirm,
  onCancel
}: WorkLocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [customLocation, setCustomLocation] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredLocations = PREDEFINED_LOCATIONS.filter(loc =>
    loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPredefined = (loc: string) => {
    setSelectedLocation(loc);
    setIsOtherSelected(false);
    setErrorMsg("");
  };

  const handleSelectOther = () => {
    setSelectedLocation(null);
    setIsOtherSelected(true);
    setErrorMsg("");
  };

  const handleNextStep = () => {
    if (isOtherSelected) {
      if (!customLocation.trim()) {
        setErrorMsg("Please enter the name of the company/site.");
        return;
      }
    } else if (!selectedLocation) {
      setErrorMsg("Please select a location to proceed.");
      return;
    }
    setErrorMsg("");
    setIsConfirming(true);
  };

  const handleConfirmed = () => {
    const finalLocation = isOtherSelected ? customLocation.trim() : selectedLocation;
    if (finalLocation) {
      onConfirm(finalLocation);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn"
      id="work-location-selection-overlay"
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh] animate-scaleIn"
        id="work-location-card"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-850 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-100">
              <MapPin className="w-5 h-5 animate-pulse text-indigo-100" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight" id="location-modal-title">
                {isConfirming ? "Confirm Work Location" : "Select Work Location"}
              </h2>
              <p className="text-[10px] text-indigo-200/90 font-medium tracking-wide uppercase mt-0.5">
                Mandatory Step • {employeeName}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Core Stage */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!isConfirming ? (
            <>
              {/* Introduction Banner */}
              <div className="bg-indigo-50/70 border border-indigo-100/50 p-3.5 rounded-2xl text-[11.5px] text-indigo-900 leading-relaxed font-semibold">
                You checked in successfully! Please confirm where you are working today to finalise and activate your shift logs.
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search site company / pharma hub..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold text-slate-800"
                />
              </div>

              {/* Location Cards Scroll List */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {filteredLocations.map((loc) => {
                  const isSelected = selectedLocation === loc && !isOtherSelected;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleSelectPredefined(loc)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group active:scale-[0.98] ${
                        isSelected
                          ? "bg-indigo-50/80 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/20"
                          : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-350"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl transition-colors ${
                          isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}>
                          <Building className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold">{loc}</span>
                      </div>
                      {isSelected ? (
                        <div className="bg-indigo-600 text-white rounded-full p-1 border-2 border-white shadow-sm">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-slate-200 rounded-full group-hover:border-slate-300"></div>
                      )}
                    </button>
                  );
                })}

                {/* Show other location if search query doesn't mismatch it completely */}
                {("other location").includes(searchQuery.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleSelectOther}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group active:scale-[0.98] ${
                      isOtherSelected
                        ? "bg-indigo-50/80 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/20"
                        : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl transition-colors ${
                        isOtherSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">Other Location</span>
                        <span className="text-[10px] text-slate-400">Enter custom company / pharma unit</span>
                      </div>
                    </div>
                    {isOtherSelected ? (
                      <div className="bg-indigo-600 text-white rounded-full p-1 border-2 border-white shadow-sm">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-slate-200 rounded-full group-hover:border-slate-300"></div>
                    )}
                  </button>
                )}

                {filteredLocations.length === 0 && !("other location").includes(searchQuery.toLowerCase()) && (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-4">
                    <AlertCircle className="w-6 h-6 text-slate-350 stroke-1 mb-1.5" />
                    <p className="text-2xs text-slate-450 font-bold">No results match your search query</p>
                    <button 
                      type="button"
                      onClick={handleSelectOther}
                      className="text-xs text-indigo-600 font-extrabold underline mt-1.5 tracking-wide uppercase"
                    >
                      Use Other Location Instead
                    </button>
                  </div>
                )}
              </div>

              {/* Conditionally reveal input text field for Custom Location */}
              {isOtherSelected && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100/80 animate-slideDown">
                  <label htmlFor="custom-loc-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                    Company / Site Name (कंपनी/साइट का नाम)
                  </label>
                  <input
                    type="text"
                    id="custom-loc-input"
                    placeholder="Enter pharma/office name manually"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-250 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 transition-all shadow-xs"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 animate-bounce" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          ) : (
            /* Next Step: Confirmation Screen */
            <div className="space-y-5 py-4 text-center">
              <div className="flex justify-center">
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-3xl animate-bounce">
                  <CheckCircle2 className="w-12 h-12 stroke-2" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest font-mono">
                  Location Registration Ready
                </span>
                <p className="text-sm font-bold text-slate-600 max-w-xs mx-auto leading-relaxed">
                  You have selected:
                </p>
                <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl max-w-sm mx-auto">
                  <span className="text-lg font-black text-indigo-950 block">
                    {isOtherSelected ? customLocation.toUpperCase() : selectedLocation}
                  </span>
                  <span className="text-[10.5px] text-slate-450 font-mono flex items-center justify-center space-x-1 mt-1 font-bold">
                    <MapPin className="w-3 h-3 text-indigo-550 shrink-0" />
                    <span>Registered Site Office</span>
                  </span>
                </div>
              </div>

              <p className="text-2xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Confirming will activate tracking and record this work location onto your shifts logs immediately.
              </p>
            </div>
          )}
        </div>

        {/* Modal Buttons Action bar */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-2 shrink-0">
          {!isConfirming ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] text-center"
            >
              Select & Proceed
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleConfirmed}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="w-full py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Change Selection
              </button>
            </>
          )}

          {/* Fallback cancel only if explicitly rendered via callback (typically not allowed during mandatory flow) */}
          {onCancel && !isConfirming && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full mt-1.5 text-center text-3xs text-slate-400 hover:text-slate-500 font-semibold uppercase tracking-wider"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

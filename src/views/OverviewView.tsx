import React, { useMemo } from 'react';
import { Activity, Settings, Info } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { formatDate, formatTime } from '../utils/helpers';
import ResultChart from '../components/ResultChart';
import { DoseEvent, SimulationResult, LabResult, interpolateConcentration_E2, interpolateConcentration_CPA } from '../../logic';

interface OverviewViewProps {
  events: DoseEvent[];
  weight: number;
  labResults: LabResult[];
  simulation: SimulationResult | null;
  currentTime: Date;
  calibrationFn: (h: number) => number;
  onEditEvent: (event: DoseEvent) => void;
  onOpenWeightModal: () => void;
}

const OverviewView: React.FC<OverviewViewProps> = ({
  events,
  weight,
  labResults,
  simulation,
  currentTime,
  calibrationFn,
  onEditEvent,
  onOpenWeightModal,
}) => {
  const { t, lang } = useTranslation();

  const currentLevel = useMemo(() => {
    if (!simulation) return 0;
    const h = currentTime.getTime() / 3600000;
    const baseE2 = interpolateConcentration_E2(simulation, h) || 0;
    return baseE2 * calibrationFn(h);
  }, [simulation, currentTime, calibrationFn]);

  const currentCPA = useMemo(() => {
    if (!simulation) return 0;
    const h = currentTime.getTime() / 3600000;
    const concCPA = interpolateConcentration_CPA(simulation, h) || 0;
    return concCPA;
  }, [simulation, currentTime]);

  const getLevelStatus = (conc: number) => {
    if (conc > 300) return { label: 'status.level.high', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
    if (conc >= 100 && conc <= 200) return { label: 'status.level.mtf', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (conc >= 70 && conc <= 300) return { label: 'status.level.luteal', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    if (conc >= 30 && conc < 70) return { label: 'status.level.follicular', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    if (conc >= 8 && conc < 30) return { label: 'status.level.male', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
    return { label: 'status.level.low', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  };

  const currentStatus = useMemo(() => {
    if (currentLevel > 0) {
      return getLevelStatus(currentLevel);
    }
    return null;
  }, [currentLevel]);

  return (
    <>
      <header className="relative px-4 md:px-8 pt-6 pb-4">
        <div className="grid md:grid-cols-3 gap-3 md:gap-4">
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-5">
            <div className="flex items-center mb-3">
              <h1 className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 text-[11px] md:text-xs font-semibold text-gray-700 border border-gray-200">
                <Activity size={14} className="text-gray-500" />
                {t('status.estimate')}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* E2 Display */}
              <div className="space-y-1">
                <div className="text-[10px] md:text-xs font-bold text-pink-400 uppercase tracking-wider">
                  E2
                </div>
                <div className="flex items-end gap-2">
                  {currentLevel > 0 ? (
                    <>
                      <span className="text-4xl md:text-5xl font-black text-pink-500 tracking-tight">
                        {currentLevel.toFixed(0)}
                      </span>
                      <span className="text-sm md:text-base font-bold text-pink-300 mb-1">pg/mL</span>
                    </>
                  ) : (
                    <span className="text-4xl md:text-5xl font-black text-gray-300 tracking-tight">
                      --
                    </span>
                  )}
                </div>
                {currentStatus && (
                  <div className={`px-2.5 py-1 rounded-lg border ${currentStatus.bg} ${currentStatus.border} flex items-center gap-1.5 mt-2 w-fit`}>
                    <Info size={10} className={currentStatus.color} />
                    <span className={`text-[9px] md:text-[10px] font-bold ${currentStatus.color}`}>
                      {t(currentStatus.label)}
                    </span>
                  </div>
                )}
              </div>
              {/* CPA Display */}
              <div className="space-y-1">
                <div className="text-[10px] md:text-xs font-bold text-purple-400 uppercase tracking-wider">
                  CPA
                </div>
                <div className="flex items-end gap-2">
                  {currentCPA > 0 ? (
                    <>
                      <span className="text-4xl md:text-5xl font-black text-purple-600 tracking-tight">
                        {currentCPA.toFixed(0)}
                      </span>
                      <span className="text-sm md:text-base font-bold text-purple-300 mb-1">ng/mL</span>
                    </>
                  ) : (
                    <span className="text-4xl md:text-5xl font-black text-gray-300 tracking-tight">
                      --
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200">
                <Activity size={18} className="text-gray-600" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] md:text-xs font-semibold text-gray-500">{t('timeline.title')}</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{events.length || 0}</p>
              </div>
            </div>
            <button
              onClick={onOpenWeightModal}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-gray-300 transition text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200">
                <Settings size={18} className="text-gray-700" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] md:text-xs font-semibold text-gray-500">{t('status.weight')}</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{weight} kg</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="bg-white w-full px-4 py-6">
        <ResultChart
          sim={simulation}
          events={events}
          onPointClick={onEditEvent}
          labResults={labResults}
          calibrationFn={calibrationFn}
        />
      </main>
    </>
  );
};

export default OverviewView;

import React from 'react';
import { FlaskConical, Plus, Eye } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { formatDate, formatTime } from '../utils/helpers';
import { LabResult } from '../../logic';

interface LabViewProps {
  labResults: LabResult[];
  currentTime: Date;
  calibrationFn: (h: number) => number;
  onAddLabResult: () => void;
  onEditLabResult: (result: LabResult) => void;
  onClearLabResults: () => void;
}

const LabView: React.FC<LabViewProps> = ({
  labResults,
  currentTime,
  calibrationFn,
  onAddLabResult,
  onEditLabResult,
  onClearLabResults,
}) => {
  const { t, lang } = useTranslation();

  return (
    <div className="relative space-y-5 pt-6 pb-8">
      <div className="px-4">
        <div className="w-full p-4 rounded-2xl bg-white flex items-center justify-between shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            <FlaskConical size={22} className="text-teal-500" /> {t('lab.title')}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onAddLabResult}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 h-11 rounded-xl bg-gray-900 text-white text-sm font-bold shadow-sm hover:shadow-md transition"
            >
              <Plus size={16} />
              <span>{t('lab.add_title')}</span>
            </button>
          </div>
        </div>
      </div>

      {labResults.length === 0 ? (
        <div className="mx-4 text-center py-12 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
          <p>{t('lab.empty')}</p>
        </div>
      ) : (
        <div className="mx-4 bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {labResults
            .slice()
            .sort((a, b) => b.timeH - a.timeH)
            .map(res => {
              const d = new Date(res.timeH * 3600000);
              return (
                <div
                  key={res.id}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer group relative"
                  onClick={() => onEditLabResult(res)}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-teal-50 border border-teal-100">
                    <FlaskConical className="text-teal-500" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 text-sm truncate">
                        {res.concValue} {res.unit}
                      </span>
                      <span className="font-mono text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        {formatTime(d)}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {formatDate(d, lang)}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <div className="mx-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between px-4 py-3">
        <div className="text-xs text-gray-500">
          {t('lab.tip_scale')} ×{calibrationFn(currentTime.getTime() / 3600000).toFixed(2)}
        </div>
        <button
          onClick={onClearLabResults}
          disabled={!labResults.length}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
            labResults.length ? 'text-red-500 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          {t('lab.clear_all')}
        </button>
      </div>
    </div>
  );
};

export default LabView;

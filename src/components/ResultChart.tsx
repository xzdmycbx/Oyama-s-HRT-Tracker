import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { formatDate, formatTime } from '../utils/helpers';
import { SimulationResult, DoseEvent, interpolateConcentration_E2, interpolateConcentration_CPA, LabResult, convertToPgMl } from '../../logic';
import { Activity, RotateCcw, Info, FlaskConical } from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Scatter, Brush
} from 'recharts';

interface SimCI {
    timeH: number[];
    e2Adjusted: number[];
    ci95Low: number[];
    ci95High: number[];
    cpaAdjusted: number[];
    cpaCi95Low: number[];
    cpaCi95High: number[];
}

function interpAt(timeH: number[], values: number[], h: number): number | undefined {
    if (!timeH.length || !values.length || timeH.length !== values.length) return undefined;
    if (h <= timeH[0]) return values[0];
    if (h >= timeH[timeH.length - 1]) return values[values.length - 1];
    let lo = 0;
    let hi = timeH.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (timeH[mid] <= h) lo = mid;
        else hi = mid;
    }
    const span = timeH[hi] - timeH[lo];
    const frac = span > 0 ? (h - timeH[lo]) / span : 0;
    const v = values[lo] + (values[hi] - values[lo]) * frac;
    return Number.isFinite(v) ? v : undefined;
}

const CustomTooltip = ({ active, payload, label, t, lang }: any) => {
    if (active && payload && payload.length) {
        // If it's a lab result point
        if (payload[0].payload.isLabResult) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-teal-100/50 shadow-sm">
                    <p className="text-[10px] font-medium text-gray-400 mb-0.5 flex items-center gap-1">
                        <FlaskConical size={10} />
                        {formatDate(new Date(label), lang)} {formatTime(new Date(label))}
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-teal-600 tracking-tight">
                            {data.originalValue}
                        </span>
                        <span className="text-[10px] font-bold text-teal-400">{data.originalUnit}</span>
                    </div>
                    {data.originalUnit === 'pmol/l' && (
                        <div className="text-[9px] text-gray-400 mt-0.5">
                            ≈ {data.conc.toFixed(1)} pg/mL
                        </div>
                    )}
                </div>
            );
        }

        const dataPoint = payload[0].payload;
        const concE2 = dataPoint.concE2 || 0;
        const concCPA = dataPoint.concCPA || 0;
        const concPersonal = dataPoint.concPersonal;
        const concPersonalCPA = dataPoint.concPersonalCPA;
        const ciLow = dataPoint.ci95Low;
        const ciHigh = dataPoint.ci95High;
        const cpaCiLow = dataPoint.cpaCi95Low;
        const cpaCiHigh = dataPoint.cpaCi95High;

        return (
            <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-pink-100/50 shadow-sm">
                <p className="text-[10px] font-medium text-gray-400 mb-0.5">
                    {formatDate(new Date(label), lang)} {formatTime(new Date(label))}
                </p>
                {concE2 > 0 && (
                    <div className="flex items-baseline gap-1">
                        <span className="text-[9px] font-bold text-pink-400">E2:</span>
                        <span className="text-sm font-black text-pink-500 tracking-tight">
                            {concE2.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-pink-300">pg/mL</span>
                    </div>
                )}
                {concPersonal !== undefined && concPersonal > 0 && (
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[9px] font-bold text-rose-400">{t('chart.personal_model')} E2:</span>
                        <span className="text-sm font-black text-rose-600 tracking-tight">
                            {concPersonal.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-rose-300">pg/mL</span>
                        {ciLow !== undefined && ciHigh !== undefined && (
                            <span className="text-[9px] text-gray-400 ml-1">
                                [{ciLow.toFixed(0)}–{ciHigh.toFixed(0)}]
                            </span>
                        )}
                    </div>
                )}
                {concCPA > 0 && (
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[9px] font-bold text-purple-400">CPA:</span>
                        <span className="text-sm font-black text-purple-600 tracking-tight">
                            {concCPA.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-purple-300">ng/mL</span>
                    </div>
                )}
                {concPersonalCPA !== undefined && concPersonalCPA > 0 && (
                    <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[9px] font-bold text-violet-500">{t('chart.personal_model')} CPA:</span>
                        <span className="text-sm font-black text-violet-700 tracking-tight">
                            {concPersonalCPA.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-violet-400">ng/mL</span>
                        {cpaCiLow !== undefined && cpaCiHigh !== undefined && (
                            <span className="text-[9px] text-gray-400 ml-1">
                                [{cpaCiLow.toFixed(2)} - {cpaCiHigh.toFixed(2)}]
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const ResultChart = ({ sim, events, labResults = [], simCI, onPointClick }: {
    sim: SimulationResult | null;
    events: DoseEvent[];
    labResults?: LabResult[];
    simCI?: SimCI | null;
    onPointClick: (e: DoseEvent) => void;
}) => {
    const { t, lang } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [xDomain, setXDomain] = useState<[number, number] | null>(null);
    const initializedRef = useRef(false);
    const E2_AXIS_FALLBACK_MAX = 10;
    const CPA_AXIS_FALLBACK_MAX = 1;

    const niceCeil = (value: number, fallback: number): number => {
        if (!Number.isFinite(value) || value <= 0) return fallback;
        const exp = Math.floor(Math.log10(value));
        const base = Math.pow(10, exp);
        const norm = value / base;
        const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
        return step * base;
    };

    const formatAxisTick = (raw: any): string => {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return '0';
        if (n >= 100) return `${Math.round(n)}`;
        if (n >= 10) return `${Math.round(n)}`;
        if (n >= 1) return n.toFixed(1);
        return n.toFixed(2);
    };

    const niceFloor = (value: number, fallback: number): number => {
        if (!Number.isFinite(value)) return fallback;
        if (value <= 0) return 0;
        const exp = Math.floor(Math.log10(value));
        const base = Math.pow(10, exp);
        const norm = value / base;
        const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
        return step * base;
    };

    const downsampleSeries = <T extends { time: number }>(series: T[], maxPoints = 1200): T[] => {
        if (series.length <= maxPoints) return series;
        const step = Math.ceil(series.length / maxPoints);
        const result: T[] = [];

        const extremaValue = (d: any) => {
            const vals = [
                d.concE2, d.concPersonal, d.ci95Low, d.ci95High,
                d.concCPA, d.concPersonalCPA, d.cpaCi95Low, d.cpaCi95High
            ].filter((v: number | undefined) => typeof v === 'number' && Number.isFinite(v));
            if (!vals.length) return { min: 0, max: 0 };
            return { min: Math.min(...vals), max: Math.max(...vals) };
        };

        for (let i = 0; i < series.length; i += step) {
            const slice = series.slice(i, i + step);
            if (!slice.length) continue;

            let minIdx = 0;
            let maxIdx = 0;
            let minVal = Number.POSITIVE_INFINITY;
            let maxVal = Number.NEGATIVE_INFINITY;

            for (let j = 0; j < slice.length; j++) {
                const { min, max } = extremaValue(slice[j]);
                if (min < minVal) {
                    minVal = min;
                    minIdx = j;
                }
                if (max > maxVal) {
                    maxVal = max;
                    maxIdx = j;
                }
            }

            const bucket: T[] = [];
            bucket.push(slice[0]);
            if (minIdx !== 0 && minIdx !== slice.length - 1 && minIdx !== maxIdx) bucket.push(slice[minIdx]);
            if (maxIdx !== 0 && maxIdx !== slice.length - 1) bucket.push(slice[maxIdx]);
            if (slice.length > 1) bucket.push(slice[slice.length - 1]);

            for (const pt of bucket) {
                if (!result.length || result[result.length - 1].time !== pt.time) {
                    result.push(pt);
                }
            }
        }

        return result;
    };

    // Build CI lookup map for fast time-based access
    const hasPersonalCpaModel = !!simCI && simCI.cpaAdjusted.length === simCI.timeH.length;
    const hasPersonalCpaCI = !!simCI &&
        simCI.cpaCi95Low.length === simCI.timeH.length &&
        simCI.cpaCi95High.length === simCI.timeH.length;

    const ciMap = useMemo(() => {
        if (!simCI) return null;
        const m = new Map<number, {
            ci95Low: number;
            ci95High: number;
            e2Adj: number;
            cpaAdj?: number;
            cpaCi95Low?: number;
            cpaCi95High?: number;
        }>();
        for (let i = 0; i < simCI.timeH.length; i++) {
            m.set(simCI.timeH[i], {
                ci95Low: simCI.ci95Low[i],
                ci95High: simCI.ci95High[i],
                e2Adj: simCI.e2Adjusted[i],
                cpaAdj: hasPersonalCpaModel ? simCI.cpaAdjusted[i] : undefined,
                cpaCi95Low: hasPersonalCpaCI ? simCI.cpaCi95Low[i] : undefined,
                cpaCi95High: hasPersonalCpaCI ? simCI.cpaCi95High[i] : undefined,
            });
        }
        return m;
    }, [simCI, hasPersonalCpaModel, hasPersonalCpaCI]);

    const rawData = useMemo(() => {
        if (!sim || sim.timeH.length === 0) return [];
        return sim.timeH.map((t, i) => {
            const timeMs = t * 3600000;
            // E2: raw simulation (no calibrationFn — personal model curve shows the calibrated view)
            const baseE2 = sim.concPGmL_E2[i]; // pg/mL
            const rawCPA_ngmL = sim.concPGmL_CPA[i]; // ng/mL

            // Personal model CI data (from EKF)
            const ciEntry = ciMap?.get(t);
            const ci95Low = ciEntry?.ci95Low;
            const ci95High = ciEntry?.ci95High;
            const concPersonal = ciEntry?.e2Adj;
            const concPersonalCPA = ciEntry?.cpaAdj;
            const cpaCi95Low = ciEntry?.cpaCi95Low;
            const cpaCi95High = ciEntry?.cpaCi95High;
            // ci95Band = ci95High - ci95Low for stacked Area rendering
            const ci95Band = (ci95Low !== undefined && ci95High !== undefined)
                ? Math.max(0, ci95High - ci95Low)
                : undefined;
            const cpaCi95Band = (cpaCi95Low !== undefined && cpaCi95High !== undefined)
                ? Math.max(0, cpaCi95High - cpaCi95Low)
                : undefined;

            return {
                time: timeMs,
                concE2: baseE2,          // pg/mL, raw (reference curve)
                concCPA: rawCPA_ngmL,    // ng/mL, raw (reference curve)
                concPersonal,            // personal model E2 (pg/mL)
                concPersonalCPA,         // personal model CPA (ng/mL)
                ci95Low,
                ci95Band,
                ci95High,
                cpaCi95Low,
                cpaCi95Band,
                cpaCi95High,
            };
        });
    }, [sim, ciMap]);

    const data = useMemo(() => downsampleSeries(rawData, 1200), [rawData]);

    const labPoints = useMemo(() => {
        if (!labResults || labResults.length === 0) return [];
        return labResults.map(l => ({
            time: l.timeH * 3600000,
            conc: convertToPgMl(l.concValue, l.unit),
            originalValue: l.concValue,
            originalUnit: l.unit,
            isLabResult: true,
            id: l.id
        }));
    }, [labResults]);

    const eventPoints = useMemo(() => {
        if (!sim || events.length === 0) return [];

        return events.map(e => {
            const timeMs = e.timeH * 3600000;
            const closestIdx = sim.timeH.reduce((prev, curr, i) =>
                Math.abs(curr * 3600000 - timeMs) < Math.abs(sim.timeH[prev] * 3600000 - timeMs) ? i : prev
            , 0);

            // Use raw E2 (no calibration — personal model handles calibration)
            const baseE2 = sim.concPGmL_E2[closestIdx]; // pg/mL

            return {
                time: timeMs,
                concE2: baseE2,
                event: e
            };
        });
    }, [sim, events]);

    const { minTime, maxTime, now } = useMemo(() => {
        const series = rawData.length ? rawData : data;
        const n = new Date().getTime();
        if (series.length === 0) return { minTime: n, maxTime: n, now: n };
        return {
            minTime: series[0].time,
            maxTime: series[series.length - 1].time,
            now: n
        };
    }, [rawData, data]);

    // Compute left-axis Y domain from visible E2-related series in current viewport.
    // CI is included but bounded relative to the base curve, to avoid squeezing curves to the floor.
    const yDomainLeft = useMemo((): [number, number | string] => {
        const visibleMin = xDomain ? xDomain[0] : minTime;
        const visibleMax = xDomain ? xDomain[1] : maxTime;
        const source = rawData.length ? rawData : data;
        const baseVals: number[] = [];
        const ciVals: number[] = [];
        const pushIfValid = (v: number | undefined) => {
            if (typeof v !== 'number') return;
            if (!Number.isFinite(v)) return;
            if (v <= 0) return;
            baseVals.push(v);
        };
        const pushCiIfValid = (v: number | undefined) => {
            if (typeof v !== 'number') return;
            if (!Number.isFinite(v)) return;
            if (v <= 0) return;
            ciVals.push(v);
        };
        for (const d of source) {
            if (d.time < visibleMin || d.time > visibleMax) continue;
            pushIfValid(d.concE2);
            pushIfValid(d.concPersonal);
            pushCiIfValid(d.ci95High);
        }
        for (const l of labPoints) {
            if (l.time >= visibleMin && l.time <= visibleMax) pushIfValid(l.conc);
        }
        const basePeak = baseVals.length ? Math.max(...baseVals) : 0;
        const minVal = baseVals.length ? Math.min(...baseVals) : 0;
        const ciPeakRaw = ciVals.length ? Math.max(...ciVals) : 0;
        const ciCap = basePeak > 0 ? Math.max(basePeak * 1.5, basePeak + 20) : E2_AXIS_FALLBACK_MAX;
        const ciPeak = Math.min(ciPeakRaw, ciCap);
        const peak = Math.max(basePeak, ciPeak, E2_AXIS_FALLBACK_MAX);
        const padded = Math.max(E2_AXIS_FALLBACK_MAX, peak * 1.12); // 12% headroom
        const lower = minVal > 0 ? niceFloor(minVal * 0.85, 0) : 0;
        let upper = niceCeil(padded, E2_AXIS_FALLBACK_MAX);
        if (upper - lower < 1) upper = lower + 1;
        return [lower, upper];
    }, [rawData, data, labPoints, xDomain, minTime, maxTime]);

    // Compute right-axis Y domain from visible CPA-related series in current viewport.
    const yDomainRight = useMemo((): [number, number | string] => {
        const visibleMin = xDomain ? xDomain[0] : minTime;
        const visibleMax = xDomain ? xDomain[1] : maxTime;
        const source = rawData.length ? rawData : data;
        const baseVals: number[] = [];
        const ciVals: number[] = [];
        const pushIfValid = (v: number | undefined) => {
            if (typeof v !== 'number') return;
            if (!Number.isFinite(v)) return;
            if (v <= 0) return;
            baseVals.push(v);
        };
        const pushCiIfValid = (v: number | undefined) => {
            if (typeof v !== 'number') return;
            if (!Number.isFinite(v)) return;
            if (v <= 0) return;
            ciVals.push(v);
        };
        for (const d of source) {
            if (d.time < visibleMin || d.time > visibleMax) continue;
            pushIfValid(d.concCPA);
            pushIfValid(d.concPersonalCPA);
            pushCiIfValid(d.cpaCi95High);
        }
        const basePeak = baseVals.length ? Math.max(...baseVals) : 0;
        const ciPeakRaw = ciVals.length ? Math.max(...ciVals) : 0;
        const ciCap = basePeak > 0 ? Math.max(basePeak * 1.5, basePeak + 0.2) : CPA_AXIS_FALLBACK_MAX;
        const ciPeak = Math.min(ciPeakRaw, ciCap);
        const peak = Math.max(basePeak, ciPeak, CPA_AXIS_FALLBACK_MAX);
        const padded = Math.max(CPA_AXIS_FALLBACK_MAX, peak * 1.12); // 12% headroom
        return [0, niceCeil(padded, CPA_AXIS_FALLBACK_MAX)];
    }, [rawData, data, xDomain, minTime, maxTime]);

    const nowPoint = useMemo(() => {
        if (!sim || data.length === 0) return null;
        const h = now / 3600000;

        const concE2 = interpolateConcentration_E2(sim, h);
        const concCPA = interpolateConcentration_CPA(sim, h);
        const concPersonal = simCI ? interpAt(simCI.timeH, simCI.e2Adjusted, h) : undefined;
        const ci95Low = simCI ? interpAt(simCI.timeH, simCI.ci95Low, h) : undefined;
        const ci95High = simCI ? interpAt(simCI.timeH, simCI.ci95High, h) : undefined;
        const concPersonalCPA = hasPersonalCpaModel
            ? interpAt(simCI!.timeH, simCI!.cpaAdjusted, h)
            : undefined;
        const cpaCi95Low = hasPersonalCpaCI
            ? interpAt(simCI!.timeH, simCI!.cpaCi95Low, h)
            : undefined;
        const cpaCi95High = hasPersonalCpaCI
            ? interpAt(simCI!.timeH, simCI!.cpaCi95High, h)
            : undefined;

        const hasE2 = concE2 !== null && !Number.isNaN(concE2);
        const hasCPA = concCPA !== null && !Number.isNaN(concCPA);

        if (!hasE2 && !hasCPA) return null;

        return {
            time: now,
            concE2: hasE2 ? concE2 : 0,   // pg/mL, raw
            concCPA: hasCPA ? concCPA : 0, // ng/mL, raw
            concPersonal,
            ci95Low,
            ci95High,
            concPersonalCPA,
            cpaCi95Low,
            cpaCi95High,
        };
    }, [sim, simCI, data, now, hasPersonalCpaModel, hasPersonalCpaCI]);

    // Slider helpers for quick panning (helps mobile users)
    // Initialize view: center on "now" with a reasonable window (e.g. 14 days)
    useEffect(() => {
        if (!initializedRef.current && data.length > 0) {
            const initialWindow = 7 * 24 * 3600 * 1000; // 1 week
            const start = Math.max(minTime, now - initialWindow / 2);
            const end = Math.min(maxTime, start + initialWindow);

            // Adjust if end is clamped
            const finalStart = Math.max(minTime, end - initialWindow);

            setXDomain([finalStart, end]);
            initializedRef.current = true;
        }
    }, [data, minTime, maxTime, now]);

    const clampDomain = (domain: [number, number]): [number, number] => {
        const width = domain[1] - domain[0];
        // Enforce min zoom (e.g. 1 day) and max zoom (total range)
        const MIN_ZOOM = 24 * 3600 * 1000;
        const MAX_ZOOM = Math.max(maxTime - minTime, MIN_ZOOM);

        let newWidth = Math.max(MIN_ZOOM, Math.min(width, MAX_ZOOM));
        let newStart = domain[0];
        let newEnd = newStart + newWidth;

        // Clamp to data bounds
        if (newStart < minTime) {
            newStart = minTime;
            newEnd = newStart + newWidth;
        }
        if (newEnd > maxTime) {
            newEnd = maxTime;
            newStart = newEnd - newWidth;
        }

        return [newStart, newEnd];
    };

    const zoomToDuration = (days: number) => {
        const duration = days * 24 * 3600 * 1000;
        const currentCenter = xDomain ? (xDomain[0] + xDomain[1]) / 2 : now;
        const targetCenter = (now >= minTime && now <= maxTime) ? now : currentCenter;

        const start = targetCenter - duration / 2;
        const end = targetCenter + duration / 2;
        setXDomain(clampDomain([start, end]));
    };

    const findClosestIndex = (time: number) => {
        if (data.length === 0) return 0;
        let low = 0;
        let high = data.length - 1;
        while (high - low > 1) {
            const mid = Math.floor((low + high) / 2);
            if (data[mid].time === time) return mid;
            if (data[mid].time < time) low = mid;
            else high = mid;
        }
        return Math.abs(data[high].time - time) < Math.abs(data[low].time - time) ? high : low;
    };

    const brushRange = useMemo(() => {
        if (data.length === 0) return { startIndex: 0, endIndex: 0 };
        const domain = xDomain || [minTime, maxTime];
        const startIndex = findClosestIndex(domain[0]);
        const endIndexRaw = findClosestIndex(domain[1]);
        const endIndex = Math.max(startIndex + 1, endIndexRaw);
        return { startIndex, endIndex: Math.min(data.length - 1, endIndex) };
    }, [data, xDomain, minTime, maxTime]);

    const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
        if (!range || range.startIndex === undefined || range.endIndex === undefined || data.length === 0) return;
        const startIndex = Math.max(0, Math.min(range.startIndex, data.length - 1));
        const endIndex = Math.max(startIndex + 1, Math.min(range.endIndex, data.length - 1));
        const start = data[startIndex].time;
        const end = data[endIndex].time;
        setXDomain(clampDomain([start, end]));
    };

    if (!sim || sim.timeH.length === 0) return (
        <div className="h-72 md:h-96 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <Activity className="w-12 h-12 mb-4 text-gray-200" strokeWidth={1.5} />
            <p className="text-sm font-medium">{t('timeline.empty')}</p>
        </div>
    );

    const hasPersonalModel = !!simCI;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <h2 className="text-sm md:text-base font-semibold text-gray-800 tracking-tight flex items-center gap-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif' }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-xl bg-pink-50 border border-pink-100">
                        <Activity size={16} className="text-[#f6c4d7] md:w-5 md:h-5" />
                    </span>
                    {t('chart.title')}
                    {hasPersonalModel && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-500 border border-rose-100">
                            {t('chart.personal_model')}
                        </span>
                    )}
                </h2>

                <div className="flex bg-gray-50 rounded-xl p-1 gap-1 border border-gray-100">
                    <button
                        onClick={() => zoomToDuration(30)}
                        className="px-3 py-1.5 text-xs md:text-sm font-bold text-gray-600 rounded-lg hover:bg-white transition-all">
                        1M
                    </button>
                    <button
                        onClick={() => zoomToDuration(7)}
                        className="px-3 py-1.5 text-xs md:text-sm font-bold text-gray-600 rounded-lg hover:bg-white transition-all">
                        1W
                    </button>
                    <div className="w-px h-4 bg-gray-200 self-center mx-1"></div>
                    <button
                        onClick={() => {
                            zoomToDuration(7);
                        }}
                        className="p-1.5 text-gray-600 rounded-lg hover:bg-white transition-all"
                    >
                        <RotateCcw size={14} className="md:w-4 md:h-4" />
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="h-64 md:h-80 lg:h-96 w-full touch-none relative select-none px-2 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: 10 }}>
                        <defs>
                            <linearGradient id="colorConc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f6c4d7" stopOpacity={0.18}/>
                                <stop offset="95%" stopColor="#f6c4d7" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCPA" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPersonal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.12}/>
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f4f7" />
                        <XAxis
                            dataKey="time"
                            type="number"
                            domain={xDomain || ['auto', 'auto']}
                            allowDataOverflow={true}
                            tickFormatter={(ms) => formatDate(new Date(ms), lang)}
                            tick={{fontSize: 10, fill: '#9aa3b1', fontWeight: 600}}
                            minTickGap={48}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis
                            yAxisId="left"
                            dataKey="concE2"
                            domain={yDomainLeft}
                            allowDataOverflow={false}
                            allowDecimals={false}
                            tickFormatter={formatAxisTick}
                            tick={{fontSize: 10, fill: '#ec4899', fontWeight: 600}}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                            label={{ value: 'E2 (pg/mL)', angle: -90, position: 'left', offset: 0, style: { fontSize: 11, fill: '#ec4899', fontWeight: 700, textAnchor: 'middle' } }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            dataKey="concCPA"
                            domain={yDomainRight}
                            tickFormatter={formatAxisTick}
                            tick={{fontSize: 10, fill: '#8b5cf6', fontWeight: 600}}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                            label={{ value: 'CPA (ng/mL)', angle: 90, position: 'right', offset: 0, style: { fontSize: 11, fill: '#8b5cf6', fontWeight: 700, textAnchor: 'middle' } }}
                        />
                        <Tooltip
                            content={<CustomTooltip t={t} lang={lang} />}
                            cursor={{ stroke: '#f6c4d7', strokeWidth: 1, strokeDasharray: '4 4' }}
                            trigger="hover"
                        />
                        <ReferenceLine x={now} stroke="#f6c4d7" strokeDasharray="3 3" strokeWidth={1.2} yAxisId="left" />

                        {/* 95% CI band (stacked area: ci95Low base + ci95Band on top) */}
                        {hasPersonalModel && (
                            <>
                                <Area
                                    data={data}
                                    type="monotone"
                                    dataKey="ci95Low"
                                    yAxisId="left"
                                    stroke="none"
                                    fill="none"
                                    stackId="ci"
                                    isAnimationActive={false}
                                    dot={false}
                                    activeDot={false}
                                    legendType="none"
                                />
                                <Area
                                    data={data}
                                    type="monotone"
                                    dataKey="ci95Band"
                                    yAxisId="left"
                                    stroke="none"
                                    fill="rgba(244,63,94,0.10)"
                                    fillOpacity={1}
                                    stackId="ci"
                                    isAnimationActive={false}
                                    dot={false}
                                    activeDot={false}
                                    legendType="none"
                                />
                            </>
                        )}
                        {hasPersonalModel && hasPersonalCpaModel && hasPersonalCpaCI && (
                            <>
                                <Area
                                    data={data}
                                    type="monotone"
                                    dataKey="cpaCi95Low"
                                    yAxisId="right"
                                    stroke="none"
                                    fill="none"
                                    stackId="cpaCi"
                                    isAnimationActive={false}
                                    dot={false}
                                    activeDot={false}
                                    legendType="none"
                                />
                                <Area
                                    data={data}
                                    type="monotone"
                                    dataKey="cpaCi95Band"
                                    yAxisId="right"
                                    stroke="none"
                                    fill="rgba(124,58,237,0.10)"
                                    fillOpacity={1}
                                    stackId="cpaCi"
                                    isAnimationActive={false}
                                    dot={false}
                                    activeDot={false}
                                    legendType="none"
                                />
                            </>
                        )}

                        <Area
                            data={data}
                            type="monotone"
                            dataKey="concE2"
                            yAxisId="left"
                            stroke="#f6c4d7"
                            strokeWidth={2.2}
                            fillOpacity={0.95}
                            fill="url(#colorConc)"
                            isAnimationActive={false}
                            activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff', fill: '#ec4899' }}
                        />
                        <Area
                            data={data}
                            type="monotone"
                            dataKey="concCPA"
                            yAxisId="right"
                            stroke="#8b5cf6"
                            strokeWidth={2.2}
                            fillOpacity={0.95}
                            fill="url(#colorCPA)"
                            isAnimationActive={false}
                            activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff', fill: '#7c3aed' }}
                        />

                        {/* Personal model E2 curve (dashed rose line) */}
                        {hasPersonalModel && (
                            <Area
                                data={data}
                                type="monotone"
                                dataKey="concPersonal"
                                yAxisId="left"
                                stroke="#f43f5e"
                                strokeWidth={1.8}
                                strokeDasharray="5 3"
                                fill="none"
                                isAnimationActive={false}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#f43f5e' }}
                            />
                        )}

                        {/* Personal model CPA curve (dashed purple line) */}
                        {hasPersonalModel && hasPersonalCpaModel && (
                            <Area
                                data={data}
                                type="monotone"
                                dataKey="concPersonalCPA"
                                yAxisId="right"
                                stroke="#7c3aed"
                                strokeWidth={1.8}
                                strokeDasharray="5 3"
                                fill="none"
                                isAnimationActive={false}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#7c3aed' }}
                            />
                        )}

                        <Scatter
                            data={nowPoint ? [nowPoint] : []}
                            yAxisId="left"
                            isAnimationActive={false}
                            shape={({ cx, cy }: any) => {
                                return (
                                    <g className="group">
                                        <circle cx={cx} cy={cy} r={1} fill="transparent" />
                                        <circle
                                            cx={cx} cy={cy}
                                            r={4}
                                            fill="#bfdbfe"
                                            stroke="white"
                                            strokeWidth={1.5}
                                        />
                                    </g>
                                );
                            }}
                        />
                        <Scatter
                            data={nowPoint ? [nowPoint] : []}
                            yAxisId="right"
                            isAnimationActive={false}
                            shape={({ cx, cy }: any) => {
                                return (
                                    <g className="group">
                                        <circle cx={cx} cy={cy} r={1} fill="transparent" />
                                        <circle
                                            cx={cx} cy={cy}
                                            r={4}
                                            fill="#c4b5fd"
                                            stroke="white"
                                            strokeWidth={1.5}
                                        />
                                    </g>
                                );
                            }}
                        />
                        {labPoints.length > 0 && (
                            <Scatter
                                data={labPoints}
                                yAxisId="left"
                                isAnimationActive={false}
                                shape={({ cx, cy }: any) => (
                                    <g>
                                        <circle cx={cx} cy={cy} r={6} fill="#14b8a6" stroke="white" strokeWidth={2} />
                                        <g transform={`translate(${(cx ?? 0) - 6}, ${(cy ?? 0) - 6})`}>
                                            <FlaskConical size={12} color="white" />
                                        </g>
                                    </g>
                                )}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            {/* Overview mini-map with draggable handles */}
            {data.length > 1 && (
                <div className="px-3 pb-4 mt-1">
                    <div className="w-full h-16 bg-gray-50/80 border border-gray-100 rounded-none shadow-inner overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 6, right: 8, left: -6, bottom: 6 }}>
                                <defs>
                                    <linearGradient id="overviewConc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#bfdbfe" stopOpacity={0.28}/>
                                        <stop offset="95%" stopColor="#bfdbfe" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="time"
                                    type="number"
                                    hide
                                    domain={[minTime, maxTime]}
                                />
                                <YAxis dataKey="concE2" hide />
                                <Area
                                    type="monotone"
                                    dataKey="concE2"
                                    stroke="#bfdbfe"
                                    strokeWidth={1.2}
                                    fill="url(#overviewConc)"
                                    isAnimationActive={false}
                                />
                                <Brush
                                    dataKey="time"
                                    height={22}
                                    stroke="#bfdbfe"
                                    startIndex={brushRange.startIndex}
                                    endIndex={brushRange.endIndex}
                                    travellerWidth={10}
                                    tickFormatter={(ms) => formatDate(new Date(ms), lang)}
                                    onChange={handleBrushChange}
                                >
                                    <Area
                                        type="monotone"
                                        dataKey="concE2"
                                        stroke="#93c5fd"
                                        fill="#bfdbfe"
                                        fillOpacity={0.15}
                                        isAnimationActive={false}
                                    />
                                </Brush>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultChart;

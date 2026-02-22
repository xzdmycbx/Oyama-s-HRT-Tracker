import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useRef, useCallback } from 'react';
import {
    DoseEvent, LabResult, SimulationResult,
    PersonalModelState, EKFDiagnostics,
    runSimulation, createCalibrationInterpolator,
    replayPersonalModel, computeSimulationWithCI, initPersonalModel,
    ekfUpdatePersonalModel,
} from '../../logic';
import { computeDataHash } from '../utils/dataHash';

const PERSONAL_MODEL_KEY = 'hrt-personal-model';
const APPLY_E2_LEARNING_TO_CPA_KEY = 'hrt-apply-e2-learning-to-cpa';

interface SimCI {
    timeH: number[];
    e2Adjusted: number[];
    ci95Low: number[];
    ci95High: number[];
    cpaAdjusted: number[];
    cpaCi95Low: number[];
    cpaCi95High: number[];
}

interface AppDataContextType {
    events: DoseEvent[];
    setEvents: React.Dispatch<React.SetStateAction<DoseEvent[]>>;
    weight: number;
    setWeight: React.Dispatch<React.SetStateAction<number>>;
    labResults: LabResult[];
    setLabResults: React.Dispatch<React.SetStateAction<LabResult[]>>;
    simulation: SimulationResult | null;
    calibrationFn: (h: number) => number;
    currentTime: Date;
    personalModel: PersonalModelState | null;
    simCI: SimCI | null;
    lastDiagnostics: EKFDiagnostics | null;
    applyE2LearningToCPA: boolean;
    setApplyE2LearningToCPA: React.Dispatch<React.SetStateAction<boolean>>;
    resetPersonalModel: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

function loadPersonalModel(): PersonalModelState | null {
    try {
        const raw = localStorage.getItem(PERSONAL_MODEL_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Validate shape AND value ranges before trusting stored data.
        // Theta values outside ±4 (log-space) indicate a corrupted/stale model;
        // reject and let the replay effect recompute from lab results.
        if (
            parsed?.modelVersion === 'pk-ekf-v1' &&
            Array.isArray(parsed.thetaMean) && parsed.thetaMean.length === 2 &&
            typeof parsed.thetaMean[0] === 'number' && Math.abs(parsed.thetaMean[0]) <= 4 &&
            typeof parsed.thetaMean[1] === 'number' && Math.abs(parsed.thetaMean[1]) <= 4 &&
            Array.isArray(parsed.thetaCov) && parsed.thetaCov.length === 2 &&
            typeof parsed.Rlog === 'number' &&
            typeof parsed.observationCount === 'number' &&
            Array.isArray(parsed.anchors)
        ) {
            return parsed as PersonalModelState;
        }
    } catch { /* ignore */ }
    return null;
}

function savePersonalModel(state: PersonalModelState | null) {
    if (state) {
        localStorage.setItem(PERSONAL_MODEL_KEY, JSON.stringify(state));
    } else {
        localStorage.removeItem(PERSONAL_MODEL_KEY);
    }
}

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [events, setEvents] = useState<DoseEvent[]>(() => {
        const saved = localStorage.getItem('hrt-events');
        return saved ? JSON.parse(saved) : [];
    });

    const [weight, setWeight] = useState<number>(() => {
        const saved = localStorage.getItem('hrt-weight');
        return saved ? parseFloat(saved) : 70.0;
    });

    const [labResults, setLabResults] = useState<LabResult[]>(() => {
        const saved = localStorage.getItem('hrt-lab-results');
        return saved ? JSON.parse(saved) : [];
    });

    const [simulation, setSimulation] = useState<SimulationResult | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [personalModel, setPersonalModel] = useState<PersonalModelState | null>(loadPersonalModel);
    const [simCI, setSimCI] = useState<SimCI | null>(null);
    const [lastDiagnostics, setLastDiagnostics] = useState<EKFDiagnostics | null>(null);
    const [applyE2LearningToCPA, setApplyE2LearningToCPA] = useState<boolean>(() => {
        const raw = localStorage.getItem(APPLY_E2_LEARNING_TO_CPA_KEY);
        if (raw === null) return false;
        return raw === '1' || raw.toLowerCase() === 'true';
    });

    const suppressLocalUpdateRef = useRef({
        events: false,
        weight: false,
        labResults: false,
    });
    const isInitialLoadRef = useRef({
        events: true,
        weight: true,
        labResults: true,
    });

    const markExternalUpdate = (key: keyof typeof suppressLocalUpdateRef.current) => {
        suppressLocalUpdateRef.current[key] = true;
    };

    const finalizeLocalUpdate = (key: keyof typeof suppressLocalUpdateRef.current, updateKey: string) => {
        if (suppressLocalUpdateRef.current[key]) {
            suppressLocalUpdateRef.current[key] = false;
            return;
        }
        if (isInitialLoadRef.current[key]) {
            isInitialLoadRef.current[key] = false;
            return;
        }
        const lastModified = new Date().toISOString();
        localStorage.setItem('hrt-last-modified', lastModified);
        window.dispatchEvent(new CustomEvent('hrt-local-data-updated', { detail: { key: updateKey, lastModified } }));
    };

    // Persist to localStorage
    useEffect(() => {
        const value = JSON.stringify(events);
        localStorage.setItem('hrt-events', value);
        finalizeLocalUpdate('events', 'hrt-events');
    }, [events]);
    useEffect(() => {
        const value = weight.toString();
        localStorage.setItem('hrt-weight', value);
        finalizeLocalUpdate('weight', 'hrt-weight');
    }, [weight]);
    useEffect(() => {
        const value = JSON.stringify(labResults);
        localStorage.setItem('hrt-lab-results', value);
        finalizeLocalUpdate('labResults', 'hrt-lab-results');
    }, [labResults]);
    useEffect(() => {
        localStorage.setItem(APPLY_E2_LEARNING_TO_CPA_KEY, applyE2LearningToCPA ? '1' : '0');
    }, [applyE2LearningToCPA]);

    useEffect(() => {
        const lang = localStorage.getItem('hrt-lang') || 'en';
        const hash = computeDataHash({ events, weight, labResults, lang });
        localStorage.setItem('hrt-data-hash', hash);
    }, [events, weight, labResults]);

    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            const syncKeys = ['hrt-events', 'hrt-weight', 'hrt-lab-results'];
            const isCloudSync = e.key === 'hrt-data-synced';
            const isOtherTabSync = e.storageArea === localStorage && e.key && syncKeys.includes(e.key);
            if (!isCloudSync && !isOtherTabSync) {
                return;
            }

            if (e.key === 'hrt-events' || isCloudSync) {
                if (isCloudSync || isOtherTabSync) {
                    markExternalUpdate('events');
                }
                const saved = localStorage.getItem('hrt-events');
                setEvents(saved ? JSON.parse(saved) : []);
            }

            if (e.key === 'hrt-weight' || isCloudSync) {
                if (isCloudSync || isOtherTabSync) {
                    markExternalUpdate('weight');
                }
                const saved = localStorage.getItem('hrt-weight');
                setWeight(saved ? parseFloat(saved) : 70.0);
            }

            if (e.key === 'hrt-lab-results' || isCloudSync) {
                if (isCloudSync || isOtherTabSync) {
                    markExternalUpdate('labResults');
                }
                const saved = localStorage.getItem('hrt-lab-results');
                setLabResults(saved ? JSON.parse(saved) : []);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Run simulation when events or weight change
    useEffect(() => {
        if (events.length > 0) {
            const res = runSimulation(events, weight);
            setSimulation(res);
        } else {
            setSimulation(null);
        }
    }, [events, weight]);

    // Rebuild personal model whenever events, weight, or labResults change
    useEffect(() => {
        if (labResults.length === 0) {
            setPersonalModel(null);
            setLastDiagnostics(null);
            setSimCI(null);
            savePersonalModel(null);
            return;
        }

        // Replay EKF from the prior using all sorted lab results
        const newModel = replayPersonalModel(events, weight, labResults);

        // Derive last diagnostics from the most recent lab point
        const sorted = [...labResults].sort((a, b) => a.timeH - b.timeH);
        const lastLab = sorted[sorted.length - 1];

        // Build prior state (n-1 replayed) to get the update diagnostics
        const priorModel = labResults.length > 1
            ? replayPersonalModel(events, weight, sorted.slice(0, -1))
            : initPersonalModel();

        const { diagnostics } = ekfUpdatePersonalModel(events, weight, priorModel, lastLab);
        setLastDiagnostics(diagnostics);

        setPersonalModel(newModel);
        savePersonalModel(newModel);
    }, [events, weight, labResults]);

    // Recompute CI bands whenever simulation or personal model changes
    useEffect(() => {
        if (!simulation || !personalModel || personalModel.observationCount === 0) {
            setSimCI(null);
            return;
        }
        const ci = computeSimulationWithCI(simulation, events, weight, personalModel, applyE2LearningToCPA);
        setSimCI(ci);
    }, [simulation, personalModel, events, weight, applyE2LearningToCPA]);

    // Create calibration function (legacy ratio-based, still used for current-scale display)
    const calibrationFn = useMemo(() => {
        return createCalibrationInterpolator(simulation, labResults);
    }, [simulation, labResults]);

    const resetPersonalModel = useCallback(() => {
        setPersonalModel(null);
        setLastDiagnostics(null);
        setSimCI(null);
        savePersonalModel(null);
    }, []);

    const value = {
        events,
        setEvents,
        weight,
        setWeight,
        labResults,
        setLabResults,
        simulation,
        calibrationFn,
        currentTime,
        personalModel,
        simCI,
        lastDiagnostics,
        applyE2LearningToCPA,
        setApplyE2LearningToCPA,
        resetPersonalModel,
    };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
    const context = useContext(AppDataContext);
    if (context === undefined) {
        throw new Error('useAppData must be used within an AppDataProvider');
    }
    return context;
};

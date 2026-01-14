import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DoseEvent, LabResult, SimulationResult, runSimulation, createCalibrationInterpolator } from '../../logic';
import { computeDataHash } from '../utils/dataHash';

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
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

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

    // Create calibration function
    const calibrationFn = useMemo(() => {
        return createCalibrationInterpolator(simulation, labResults);
    }, [simulation, labResults]);

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

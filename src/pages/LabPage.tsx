import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext';
import { LabResult } from '../../logic';
import LabView from '../views/LabView';

interface OutletContext {
    onAddLabResult: () => void;
    onEditLabResult: (result: LabResult) => void;
    onClearLabResults: () => void;
}

const LabPage: React.FC = () => {
    const { onAddLabResult, onEditLabResult, onClearLabResults } = useOutletContext<OutletContext>();
    const { labResults, currentTime, calibrationFn } = useAppData();

    return (
        <LabView
            labResults={labResults}
            currentTime={currentTime}
            calibrationFn={calibrationFn}
            onAddLabResult={onAddLabResult}
            onEditLabResult={onEditLabResult}
            onClearLabResults={onClearLabResults}
        />
    );
};

export default LabPage;

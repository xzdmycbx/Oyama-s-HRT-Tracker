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
    const {
        labResults,
        personalModel,
        lastDiagnostics,
        applyE2LearningToCPA,
        setApplyE2LearningToCPA,
    } = useAppData();

    return (
        <LabView
            labResults={labResults}
            personalModel={personalModel}
            lastDiagnostics={lastDiagnostics}
            applyE2LearningToCPA={applyE2LearningToCPA}
            onSetApplyE2LearningToCPA={setApplyE2LearningToCPA}
            onAddLabResult={onAddLabResult}
            onEditLabResult={onEditLabResult}
            onClearLabResults={onClearLabResults}
        />
    );
};

export default LabPage;

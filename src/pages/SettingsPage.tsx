import React from 'react';
import { useAppData } from '../contexts/AppDataContext';
import SettingsView from '../views/SettingsView';

const SettingsPage: React.FC = () => {
    const { events, setEvents, weight, setWeight, labResults, setLabResults } = useAppData();

    return (
        <SettingsView
            events={events}
            setEvents={setEvents}
            weight={weight}
            setWeight={setWeight}
            labResults={labResults}
            setLabResults={setLabResults}
            onBack={() => {}} // Not needed in new routing system
        />
    );
};

export default SettingsPage;

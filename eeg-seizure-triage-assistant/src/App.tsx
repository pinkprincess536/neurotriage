/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { INITIAL_PATIENTS, Patient, SessionLog } from './types';
import Login from './components/Login';
import DoctorDashboard from './components/DoctorDashboard';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [user, setUser] = useState<{ role: 'admin' | 'doctor'; name: string } | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);

  // 1. Initial configuration load
  useEffect(() => {
    try {
      const cached = localStorage.getItem('cerebro_eeg_patients');
      if (cached) {
        setPatients(JSON.parse(cached));
      } else {
        setPatients(INITIAL_PATIENTS);
        localStorage.setItem('cerebro_eeg_patients', JSON.stringify(INITIAL_PATIENTS));
      }
    } catch {
      setPatients(INITIAL_PATIENTS);
    }
  }, []);

  // 2. Persist state changes
  const saveToStorage = (updatedList: Patient[]) => {
    setPatients(updatedList);
    try {
      localStorage.setItem('cerebro_eeg_patients', JSON.stringify(updatedList));
    } catch (e) {
      console.warn("Storage write limit reached", e);
    }
  };

  // 3. Authenticate User Action
  const handleLogin = (role: 'admin' | 'doctor', name: string) => {
    setUser({ role, name });
  };

  // 4. Terminate Session Action
  const handleLogout = () => {
    setUser(null);
  };

  // 5. Append Patient Case Subject
  const handleAddPatient = (newPatient: Patient) => {
    const updated = [newPatient, ...patients];
    saveToStorage(updated);
  };

  // 6. Save or Update Session Triage Logs
  const handleSaveLog = (patientId: string, updatedLog: SessionLog) => {
    const updated = patients.map(p => {
      if (p.id === patientId) {
        // If log already exists, replace it, otherwise append it
        const exists = p.seizureLogs.some(log => log.id === updatedLog.id);
        const updatedLogs = exists
          ? p.seizureLogs.map(log => log.id === updatedLog.id ? updatedLog : log)
          : [updatedLog, ...p.seizureLogs];

        return {
          ...p,
          seizureLogs: updatedLogs,
          totalRecordings: updatedLogs.length
        };
      }
      return p;
    });

    saveToStorage(updated);
  };

  // Route Views Authoritatively
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return (
      <AdminPanel
        patientsList={patients}
        onLogout={handleLogout}
        displayName={user.name}
      />
    );
  }

  return (
    <DoctorDashboard
      patientsList={patients}
      onAddPatient={handleAddPatient}
      onSaveLog={handleSaveLog}
      displayName={user.name}
      onLogout={handleLogout}
    />
  );
}


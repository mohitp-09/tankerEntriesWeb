import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LabelView from './pages/LabelView';
import DayEntries from './pages/DayEntries';
import MonthlySummary from './pages/MonthlySummary';

// Components
import Layout from './components/Layout';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/labels/:labelId" 
        element={
          <ProtectedRoute>
            <LabelView />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/labels/:labelId/:year/:month/:day" 
        element={
          <ProtectedRoute>
            <DayEntries />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/labels/:labelId/:year/:month/summary" 
        element={
          <ProtectedRoute>
            <MonthlySummary />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
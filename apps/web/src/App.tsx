import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { LoginPage } from './pages/LoginPage';
import { PublicSurveyPage } from './pages/PublicSurveyPage';
import { SettingsPage } from './pages/SettingsPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { SurveyCreatePage } from './pages/SurveyCreatePage';
import { SurveyDetailPage } from './pages/SurveyDetailPage';
import { SurveyEditPage } from './pages/SurveyEditPage';
import { SurveysPage } from './pages/SurveysPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ padding: 40 }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/s/:token" element={<PublicSurveyPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/super" element={<SuperAdminPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/surveys/new" element={<SurveyCreatePage />} />
        <Route path="/surveys/:id/edit" element={<SurveyEditPage />} />
        <Route path="/surveys/:id" element={<SurveyDetailPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

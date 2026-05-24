import Navbar    from "./components/Navbar";
import Login     from "./page/login/login";
import Register  from "./page/login/register";
import Dashboard from "./page/Dashboard/Dashboard";
import ExamPage  from "./page/exam/exampage";
import ScanExam  from "./page/exam/examscan";
import Reports   from "./page/reports/reports";
import InReports from "./page/reports/inreports";
import Students  from "./page/students/Students";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";

function App() {
  const location   = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Exams",     path: "/exam"      },
    { label: "Students",  path: "/students"  },
    { label: "Reports",   path: "/reports"   },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg,#e4dbfe 0%,#ffffff 40%,#f9fafb 100%)" }}
    >
      {!isAuthPage && <Navbar navItems={navItems} />}
      <Routes>
        <Route path="/"          element={<Navigate to="/login" replace />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/scan"          element={<ScanExam />} />
        <Route path="/exam/:id/scan" element={<ScanExam />} />
        <Route path="/exam"          element={<ExamPage key={location.key} />} />

        <Route path="/students" element={<Students />} />

        <Route path="/reports"              element={<Reports />} />
        <Route path="/reports/:subjectName" element={<InReports />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;
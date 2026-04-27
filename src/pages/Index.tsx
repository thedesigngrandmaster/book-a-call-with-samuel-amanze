import { Navigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import BookingPage from "@/pages/BookingPage";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading, roleLoading } = useAuth();

  // While auth/role is loading, render the public booking page (no redirect flicker)
  if (user && !loading && !roleLoading && role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AppShell>
      <BookingPage />
    </AppShell>
  );
};

export default Index;

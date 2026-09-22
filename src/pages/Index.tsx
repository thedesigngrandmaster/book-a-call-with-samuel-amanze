// src/pages/Index.tsx
import { Navigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import BookingPage from "@/pages/BookingPage";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role, loading, roleLoading } = useAuth();

  if (user && !loading && !roleLoading && role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BookingPage />
    </AppShell>
  );
};

export default Index;

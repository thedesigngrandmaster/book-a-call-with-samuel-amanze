import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import NotificationsPage from "./pages/NotificationsPage.tsx";
import BookingDetailPage from "./pages/BookingDetailPage.tsx";
import HostPage from "./pages/HostPage.tsx";
import AppShell from "./components/layout/AppShell.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/samuel" element={<AppShell><HostPage /></AppShell>} />
          <Route path="/auth" element={<AppShell><AuthPage /></AppShell>} />
          <Route path="/account" element={<AppShell><AccountPage /></AppShell>} />
          <Route path="/admin" element={<AppShell><AdminPage /></AppShell>} />
          <Route path="/admin/notifications" element={<AppShell><NotificationsPage /></AppShell>} />
          <Route path="/admin/bookings/:id" element={<AppShell><BookingDetailPage /></AppShell>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

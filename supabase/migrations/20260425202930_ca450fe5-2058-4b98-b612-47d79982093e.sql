-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto profile creation + seed admin if officialsammy61@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));

  IF NEW.email = 'officialsammy61@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin notification recipients (extra emails to notify)
CREATE TABLE public.admin_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recipients" ON public.admin_recipients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_recipients (email) VALUES ('officialsammy61@gmail.com') ON CONFLICT DO NOTHING;

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  visitor_email TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  meet_link TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bookings_status_check CHECK (status IN ('confirmed', 'canceled'))
);
CREATE INDEX bookings_starts_at_idx ON public.bookings (starts_at);
CREATE UNIQUE INDEX bookings_unique_active_slot ON public.bookings (starts_at) WHERE status = 'confirmed';

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + auth) can read confirmed slots to know what is taken (no PII exposure via separate view? we keep simple: only starts_at/ends_at via a function)
-- Simpler: expose a SECURITY DEFINER function for taken slots.
CREATE OR REPLACE FUNCTION public.taken_slots(_from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE (starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT starts_at, ends_at FROM public.bookings WHERE status = 'confirmed' AND starts_at >= _from AND starts_at < _to;
$$;

CREATE POLICY "Visitor views own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = visitor_id);
CREATE POLICY "Admins view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated visitors create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = visitor_id);
CREATE POLICY "Visitor cancels own booking" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = visitor_id);
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Notifications (admin)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipient views own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "Recipient updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

-- After a booking is created, fan-out a notification to every admin user
CREATE OR REPLACE FUNCTION public.notify_admins_on_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE admin_id UUID;
BEGIN
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (recipient_id, booking_id, type, title, body)
    VALUES (admin_id, NEW.id, 'booking_created',
            NEW.visitor_name || ' booked a meeting',
            to_char(NEW.starts_at AT TIME ZONE 'UTC', 'Mon DD, YYYY HH24:MI') || ' UTC');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_booking();
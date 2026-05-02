CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $f$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $fn$ SELECT NULL::uuid $fn$;
    $f$;
  END IF;
END $$;

-- 1. Habilitar RLS en todas las tablas del esquema core
ALTER TABLE core.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.merchant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.merchant_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.staff_working_hours ENABLE ROW LEVEL SECURITY;

-- 2. Crear una función auxiliar para obtener el merchant_id del usuario actual
-- Esto evita repetir subconsultas complejas en cada política.
CREATE OR REPLACE FUNCTION core.get_my_merchant_id()
RETURNS uuid AS $$
  SELECT merchant_id 
  FROM core.merchant_staff 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 3. POLÍTICAS POR TABLA

-- MERCHANTS: El staff solo ve su propio comercio. 
-- Nota: Para el "Handshake de Branding" (público), permitimos lectura por slug.
CREATE POLICY "Public branding access" ON core.merchants
  FOR SELECT USING (true); -- El endpoint /config/:slug es público[cite: 13].

CREATE POLICY "Staff manage own merchant" ON core.merchants
  FOR ALL USING (id = core.get_my_merchant_id());

-- SERVICES: Staff gestiona, clientes (público o autenticado) ven.
CREATE POLICY "Anyone can view services" ON core.services
  FOR SELECT USING (true);

CREATE POLICY "Staff manage services" ON core.services
  FOR ALL USING (merchant_id = core.get_my_merchant_id());

-- APPOINTMENTS: Aislamiento total por comercio[cite: 8, 48].
CREATE POLICY "Staff manage appointments" ON core.appointments
  FOR ALL USING (merchant_id = core.get_my_merchant_id());

-- STAFF TABLES: Solo accesibles para miembros del mismo comercio.
CREATE POLICY "Staff view colleagues" ON core.merchant_staff
  FOR SELECT USING (merchant_id = core.get_my_merchant_id());

CREATE POLICY "Manage staff hours" ON core.staff_working_hours
  FOR ALL USING (merchant_id = core.get_my_merchant_id());

CREATE POLICY "Manage staff services" ON core.staff_services
  FOR ALL USING (merchant_id = core.get_my_merchant_id());

-- CUSTOMERS: El staff solo ve clientes vinculados a su comercio.
CREATE POLICY "Staff view merchant customers" ON core.merchant_customers
  FOR ALL USING (merchant_id = core.get_my_merchant_id());
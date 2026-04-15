import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yincycmdsdluueqsxtwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbmN5Y21kc2RsdXVlcXN4dHduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDUzOTUsImV4cCI6MjA5MTY4MTM5NX0.GTAOSZChdqpQDsWsNuaqib7wDAY03HLNGu-Sy4JkOv0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
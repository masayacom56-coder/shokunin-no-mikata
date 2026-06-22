export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      companies: { Row: { id: string; name: string; created_at: string }; Insert: { id?: string; name: string }; Update: { name?: string } };
      customers: { Row: { id: string; company_id: string; name: string }; Insert: { company_id: string; name: string }; Update: { name?: string } };
      projects: { Row: { id: string; company_id: string; customer_id: string; title: string }; Insert: { company_id: string; customer_id: string; title: string }; Update: { title?: string } };
      estimates: { Row: { id: string; company_id: string; project_id: string; estimate_no: string }; Insert: { company_id: string; project_id: string; estimate_no: string }; Update: { estimate_no?: string } };
      subscriptions: { Row: { id: string; company_id: string; plan_code: string; status: string }; Insert: { company_id: string; plan_code: string; status: string }; Update: { status?: string } };
    };
  };
};

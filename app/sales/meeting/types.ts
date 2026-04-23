export interface ClientOption {
  client_code: string;
  client_name: string;
  importance?: number;
  manager?: string;
  business_type?: string;
}

export interface Meeting {
  id: number;
  client_code: string;
  meeting_date: string;
  meeting_time: string | null;
  meeting_type: string;
  status: string;
  purpose: string | null;
  notes: string | null;
  ai_briefing: any;
  client_name: string;
  client_importance: number;
  client_business_type: string;
  client_manager: string;
  client_contact: string;
  reminder_minutes: number | null;
  is_company_event?: boolean;
}

export interface BriefingData {
  generated_at: string;
  client_summary: {
    total_purchases: number;
    avg_price: number;
    top_countries: string[];
    top_grapes: string[];
    top_types: string[];
    last_order_date: string | null;
    trend: string;
  };
  recommendations: {
    item_no: string;
    item_name: string;
    score: number;
    tags: string[];
    reason: string;
    price: number;
    stock: number;
    country?: string;
    region?: string;
    grape?: string;
    wine_type?: string;
  }[];
  recent_orders: {
    item_name: string;
    ship_date: string;
    quantity: number;
  }[];
}

export type ViewMode = "week" | "month";

export type ReminderToast = { text: string; meetingId: number };

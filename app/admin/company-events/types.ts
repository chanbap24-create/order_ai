export interface CompanyEvent {
  id: number;
  meeting_date: string;
  meeting_time: string | null;
  purpose: string | null;
  notes: string | null;
  is_company_event: boolean;
}

export interface EventForm {
  date: string;
  time: string;
  title: string;
  notes: string;
}

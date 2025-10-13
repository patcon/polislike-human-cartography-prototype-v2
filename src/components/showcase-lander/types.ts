export interface Conversation {
  name: string;
  description: string;
  notes: string;
  image_url?: string;
  polis_convo_url: string;
  polis_report_url: string;
  pipeline_repo_url: string;
  pipeline_viz_url: string;
  simple_explorer_url: string;
  advanced_explorer_url: string;
  show_on_website?: string;
}

export interface ConversationListingProps {
  conversations: Conversation[];
  loading?: boolean;
  error?: string | null;
}
import { useState, useEffect } from 'react';
import type { Conversation } from './types';

const GSHEET_URL = 'https://docs.google.com/spreadsheets/d/1u8AKvHyzYiyq6_Zcwb_g0S8eVxnCrBYsxksfCrA-bP8/edit?gid=0#gid=0';

// Extract spreadsheet ID from the Google Sheets URL and construct CSV export URL
function getCSVUrl(gsheetUrl: string): string {
  const match = gsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Sheets URL');
  }
  const spreadsheetId = match[1];
  return `https://docs.google.com/spreadsheet/ccc?key=${spreadsheetId}&output=csv`;
}

const CSV_URL = getCSVUrl(GSHEET_URL);

function parseCSV(csvText: string): Conversation[] {
  const lines = csvText.trim().split('\n');
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(header => header.trim().replace(/\r/g, ''));

  return lines.slice(1).map(line => {
    // Simple comma-separated parsing - split by comma and map to headers
    const values = line.split(',').map(value => value.trim().replace(/\r/g, ''));

    const conversation: any = {};
    headers.forEach((header, index) => {
      // Use the value at the corresponding index, or empty string if not present
      conversation[header] = values[index] || '';
    });

    return conversation as Conversation;
  });
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(CSV_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch conversations: ${response.statusText}`);
        }

        const csvText = await response.text();
        const parsedConversations = parseCSV(csvText);

        // Filter conversations to only show those with a non-empty show_on_website value
        const filteredConversations = parsedConversations.filter(conversation =>
          conversation.show_on_website && conversation.show_on_website.trim() !== ''
        );

        setConversations(filteredConversations);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, []);

  return { conversations, loading, error };
}
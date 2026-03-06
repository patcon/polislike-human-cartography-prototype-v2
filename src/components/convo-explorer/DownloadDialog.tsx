"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
type DownloadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (prefixDate: boolean) => void;
  onConfirmVotes?: (prefixDate: boolean) => void;
  participantCount: number;
  columnCount: number;
  statementCount?: number;
  conversationId?: string;
};

export const DownloadDialog = React.forwardRef<
  React.ElementRef<typeof AlertDialogContent>,
  DownloadDialogProps
>(({ open, onOpenChange, onConfirm, onConfirmVotes, participantCount, columnCount, statementCount, conversationId }, ref) => {
  const [prefixDate, setPrefixDate] = React.useState(false);

  const handleConfirm = () => {
    onConfirm(prefixDate);
    onOpenChange(false);
  };

  const handleConfirmVotes = () => {
    onConfirmVotes?.(prefixDate);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent ref={ref}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileDown size={20} />
            Download Data as CSV?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will download data from the loaded file as a CSV.
            {conversationId && <> Conversation: <strong>{conversationId}</strong>.</>}
            {' '}The files can be opened in any spreadsheet application.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <div className="flex items-center gap-2 mr-auto">
            <Switch
              id="prefix-date"
              checked={prefixDate}
              onCheckedChange={setPrefixDate}
            />
            <label htmlFor="prefix-date" className="text-sm cursor-pointer">
              Prefix with today's date
            </label>
          </div>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="flex items-center gap-2"
          >
            <FileDown size={16} />
            Download Participants CSV
            <span className="text-xs opacity-70">({participantCount} rows, {columnCount} cols)</span>
          </AlertDialogAction>
          {onConfirmVotes && (
            <AlertDialogAction
              onClick={handleConfirmVotes}
              className="flex items-center gap-2"
            >
              <FileDown size={16} />
              Download Votes CSV
              {statementCount !== undefined && (
                <span className="text-xs opacity-70">({participantCount} rows, {statementCount} cols)</span>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

DownloadDialog.displayName = "DownloadDialog";

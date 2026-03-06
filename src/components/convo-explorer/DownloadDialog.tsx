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

        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center gap-3">
            <Switch
              id="prefix-date"
              checked={prefixDate}
              onCheckedChange={setPrefixDate}
            />
            <label htmlFor="prefix-date" className="text-sm cursor-pointer">
              Prefix filenames with today's date
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <AlertDialogAction
              onClick={handleConfirm}
              className="flex items-center gap-2 justify-center"
            >
              <FileDown size={16} />
              Download Participants CSV
              <span className="text-xs opacity-70">({participantCount} × {columnCount})</span>
            </AlertDialogAction>
            {onConfirmVotes && (
              <AlertDialogAction
                onClick={handleConfirmVotes}
                className="flex items-center gap-2 justify-center"
              >
                <FileDown size={16} />
                Download Votes CSV
                {statementCount !== undefined && (
                  <span className="text-xs opacity-70">({participantCount} × {statementCount})</span>
                )}
              </AlertDialogAction>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

DownloadDialog.displayName = "DownloadDialog";

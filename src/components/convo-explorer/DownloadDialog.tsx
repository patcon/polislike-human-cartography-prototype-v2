"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
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
  onConfirmH5ad?: (prefixDate: boolean) => void;
  participantCount: number;
  columnCount: number;
  statementCount?: number;
  conversationId?: string;
};

export const DownloadDialog = React.forwardRef<
  React.ElementRef<typeof AlertDialogContent>,
  DownloadDialogProps
>(({ open, onOpenChange, onConfirm, onConfirmVotes, onConfirmH5ad, participantCount, columnCount, statementCount, conversationId }, ref) => {
  const [prefixDate, setPrefixDate] = React.useState(false);

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
            <Button
              onClick={() => onConfirm(prefixDate)}
              className="flex items-center gap-2 justify-center w-full"
            >
              <FileDown size={16} />
              Download Participants CSV
              <span className="text-xs opacity-70">({participantCount} × {columnCount})</span>
            </Button>
            {onConfirmVotes && (
              <Button
                onClick={() => onConfirmVotes(prefixDate)}
                className="flex items-center gap-2 justify-center w-full"
              >
                <FileDown size={16} />
                Download Votes CSV
                {statementCount !== undefined && (
                  <span className="text-xs opacity-70">({participantCount} × {statementCount})</span>
                )}
              </Button>
            )}
            {onConfirmH5ad && (
              <Button
                onClick={() => onConfirmH5ad(prefixDate)}
                variant="secondary"
                className="flex items-center gap-2 justify-center w-full"
              >
                <FileDown size={16} />
                Download h5ad
                <span className="text-xs opacity-70">(includes painted groups)</span>
              </Button>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

DownloadDialog.displayName = "DownloadDialog";

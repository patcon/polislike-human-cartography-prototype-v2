"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
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

type DownloadObsCsvDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  participantCount: number;
  columnCount: number;
};

export const DownloadObsCsvDialog = React.forwardRef<
  React.ElementRef<typeof AlertDialogContent>,
  DownloadObsCsvDialogProps
>(({ open, onOpenChange, onConfirm, participantCount, columnCount }, ref) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent ref={ref}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileDown size={20} />
            Download Participant Data as CSV?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will download participant metadata from the loaded .h5ad file as a CSV file.
            It contains {participantCount} participants across {columnCount} metadata columns (obs/*).
            The file can be opened in any spreadsheet application.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="flex items-center gap-2"
          >
            <FileDown size={16} />
            Download CSV
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

DownloadObsCsvDialog.displayName = "DownloadObsCsvDialog";

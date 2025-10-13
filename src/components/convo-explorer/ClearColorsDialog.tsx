"use client";

import * as React from "react";
import { Eraser } from "lucide-react";
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

type ClearColorsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const ClearColorsDialog = React.forwardRef<
  React.ElementRef<typeof AlertDialogContent>,
  ClearColorsDialogProps
>(({ open, onOpenChange, onConfirm }, ref) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent ref={ref}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Eraser size={20} className="text-red-600" />
            Erase All Painted Colors?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently erase all painted colors from the map and reset all points to unpainted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white flex items-center gap-2"
          >
            <Eraser size={16} />
            Erase All Colors
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

ClearColorsDialog.displayName = "ClearColorsDialog";
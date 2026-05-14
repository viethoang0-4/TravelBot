"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onImage: (base64: string) => void;
  onClear: () => void;
  image: string | null;
}

export default function ImageUploader({ onImage, onClear, image }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImage(result);
      };
      reader.readAsDataURL(file);
    },
    [onImage]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
  });

  if (image) {
    return (
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt="Preview"
          className="h-16 w-16 rounded-sm object-cover border shadow-sm"
        />
        <Button
          size="icon"
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 rounded-sm p-0 shadow-sm"
          onClick={onClear}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-sm border border-dashed cursor-pointer transition-all",
        isDragging
          ? "border-terracotta bg-terracotta/5"
          : "border-muted-foreground/30 hover:border-terracotta hover:bg-terracotta/5"
      )}
    >
      <input {...getInputProps()} />
      <ImageIcon className="w-[18px] h-[18px] text-muted-foreground transition-colors group-hover:text-terracotta" />
    </div>
  );
}

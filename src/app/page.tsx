"use client";

import { useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/hooks/use-toast";
import { Loader2, Download, Sprout } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface GeneratePlantResponse {
  imageUrl: string;
  error?: string;
}

interface APIError {
  error: string;
}

export default function Home() {
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const showError = useCallback(
    (message: string) => {
      console.error("Error:", message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    [toast],
  );

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showError("Please upload an image file");
        return;
      }

      if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
        showError("Please upload a PNG or JPG image");
        return;
      }

      if (file.size > 4 * 1024 * 1024) {
        showError("Image must be less than 4MB");
        return;
      }

      // Reset states
      setImageType(file.type);
      setGeneratedImage(null);

      // Create a new FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setRoomImage(result);
        }
      };
      reader.onerror = () => {
        showError("Failed to read image file");
      };
      reader.readAsDataURL(file);
    },
    [showError],
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset the input value so the same file can be uploaded again
      e.target.value = "";
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile],
  );

  const addPlants = async () => {
    if (!roomImage) {
      showError("Please upload a room image first");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-plant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: roomImage,
          imageType,
        }),
      });

      const data = (await response.json()) as GeneratePlantResponse | APIError;

      if (!response.ok || "error" in data) {
        throw new Error(
          "error" in data ? data.error : "Failed to generate plants",
        );
      }

      setGeneratedImage(data.imageUrl);
    } catch (error) {
      console.error("Error adding plants:", error);
      showError(
        error instanceof Error ? error.message : "Failed to add plants",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white px-4 py-8 md:px-8"
    >
      {/* Minimal Header */}
      <motion.div initial={{ y: -20 }} animate={{ y: 0 }} className="mb-6">
        <h1 className="flex max-w-4xl justify-start text-5xl font-semibold text-gray-900 sm:text-7xl">
          Make the nature come to your room.
        </h1>
      </motion.div>

      <div className="flex flex-col gap-12 sm:flex-row sm:gap-4 sm:pt-12">
        <div className="flex sm:w-1/3">
          <h1 className="text-lg font-light text-gray-900 sm:max-w-sm sm:text-3xl">
            Room Planter is a tool that helps you to improve your room with
            plants!
          </h1>
        </div>
        <div className="sm:w-2/3">
          {/* Upload Section */}
          <AnimatePresence mode="wait">
            {!roomImage ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full overflow-hidden rounded-3xl border border-dashed border-gray-200 bg-gray-100"
              >
                <div
                  className={`relative flex h-[400px] w-full cursor-pointer flex-col items-center justify-center p-8 transition-colors ${
                    isDragging ? "bg-gray-200" : ""
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("room-image")?.click()}
                >
                  <div className="flex flex-col items-center space-y-6">
                    <Sprout className="h-16 w-16 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      Drop your room photo here or click to browse
                    </p>
                  </div>

                  <Input
                    id="room-image"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="overflow-hidden rounded-3xl bg-white"
              >
                <div className="relative h-[400px] w-full">
                  {roomImage && !generatedImage && (
                    <Image
                      src={roomImage}
                      alt="Room"
                      fill
                      className="rounded-3xl object-cover"
                      priority
                    />
                  )}
                  {generatedImage && (
                    <Image
                      src={generatedImage}
                      alt="Room with plants"
                      fill
                      className="rounded-3xl object-cover"
                      priority
                    />
                  )}
                  <AnimatePresence>
                    {isGenerating && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center rounded-3xl backdrop-blur-sm"
                      >
                        <div className="rounded-full bg-black/80 p-4">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex justify-center gap-3"
                >
                  {!generatedImage ? (
                    <Button
                      onClick={addPlants}
                      variant="ghost"
                      disabled={isGenerating}
                    >
                      {isGenerating ? "Loading..." : "Add Plants"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          setRoomImage(null);
                          setGeneratedImage(null);
                        }}
                        variant="ghost"
                      >
                        New Image
                      </Button>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <Button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = generatedImage;
                            a.download = "room-with-plants.png";
                            a.click();
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.main>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/hooks/use-toast";
import { Loader2, Download, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const drawImageToCanvas = useCallback((img: HTMLImageElement) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }, []);

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
          // Create a new image to ensure it triggers the load event
          const img = new Image();
          img.onload = () => {
            setRoomImage(result);
            drawImageToCanvas(img);
          };
          img.src = result;
        }
      };
      reader.onerror = () => {
        showError("Failed to read image file");
      };
      reader.readAsDataURL(file);
    },
    [showError, drawImageToCanvas],
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
    if (!canvasRef.current || !roomImage) {
      showError("Please upload a room image first");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      showError("Failed to get canvas context");
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

      // Store the generated image
      setGeneratedImage(data.imageUrl);

      // Create a new image to load the result
      const plantImg = new Image();
      plantImg.crossOrigin = "anonymous";
      plantImg.onload = () => {
        // Set canvas dimensions first
        canvas.width = plantImg.width;
        canvas.height = plantImg.height;

        // Then clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(plantImg, 0, 0);
      };
      plantImg.onerror = (e) => {
        console.error("Error loading generated image:", e);
        showError("Failed to load generated image");
        // On error, redraw the original image
        if (roomImage) {
          const originalImg = new Image();
          originalImg.onload = () => drawImageToCanvas(originalImg);
          originalImg.src = roomImage;
        }
      };
      plantImg.src = data.imageUrl;
    } catch (error) {
      console.error("Error adding plants:", error);
      showError(
        error instanceof Error ? error.message : "Failed to add plants",
      );
      // On error, redraw the original image
      if (roomImage) {
        const originalImg = new Image();
        originalImg.onload = () => drawImageToCanvas(originalImg);
        originalImg.src = roomImage;
      }
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
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="mb-12 text-center"
      >
        <h1 className="text-3xl font-light tracking-tight text-gray-900 md:text-4xl">
          Room Planter
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Transform your space with AI-generated plants
        </p>
      </motion.div>

      <div className="mx-auto max-w-3xl">
        {/* Upload Section */}
        <AnimatePresence mode="wait">
          {!roomImage ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50"
            >
              <div
                className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center p-8 transition-colors ${
                  isDragging ? "bg-gray-50" : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("room-image")?.click()}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ImageIcon className="mb-4 h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    Drop your room photo here or click to browse
                  </p>
                </motion.div>
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
              className="overflow-hidden rounded-lg bg-white"
            >
              <div className="relative">
                <canvas ref={canvasRef} className="w-full rounded-lg" />
                <img
                  src={roomImage}
                  alt="Uploaded room"
                  className="hidden"
                  onLoad={(e) =>
                    drawImageToCanvas(e.target as HTMLImageElement)
                  }
                />
                <AnimatePresence>
                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
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
                <Button
                  onClick={addPlants}
                  disabled={isGenerating}
                  className="min-w-[140px] rounded-full"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add Plants"
                  )}
                </Button>
                {generatedImage && (
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
                      variant="outline"
                      className="min-w-[140px] rounded-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.main>
  );
}

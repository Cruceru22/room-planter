/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import OpenAI from "openai"
import { NextResponse } from "next/server"
import { createCanvas, loadImage } from 'canvas'
import path from 'path'
import fs from 'fs'
import os from 'os'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY environment variable")
}

const openai = new OpenAI({ apiKey })

interface EditPlantRequest {
  image: string; // base64 image data
  imageType: string; // image MIME type
}

async function createMask(width: number, height: number): Promise<Buffer> {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  
  // Create a fully transparent image
  ctx.clearRect(0, 0, width, height)
  
  // Fill the bottom third with white (this is where plants will be added)
  ctx.fillStyle = 'white'
  ctx.fillRect(0, height * 0.7, width, height * 0.3)
  
  return canvas.toBuffer('image/png')
}

async function convertToSquarePNG(imageData: string): Promise<Buffer> {
  try {
    console.log("Starting image conversion...")
    
    // Create a 1024x1024 canvas
    const canvas = createCanvas(1024, 1024)
    const ctx = canvas.getContext('2d')

    // Load the image
    console.log("Loading image...")
    const img = await loadImage(imageData)
    console.log("Image loaded, dimensions:", img.width, "x", img.height)

    // Calculate dimensions to make image square while maintaining aspect ratio
    const size = Math.min(img.width, img.height)
    const x = (img.width - size) / 2
    const y = (img.height - size) / 2

    // Draw white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 1024, 1024)

    // Draw image centered and squared
    ctx.drawImage(img, x, y, size, size, 0, 0, 1024, 1024)
    console.log("Image processed successfully")

    // Return as buffer
    return canvas.toBuffer('image/png')
  } catch (error) {
    console.error("Error in convertToSquarePNG:", error)
    throw error
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    console.log("Fetching image from URL:", url)
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    console.log("Image fetched, size:", arrayBuffer.byteLength, "bytes")
    
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    console.log("Base64 conversion complete, length:", base64.length)
    
    if (base64.length === 0) {
      throw new Error("Generated image is empty")
    }
    
    return `data:image/png;base64,${base64}`
  } catch (error) {
    console.error("Error fetching image:", error)
    throw error
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const tempFilePath = path.join(os.tmpdir(), `room-${Date.now()}.png`)
  const maskFilePath = path.join(os.tmpdir(), `mask-${Date.now()}.png`)
  console.log("Temp file path:", tempFilePath)
  
  try {
    console.log("Starting POST request processing...")
    const body = (await req.json()) as EditPlantRequest
    const { image } = body
    console.log("Request received, image length:", image.length)

    // Convert image to PNG and ensure it's square
    console.log("Converting image...")
    const imageBuffer = await convertToSquarePNG(image)
    console.log("Image converted, buffer size:", imageBuffer.length)
    
    // Create mask
    console.log("Creating mask...")
    const maskBuffer = await createMask(1024, 1024)
    console.log("Mask created, size:", maskBuffer.length)
    
    // Save buffers to temporary files
    fs.writeFileSync(tempFilePath, imageBuffer)
    fs.writeFileSync(maskFilePath, maskBuffer)
    console.log("Temporary files created")

    // Let AI decide plant placement and types
    console.log("Calling OpenAI API...")
    const response = await openai.images.edit({
      image: fs.createReadStream(tempFilePath),
      mask: fs.createReadStream(maskFilePath),
      prompt: "Add realistic indoor plants ONLY in the white areas of the mask. Important instructions:\n\
1. DO NOT modify ANY existing elements in the room\n\
2. DO NOT change lighting, colors, or furniture\n\
3. ADD plants of varying sizes (small to large)\n\
4. PLACE plants naturally on the floor\n\
5. USE common indoor plants like Snake Plants, Peace Lilies, Monstera, and Fiddle Leaf Figs\n\
6. ENSURE plants look realistic and properly scaled to the room\n\
7. MAINTAIN the exact same room perspective and lighting",
      model: "dall-e-2",
      n: 1,
      size: "1024x1024",
      response_format: "url",
    })
    console.log("OpenAI API response received")

    const imageUrl = response.data[0]?.url
    if (!imageUrl) {
      throw new Error("No image URL received")
    }
    console.log("Success! Image URL:", imageUrl)

    // Fetch the image and convert to base64
    console.log("Fetching generated image...")
    const base64Image = await fetchImageAsBase64(imageUrl)
    
    // Validate the base64 image
    if (!base64Image.startsWith('data:image/png;base64,')) {
      throw new Error("Invalid image format received")
    }
    
    const base64Data = base64Image.split(',')[1]
    if (!base64Data || base64Data.length < 100) {
      throw new Error("Invalid or corrupted image data received")
    }
    
    console.log("Image successfully processed, base64 length:", base64Data.length)
    return NextResponse.json({ imageUrl: base64Image })
  } catch (error) {
    console.error("Detailed error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    if (error instanceof Error) {
      const err = error as { code?: string; status?: number; message: string }

      if (err.code === "billing_hard_limit_reached") {
        return NextResponse.json(
          { error: "OpenAI API billing limit reached. Please try again later." },
          { status: 402 }
        )
      }

      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
    }

    return NextResponse.json({ error: "Failed to edit image" }, { status: 500 })
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
      if (fs.existsSync(maskFilePath)) {
        fs.unlinkSync(maskFilePath)
      }
      console.log("Temporary files cleaned up")
    } catch (e) {
      console.error('Failed to clean up temporary files:', e)
    }
  }
}



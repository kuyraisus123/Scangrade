import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload buffer ไป Cloudinary
 * @param buffer  - file buffer จาก multer
 * @param folder  - โฟลเดอร์ใน Cloudinary เช่น "scangrade/sheets"
 * @param filename - ชื่อไฟล์ (ไม่มีนามสกุล)
 * @returns secure_url ของไฟล์ที่ upload
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  filename?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: any = {
      folder,
      resource_type: 'image',
      format: 'jpg',
    }
    if (filename) options.public_id = filename

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(error || new Error('Upload failed'))
      } else {
        resolve(result.secure_url)
      }
    })

    stream.end(buffer)
  })
}

export default cloudinary
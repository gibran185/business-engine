import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucketName = 'merchant-logos';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Storage operations will fail.',
      );
      this.supabase = null as unknown as SupabaseClient;
    } else {
      this.supabase = createClient(supabaseUrl, serviceRoleKey);
    }
  }

  async onModuleInit() {
    if (!this.supabase) return;
    const { data: buckets } = await this.supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === this.bucketName);
    if (!exists) {
      const { error } = await this.supabase.storage.createBucket(
        this.bucketName,
        { public: true },
      );
      if (error) {
        this.logger.error(
          `Failed to create bucket "${this.bucketName}": ${error.message}`,
        );
      } else {
        this.logger.log(`Created storage bucket "${this.bucketName}"`);
      }
    }
  }

  /**
   * Upload a merchant logo to Supabase Storage.
   * @param merchantId - The merchant UUID
   * @param file - The file buffer
   * @param contentType - The MIME type (e.g., 'image/png')
   * @returns The public URL of the uploaded file
   */
  async uploadMerchantLogo(
    merchantId: string,
    file: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const extension = this.getExtensionFromContentType(contentType);
    const path = `${merchantId}/logo.${extension}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Failed to upload logo: ${error.message}`, error);
      throw new Error(`Failed to upload logo: ${error.message}`);
    }

    // Get the public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  /**
   * Delete a merchant logo from Supabase Storage.
   * @param merchantId - The merchant UUID
   */
  async deleteMerchantLogo(merchantId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Try common extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    const paths = extensions.map((ext) => `${merchantId}/logo.${ext}`);

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove(paths);

    if (error) {
      this.logger.error(`Failed to delete logo: ${error.message}`, error);
      throw new Error(`Failed to delete logo: ${error.message}`);
    }
  }

  /**
   * Validate that the file type is an acceptable image.
   */
  validateImageType(mimetype: string): boolean {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    return allowedTypes.includes(mimetype);
  }

  /**
   * Validate that the file size is within limits (2MB).
   */
  validateImageSize(sizeBytes: number): boolean {
    const maxSize = 2 * 1024 * 1024; // 2MB
    return sizeBytes <= maxSize;
  }

  private getExtensionFromContentType(contentType: string): string {
    switch (contentType) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
        return 'jpg';
      case 'image/webp':
        return 'webp';
      default:
        return 'png';
    }
  }
}

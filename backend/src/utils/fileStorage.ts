// Placeholder file storage service; later can be wired to S3-compatible storage.
export interface StoredFile {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export const fileStorage = {
  async saveFile(_buffer: Buffer, _fileName: string, _mimeType: string): Promise<StoredFile> {
    throw new Error("fileStorage.saveFile not implemented");
  },
};


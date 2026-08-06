export type ClipboardContent = {
  html: string
  plainText: string
}

export interface ClipboardGateway {
  readBrowserRich(): Promise<ClipboardContent>
  readBrowserPlainText(): Promise<string>
  readNative(): Promise<ClipboardContent>
  writeBrowserText(text: string): Promise<void>
  writeNativeText(text: string): Promise<void>
  startWatch(): Promise<boolean>
  stopWatch(): Promise<void>
  onChanged(callback: () => void): () => void
  onWatchUnavailable(callback: () => void): () => void
}

export interface WindowGateway {
  focus(): Promise<void>
}

export interface FileContentGateway {
  getPathForFile(file: File): string
  createTempFile(fileName: string): Promise<string>
  write(filePath: string, data: Uint8Array): Promise<void>
  get(filePath: string): Promise<FileMetadata | null>
  readText(filePath: string): Promise<string>
  readDocument(filePath: string): Promise<string>
  startImageOcr(filePath: string): Promise<string>
}
import type { FileMetadata } from '@renderer/types/file'

/// <reference types="vite/client" />

// 1. Augment the File System Access API types
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface PermissionStatus {
  state: 'granted' | 'denied' | 'prompt';
}

// 2. Extend the base FileSystemHandle interface
interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

// 3. Ensure Window can handle the picker
interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
}
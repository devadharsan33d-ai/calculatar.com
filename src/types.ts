export type VaultItemType = 'image' | 'video' | 'document';

export interface VaultItem {
  id: string;
  name: string;
  type: VaultItemType;
  encryptedData: string;
  mimeType: string;
  createdAt: string;
  userId: string;
  isFake?: boolean;
}

export interface VaultNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  userId: string;
  isFake?: boolean;
}

export interface IntruderAlert {
  id: string;
  timestamp: string;
  photo: string;
  userId: string;
  isFake?: boolean;
}

export interface UserSettings {
  userId: string;
  vaultPin: string;
  fakePin?: string;
  isFakeVault?: boolean;
}

export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
  userId: string;
  isFake?: boolean;
}

export interface AppLockItem {
  id: string;
  name: string;
  packageName: string;
  isLocked: boolean;
  userId: string;
  isFake?: boolean;
}

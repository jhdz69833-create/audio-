export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
}

export interface DriveListResponse {
  files: DriveFileItem[];
  nextPageToken?: string;
}

/**
 * List audio files and folders from the user's Google Drive.
 */
export async function listDriveAudioFiles(
  token: string,
  searchQuery?: string,
  folderId?: string
): Promise<DriveListResponse> {
  const fields = 'files(id, name, mimeType, size, modifiedTime, iconLink), nextPageToken';
  
  let q = "trashed = false and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.wav' or name contains '.ogg' or name contains '.flac' or name contains '.m4a' or mimeType = 'application/vnd.google-apps.folder')";
  
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  
  if (searchQuery && searchQuery.trim().length > 0) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', fields);
  url.searchParams.set('pageSize', '50');
  url.searchParams.set('orderBy', 'folder,name');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Downloads audio file binary data from Google Drive.
 */
export async function downloadDriveFileAsArrayBuffer(
  fileId: string,
  token: string
): Promise<ArrayBuffer> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download file from Google Drive (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}

/**
 * Uploads an audio recording or preset export to Google Drive.
 * Note: Must be preceded by explicit user confirmation in the UI.
 */
export async function uploadAudioToDrive(
  token: string,
  blob: Blob,
  fileName: string
): Promise<DriveFileItem> {
  const metadata = {
    name: fileName,
    mimeType: blob.type || 'audio/wav',
    description: 'Processed with Tape Wow & Flutter Simulator',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to Google Drive (${response.status}): ${errorText}`);
  }

  return response.json();
}

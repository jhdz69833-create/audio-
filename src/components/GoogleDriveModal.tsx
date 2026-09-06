import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Folder,
  Music,
  Search,
  RefreshCw,
  ArrowLeft,
  Download,
  AlertCircle,
  HardDrive,
  LogOut,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  logout,
  getAccessToken,
  initAuth,
} from '../lib/auth';
import {
  listDriveAudioFiles,
  downloadDriveFileAsArrayBuffer,
  uploadAudioToDrive,
  DriveFileItem,
} from '../lib/googleDrive';
import { AudioEngine } from '../audio/AudioEngine';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: AudioEngine | null;
  onFileLoaded: (fileInfo: { id: string; name: string }) => void;
}

interface FolderHistoryItem {
  id: string;
  name: string;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  engine,
  onFileLoaded,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // File browser state
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderHistory, setFolderHistory] = useState<FolderHistoryItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upload confirmation modal state
  const [confirmUploadModal, setConfirmUploadModal] = useState<{
    isOpen: boolean;
    fileName: string;
  }>({
    isOpen: false,
    fileName: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  const currentFolder = folderHistory[folderHistory.length - 1];

  // Auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (authenticatedUser, accessToken) => {
        setUser(authenticatedUser);
        setToken(accessToken);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoadingAuth(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch files from Drive
  const fetchFiles = useCallback(
    async (folderId: string, query?: string) => {
      let activeToken = token;
      if (!activeToken) {
        activeToken = await getAccessToken();
        if (activeToken) setToken(activeToken);
      }
      if (!activeToken) return;

      setIsLoadingFiles(true);
      setError(null);

      try {
        const actualFolderId = folderId === 'root' ? undefined : folderId;
        const res = await listDriveAudioFiles(activeToken, query, actualFolderId);
        setFiles(res.files || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve files from Google Drive.';
        setError(msg);
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [token]
  );

  // Fetch files when folder or auth changes and modal is open
  useEffect(() => {
    if (isOpen && user && token) {
      fetchFiles(currentFolder.id, searchQuery);
    }
  }, [isOpen, user, token, currentFolder.id, fetchFiles, searchQuery]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        await fetchFiles('root');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in was not completed.';
      setError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setFiles([]);
      setFolderHistory([{ id: 'root', name: 'My Drive' }]);
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    }
  };

  const handleOpenFolder = (folderItem: DriveFileItem) => {
    setFolderHistory(prev => [...prev, { id: folderItem.id, name: folderItem.name }]);
    setSearchQuery('');
  };

  const handleGoBack = () => {
    if (folderHistory.length > 1) {
      setFolderHistory(prev => prev.slice(0, prev.length - 1));
      setSearchQuery('');
    }
  };

  const handleSelectAudioFile = async (fileItem: DriveFileItem) => {
    let activeToken = token;
    if (!activeToken) {
      activeToken = await getAccessToken();
    }
    if (!activeToken || !engine) {
      setError('Audio engine or authentication session is not ready.');
      return;
    }

    setDownloadingFileId(fileItem.id);
    setError(null);

    try {
      const arrayBuffer = await downloadDriveFileAsArrayBuffer(fileItem.id, activeToken);
      await engine.loadDriveAudioData(arrayBuffer);
      onFileLoaded({ id: fileItem.id, name: fileItem.name });
      setSuccessMessage(`Loaded "${fileItem.name}" into tape transport.`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download and decode audio file.';
      setError(msg);
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleTriggerSampleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    setConfirmUploadModal({
      isOpen: true,
      fileName: `Tape_Simulator_Bounce_${timestamp}.wav`,
    });
  };

  const handleConfirmUpload = async () => {
    let activeToken = token;
    if (!activeToken) activeToken = await getAccessToken();
    if (!activeToken) return;

    setIsUploading(true);
    setError(null);

    try {
      // Create a short 44.1kHz stereo audio snippet (sine warm pulse) to save as sample
      const sampleRate = 44100;
      const numSeconds = 2;
      const numFrames = sampleRate * numSeconds;
      const buffer = new ArrayBuffer(44 + numFrames * 2);
      const view = new DataView(buffer);

      // WAV Header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numFrames * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, numFrames * 2, true);

      // Generate audio samples
      for (let i = 0; i < numFrames; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 2) * 0.5;
        view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      await uploadAudioToDrive(activeToken, blob, confirmUploadModal.fileName);

      setSuccessMessage(`Successfully uploaded "${confirmUploadModal.fileName}" to your Google Drive!`);
      setConfirmUploadModal({ isOpen: false, fileName: '' });
      await fetchFiles(currentFolder.id, searchQuery);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload audio to Google Drive.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes?: string) => {
    if (!bytes) return '--';
    const b = parseInt(bytes, 10);
    if (isNaN(b)) return '--';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        id="google-drive-modal-card"
        className="relative w-full max-w-2xl rounded-2xl border border-stone-800 bg-stone-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-800 bg-stone-950/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                Google Drive Audio
                <span className="rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 border border-emerald-500/20">
                  Cloud Storage
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Stream your audio files directly into the vintage tape wow & flutter simulator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {!user || !token ? (
            /* Unauthenticated state */
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
                <HardDrive className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-stone-200">Connect to Google Drive</h3>
              <p className="mt-1 max-w-md text-xs text-stone-400 leading-relaxed">
                Sign in with your Google Account to access, audition, and process your audio recordings
                (.mp3, .wav, .flac, .ogg, .m4a) with the tape simulation engine.
              </p>

              {/* Official Google Sign-in Button */}
              <div className="mt-6">
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn || isLoadingAuth}
                  className="flex items-center gap-3 rounded-lg border border-stone-700 bg-white hover:bg-stone-100 text-stone-800 px-5 py-2.5 text-sm font-medium transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-5 w-5"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
                </button>
              </div>

              <div className="mt-4 text-[11px] text-stone-500">
                Your credentials and access tokens are managed securely in memory.
              </div>
            </div>
          ) : (
            /* Authenticated Drive Browser */
            <div className="flex flex-col gap-3 flex-1">
              {/* User profile toolbar */}
              <div className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      referrerPolicy="no-referrer"
                      className="h-6 w-6 rounded-full border border-stone-700"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium text-stone-200">{user.displayName || user.email}</span>
                    <span className="text-[10px] text-stone-500">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerSampleExport}
                    className="flex items-center gap-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 py-1 text-[11px] font-medium transition-colors border border-stone-700"
                    title="Upload sample tape output to Google Drive"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-amber-400" />
                    Save Bounce to Drive
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 px-2.5 py-1 text-[11px] transition-colors"
                  >
                    <LogOut className="h-3 w-3" />
                    Sign Out
                  </button>
                </div>
              </div>

              {/* Navigation & Search toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-stone-400 overflow-x-auto py-1">
                  {folderHistory.length > 1 && (
                    <button
                      onClick={handleGoBack}
                      className="rounded bg-stone-800 p-1 text-stone-300 hover:bg-stone-700 transition-colors mr-1"
                      title="Go back up"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {folderHistory.map((f, idx) => (
                    <React.Fragment key={f.id}>
                      {idx > 0 && <span className="text-stone-600">/</span>}
                      <button
                        onClick={() => {
                          setFolderHistory(prev => prev.slice(0, idx + 1));
                          setSearchQuery('');
                        }}
                        className={`hover:text-amber-400 transition-colors ${
                          idx === folderHistory.length - 1 ? 'text-amber-300 font-semibold' : 'text-stone-400'
                        }`}
                      >
                        {f.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
                    <input
                      type="text"
                      placeholder="Search audio files..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          fetchFiles(currentFolder.id, searchQuery);
                        }
                      }}
                      className="rounded-lg border border-stone-800 bg-stone-950 pl-8 pr-3 py-1 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50 w-44 md:w-56"
                    />
                  </div>
                  <button
                    onClick={() => fetchFiles(currentFolder.id, searchQuery)}
                    disabled={isLoadingFiles}
                    className="rounded-lg border border-stone-800 bg-stone-950 p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    title="Refresh file list"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Files Table / List */}
              <div className="flex-1 rounded-xl border border-stone-800 bg-stone-950/60 overflow-hidden flex flex-col min-h-[260px]">
                {isLoadingFiles ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-stone-500 text-xs">
                    <RefreshCw className="h-6 w-6 animate-spin text-amber-500 mb-2" />
                    <span>Loading files from Google Drive...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center text-stone-500 text-xs">
                    <Music className="h-8 w-8 text-stone-600 mb-2" />
                    <p className="font-medium text-stone-400">No audio files found</p>
                    <p className="mt-1 text-[11px] text-stone-500 max-w-sm">
                      No matching audio recordings (.mp3, .wav, .flac, .ogg, .m4a) were found in this
                      folder. Upload an audio file to your Google Drive to load it into the simulator.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-800/80 overflow-y-auto max-h-[320px]">
                    {files.map(file => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      const isDownloading = downloadingFileId === file.id;

                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between px-3 py-2.5 hover:bg-stone-900/60 transition-colors group text-xs"
                        >
                          <div
                            onClick={() => {
                              if (isFolder) handleOpenFolder(file);
                            }}
                            className={`flex items-center gap-3 min-w-0 flex-1 ${
                              isFolder ? 'cursor-pointer' : ''
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isFolder
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {isFolder ? <Folder className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-stone-200 group-hover:text-amber-300 transition-colors">
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-stone-500 font-mono">
                                <span>{isFolder ? 'Folder' : formatBytes(file.size)}</span>
                                {file.modifiedTime && (
                                  <span>
                                    • {new Date(file.modifiedTime).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="ml-3 shrink-0">
                            {isFolder ? (
                              <button
                                onClick={() => handleOpenFolder(file)}
                                className="rounded bg-stone-800 hover:bg-stone-700 px-2.5 py-1 text-[11px] font-medium text-stone-300 transition-colors"
                              >
                                Open
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectAudioFile(file)}
                                disabled={isDownloading}
                                className="flex items-center gap-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2.5 py-1 text-[11px] font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
                              >
                                {isDownloading ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    <span>Buffering...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3 w-3" />
                                    <span>Load into Tape Deck</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-stone-800 bg-stone-950/80 px-5 py-3 flex items-center justify-between text-xs text-stone-500">
          <span>Connected via Google Drive API v3</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 px-3.5 py-1.5 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Explicit User Confirmation Modal for Destructive/Mutating Operations */}
      {confirmUploadModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-stone-700 bg-stone-900 p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-amber-400" />
              Confirm Google Drive Upload
            </h3>
            <p className="mt-2 text-xs text-stone-300 leading-relaxed">
              Are you sure you want to save <span className="font-mono text-amber-300">&quot;{confirmUploadModal.fileName}&quot;</span> to your Google Drive account?
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              This action will create a new audio file in your Drive.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmUploadModal({ isOpen: false, fileName: '' })}
                disabled={isUploading}
                className="rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-md disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Confirm & Upload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

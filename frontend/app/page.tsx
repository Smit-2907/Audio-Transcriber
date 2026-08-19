'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Layers, History, Waves, RefreshCw } from 'lucide-react';
import UploadZone, { TranscriptionOptions } from '../components/UploadZone';
import TranscriptWorkspace, { Transcript, TranscriptSegment } from '../components/TranscriptWorkspace';

interface JobSummary {
  job_id: string;
  filename: string;
  size_bytes: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stage: string;
  duration: number;
  languages: string[];
  speakers: string[];
  createdAt: string;
  model_size: string;
  error?: string;
}

export default function Home() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<Transcript | null>(null);
  const [history, setHistory] = useState<JobSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Polling Job State
  const [pollingJob, setPollingJob] = useState<JobSummary | null>(null);

  // Load Job History on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('http://localhost:8000/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Start Upload and Transcription Pipeline
  const handleStartUpload = async (file: File, options: TranscriptionOptions) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('normalize_volume', String(options.normalize_volume));
      formData.append('reduce_noise', String(options.reduce_noise));
      formData.append('speech_enhance', String(options.speech_enhance));
      formData.append('strength', options.strength);
      formData.append('model_size', options.model_size);
      formData.append('expected_speakers', String(options.expected_speakers));

      // Create a temporary mock job in index list for local immediate feedback
      const tempJobId = 'temp-' + Date.now();
      const mockEntry: JobSummary = {
        job_id: tempJobId,
        filename: file.name,
        size_bytes: file.size,
        status: 'queued',
        stage: 'uploading',
        duration: 0.0,
        languages: [],
        speakers: [],
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        model_size: options.model_size
      };
      setPollingJob(mockEntry);
      
      const res = await fetch('http://localhost:8000/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const jobData = await res.json();
      const realJobId = jobData.job_id;

      // Start Polling Real Job Status
      startJobPolling(realJobId);
      fetchHistory();
    } catch (err) {
      alert('Failed to connect to transcription service. Make sure the backend is running.');
      setPollingJob(null);
    }
  };

  // Poll Job Status Loop
  const startJobPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/jobs/${jobId}`);
        if (!res.ok) return;

        const job: JobSummary = await res.json();
        setPollingJob(job);

        if (job.status === 'completed') {
          clearInterval(interval);
          // Load full completed transcript
          loadTranscript(jobId);
          fetchHistory();
        } else if (job.status === 'failed') {
          clearInterval(interval);
          fetchHistory();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
  };

  // Fetch full transcript details
  const loadTranscript = async (jobId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/jobs/${jobId}/transcript`);
      if (res.ok) {
        const data: Transcript = await res.json();
        setActiveTranscript(data);
        setActiveJobId(jobId);
        setPollingJob(null); // Clear polling overlay
      }
    } catch (err) {
      alert('Failed to load transcript.');
    }
  };

  // Save transcript changes back to API
  const handleUpdateTranscript = async (updatedSegments: TranscriptSegment[]) => {
    if (!activeJobId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/jobs/${activeJobId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: updatedSegments }),
      });
      if (!res.ok) {
        console.error('Failed to save transcript edit');
      }
    } catch (err) {
      console.error('Error saving transcript:', err);
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'uploading': return 'Uploading audio file...';
      case 'analyzing': return 'Analyzing audio metadata...';
      case 'enhancing': return 'Enhancing low-volume speech (FFmpeg)...';
      case 'transcribing': return 'Running multilingual AI transcription (Whisper)...';
      case 'speaker_detection': return 'Clustered speaker voices...';
      case 'finalizing': return 'Finalizing transcript details...';
      default: return 'Processing...';
    }
  };

  const stages = ['uploading', 'analyzing', 'enhancing', 'transcribing', 'finalizing'];

  const getStageIndex = (stage: string) => {
    const idx = stages.indexOf(stage);
    return idx === -1 ? 0 : idx;
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-full">
      {/* Navbar / App Header */}
      <header className="flex items-center justify-between pb-6 mb-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-accent rounded-xl text-white">
            <Waves size={24} />
          </div>
          <div className="text-left">
            <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center">
              AI Transcription Studio
              <span className="ml-2 text-[10px] bg-accent/20 text-accent font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider">POC</span>
            </h1>
            <p className="text-xs text-gray-400">Multilingual audio transcription & speaker clustering</p>
          </div>
        </div>
        
        {/* Refresh button */}
        {!activeTranscript && !pollingJob && (
          <button
            onClick={fetchHistory}
            className="p-2 bg-card hover:bg-[#16161c] border border-border rounded-xl text-gray-400 hover:text-white transition duration-150"
            title="Refresh List"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full flex flex-col justify-center">
        
        {/* 1. If actively viewing a transcript workspace */}
        {activeTranscript ? (
          <TranscriptWorkspace
            transcript={activeTranscript}
            onUpdate={handleUpdateTranscript}
            onBack={() => {
              setActiveTranscript(null);
              setActiveJobId(null);
              fetchHistory();
            }}
          />
        ) : pollingJob ? (
          
          /* 2. If a job is currently processing / transcribing */
          <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 space-y-6 text-center shadow-lg">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-t-accent border-border animate-spin"></div>
              <Sparkles size={24} className="text-accent animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Transcribing Audio</h3>
              <p className="text-xs text-gray-400 font-semibold">{pollingJob.filename}</p>
              <p className="text-sm text-accent font-medium mt-2">{getStageLabel(pollingJob.stage)}</p>
            </div>

            {/* Stages Progress Indicator */}
            <div className="space-y-4 pt-4 border-t border-border">
              {stages.map((stg, idx) => {
                const currentIdx = getStageIndex(pollingJob.stage);
                const isCompleted = idx < currentIdx;
                const isActive = idx === currentIdx;
                
                return (
                  <div key={stg} className="flex items-center space-x-3 text-left">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCompleted 
                        ? 'bg-green-950 text-green-400 border border-green-900/60'
                        : isActive
                        ? 'bg-accent/20 text-accent border border-accent animate-pulse'
                        : 'bg-card text-gray-600 border border-border'
                    }`}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs font-semibold ${
                      isCompleted ? 'text-gray-400 line-through' : isActive ? 'text-foreground' : 'text-gray-600'
                    } capitalize`}>
                      {stg.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>

            {pollingJob.status === 'failed' && (
              <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-4 text-left mt-4 space-y-2">
                <p className="text-xs font-bold text-red-400">Processing Failed</p>
                <p className="text-[10px] text-red-500">{pollingJob.error || 'Check that your backend dependencies and FFmpeg are correctly set up.'}</p>
                <button
                  onClick={() => setPollingJob(null)}
                  className="mt-2 text-xs bg-red-950 hover:bg-red-900 text-red-300 font-semibold px-3 py-1 rounded-lg border border-red-900/50"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ) : (
          
          /* 3. Welcome / Upload Dashboard */
          <div className="space-y-12">
            
            {/* Hero Heading */}
            <div className="text-center space-y-4 max-w-xl mx-auto">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                🎙 Turn speech into structured transcripts.
              </h2>
              <p className="text-sm text-gray-400">
                Upload noisy, low-volume recordings in <span className="text-accent font-semibold">Gujarati, Hindi, and English</span>. Our local engine will normalize audio, transcribe bilingual speech, and cluster speakers dynamically.
              </p>
            </div>

            {/* Drag & Drop Upload Zone */}
            <UploadZone onStart={handleStartUpload} />

            {/* History Table List */}
            <div className="w-full max-w-4xl mx-auto space-y-4">
              <div className="flex items-center space-x-2 text-sm font-semibold text-gray-400">
                <History size={16} />
                <span>Recent Transcriptions</span>
              </div>

              {loadingHistory ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  Loading recent files...
                </div>
              ) : history.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center text-gray-500">
                  <p className="text-sm font-medium">No previous transcriptions found</p>
                  <p className="text-xs text-gray-600 mt-1">Upload a recording to populate history</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#121216]/50 border-b border-border text-gray-400 font-medium">
                          <th className="px-6 py-4">Filename</th>
                          <th className="px-6 py-4">Created At</th>
                          <th className="px-6 py-4">Languages</th>
                          <th className="px-6 py-4">Speakers</th>
                          <th className="px-6 py-4">Duration</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {history.map((job) => (
                          <tr
                            key={job.job_id}
                            onClick={() => job.status === 'completed' && loadTranscript(job.job_id)}
                            className={`hover:bg-[#16161c] transition duration-150 ${
                              job.status === 'completed' ? 'cursor-pointer' : 'opacity-70'
                            }`}
                          >
                            <td className="px-6 py-4 font-semibold text-foreground truncate max-w-xs">
                              {job.filename}
                            </td>
                            <td className="px-6 py-4 text-gray-400">
                              {job.createdAt}
                            </td>
                            <td className="px-6 py-4 text-gray-400 uppercase">
                              {job.languages.join(' · ') || '—'}
                            </td>
                            <td className="px-6 py-4 text-gray-400">
                              {job.speakers.length > 0 ? `${job.speakers.length} Speakers` : '—'}
                            </td>
                            <td className="px-6 py-4 text-gray-400">
                              {job.duration > 0 ? `${Math.floor(job.duration / 60)}m ${Math.floor(job.duration % 60)}s` : '—'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                job.status === 'completed'
                                  ? 'bg-green-950/30 border-green-900/60 text-green-400'
                                  : job.status === 'failed'
                                  ? 'bg-red-950/30 border-red-900/60 text-red-400'
                                  : 'bg-accent/20 border-accent/40 text-accent animate-pulse'
                              }`}>
                                {job.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

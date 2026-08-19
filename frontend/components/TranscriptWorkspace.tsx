'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Search, Filter, Download, Edit2, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  speaker: string;
  language?: 'gu' | 'hi' | 'en' | 'unknown';
  text: string;
  needsReview?: boolean;
}

export interface Transcript {
  id: string;
  filename: string;
  duration: number;
  segments: TranscriptSegment[];
  languages: string[];
  speakers: string[];
  createdAt: string;
}

interface TranscriptWorkspaceProps {
  transcript: Transcript;
  onUpdate: (updatedSegments: TranscriptSegment[]) => Promise<void>;
  onBack: () => void;
}

export default function TranscriptWorkspace({ transcript: initialTranscript, onUpdate, onBack }: TranscriptWorkspaceProps) {
  const [transcript, setTranscript] = useState<Transcript>(initialTranscript);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedSpeaker, setSelectedSpeaker] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedReviewState, setSelectedReviewState] = useState('all');

  // Editing state
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  const [renamingSpeaker, setRenamingSpeaker] = useState<string | null>(null);
  const [renamingSpeakerValue, setRenamingSpeakerValue] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    setTranscript(initialTranscript);
  }, [initialTranscript]);

  // Synchronize playing states
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error(err));
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
    }
  };

  const handleAudioSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
      if (!isPlaying) {
        audioRef.current.play().catch(err => console.error(err));
      }
    }
  };

  // Find active segment
  const activeSegmentId = useMemo(() => {
    const active = transcript.segments.find(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    return active ? active.id : null;
  }, [transcript.segments, currentTime]);

  // Autoscroll to active segment
  useEffect(() => {
    if (activeSegmentId && segmentRefs.current[activeSegmentId]) {
      segmentRefs.current[activeSegmentId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeSegmentId]);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Dynamic Statistics
  const stats = useMemo(() => {
    const segments = transcript.segments;
    const words = segments.reduce((sum, seg) => sum + seg.text.split(/\s+/).filter(Boolean).length, 0);
    const needsReview = segments.filter(seg => seg.needsReview).length;
    const distinctSpeakers = Array.from(new Set(segments.map(seg => seg.speaker))).filter(Boolean);
    const distinctLanguages = Array.from(new Set(segments.map(seg => seg.language))).filter(Boolean);

    return {
      duration: formatTime(transcript.duration),
      speakers: distinctSpeakers.length,
      languages: distinctLanguages.map(l => l?.toUpperCase()).join(' · ') || 'None',
      words,
      segments: segments.length,
      needsReview
    };
  }, [transcript]);

  // Segment editing handlers
  const startEditing = (id: string, text: string) => {
    setEditingSegmentId(id);
    setEditingText(text);
  };

  const saveSegmentEdit = async (id: string) => {
    const updatedSegments = transcript.segments.map(seg => {
      if (seg.id === id) {
        return { ...seg, text: editingText, needsReview: false };
      }
      return seg;
    });

    // Optimistic UI update
    setTranscript({ ...transcript, segments: updatedSegments });
    setEditingSegmentId(null);

    // Save to backend
    await onUpdate(updatedSegments);
  };

  // Speaker rename handlers
  const startSpeakerRename = (speaker: string) => {
    setRenamingSpeaker(speaker);
    setRenamingSpeakerValue(speaker);
  };

  const saveSpeakerRename = async (oldName: string) => {
    if (!renamingSpeakerValue.trim()) return;
    const updatedSegments = transcript.segments.map(seg => {
      if (seg.speaker === oldName) {
        return { ...seg, speaker: renamingSpeakerValue.trim() };
      }
      return seg;
    });

    const newDistinctSpeakers = Array.from(new Set(updatedSegments.map(s => s.speaker)));

    setTranscript({
      ...transcript,
      segments: updatedSegments,
      speakers: newDistinctSpeakers
    });
    setRenamingSpeaker(null);

    // Save to backend
    await onUpdate(updatedSegments);
  };

  // Toggle review state manually
  const toggleReview = async (id: string) => {
    const updatedSegments = transcript.segments.map(seg => {
      if (seg.id === id) {
        return { ...seg, needsReview: !seg.needsReview };
      }
      return seg;
    });

    setTranscript({ ...transcript, segments: updatedSegments });
    await onUpdate(updatedSegments);
  };

  // Export handlers
  const triggerExport = (format: 'txt' | 'srt' | 'json') => {
    window.open(`http://localhost:8000/api/jobs/${transcript.id}/export?format=${format}`, '_blank');
  };

  // Filtered segments logic
  const filteredSegments = useMemo(() => {
    return transcript.segments.filter(seg => {
      // Search text matches (Gujarati, Hindi, English)
      const textMatch = seg.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          seg.speaker.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Speaker match
      const speakerMatch = selectedSpeaker === 'all' || seg.speaker === selectedSpeaker;
      
      // Language match
      const langMatch = selectedLanguage === 'all' || seg.language === selectedLanguage;
      
      // Review state match
      const reviewMatch = selectedReviewState === 'all' ||
        (selectedReviewState === 'review' && seg.needsReview) ||
        (selectedReviewState === 'ok' && !seg.needsReview);

      return textMatch && speakerMatch && langMatch && reviewMatch;
    });
  }, [transcript.segments, searchQuery, selectedSpeaker, selectedLanguage, selectedReviewState]);

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* Top Bar / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-4 space-y-4 md:space-y-0">
        <div className="text-left">
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition mb-1">
            ← Back to dashboard
          </button>
          <h2 className="text-xl font-bold text-foreground max-w-xl truncate">{transcript.filename}</h2>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400 mr-2 flex items-center"><Download size={14} className="mr-1"/> Export:</span>
          <button
            onClick={() => triggerExport('txt')}
            className="px-3 py-1.5 bg-[#16161c] hover:bg-[#232329] border border-border rounded-lg text-xs font-semibold transition"
          >
            TXT
          </button>
          <button
            onClick={() => triggerExport('srt')}
            className="px-3 py-1.5 bg-[#16161c] hover:bg-[#232329] border border-border rounded-lg text-xs font-semibold transition"
          >
            SRT
          </button>
          <button
            onClick={() => triggerExport('json')}
            className="px-3 py-1.5 bg-[#16161c] hover:bg-[#232329] border border-border rounded-lg text-xs font-semibold transition"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Transcript & Audio Sync (3 Columns) */}
        <div className="lg:col-span-3 space-y-4 flex flex-col h-[70vh]">
          
          {/* Audio Player Card */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handlePlayPause}
                className="w-12 h-12 bg-accent hover:bg-accent-hover text-white rounded-full flex items-center justify-center transition focus:outline-none"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
              </button>
              <div className="text-left">
                <p className="text-xs text-gray-400">Audio Playback</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatTime(currentTime)} <span className="text-gray-500">/</span> {formatTime(transcript.duration)}
                </p>
              </div>
            </div>
            
            {/* HTML5 audio element hidden */}
            <audio
              ref={audioRef}
              src={`http://localhost:8000/api/jobs/${transcript.id}/audio`}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full md:max-w-md bg-[#16161c] border border-border rounded-xl px-2"
              controls
            />
          </div>

          {/* Transcript List Scroll Area */}
          <div className="flex-1 overflow-y-auto border border-border bg-[#0d0d11]/30 rounded-2xl p-6 space-y-4 min-h-[40vh]">
            {filteredSegments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <Search size={36} className="mb-2 text-gray-600" />
                <p className="text-sm font-medium">No matches found</p>
                <p className="text-xs text-gray-600 mt-1">Try adjusting your filters or search query</p>
              </div>
            ) : (
              filteredSegments.map(seg => {
                const isActive = seg.id === activeSegmentId;
                return (
                  <div
                    key={seg.id}
                    ref={el => { segmentRefs.current[seg.id] = el; }}
                    className={`border rounded-xl p-4 transition duration-150 relative text-left ${
                      isActive
                        ? 'border-accent bg-accent/5 ring-1 ring-accent'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                      <div className="flex items-center space-x-3">
                        {/* Timestamp seeking button */}
                        <button
                          onClick={() => handleAudioSeek(seg.start)}
                          className="text-xs font-semibold text-accent hover:underline bg-accent/10 px-2 py-0.5 rounded"
                        >
                          {formatTime(seg.start)}
                        </button>
                        
                        {/* Speaker Indicator */}
                        <span className="text-xs font-bold text-foreground">
                          {seg.speaker}
                        </span>

                        {/* Language Badge */}
                        {seg.language && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
                            seg.language === 'gu'
                              ? 'bg-orange-950/40 text-orange-400 border border-orange-900/50'
                              : seg.language === 'hi'
                              ? 'bg-blue-950/40 text-blue-400 border border-blue-900/50'
                              : seg.language === 'en'
                              ? 'bg-green-950/40 text-green-400 border border-green-900/50'
                              : 'bg-gray-850/40 text-gray-400'
                          }`}>
                            {seg.language}
                          </span>
                        )}

                        {/* Low Confidence warning */}
                        {seg.needsReview && (
                          <span className="text-[10px] bg-red-950/30 border border-red-900/50 text-red-400 px-1.5 py-0.5 rounded flex items-center">
                            <AlertTriangle size={10} className="mr-1" /> Needs Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditing(seg.id, seg.text)}
                          className="p-1 hover:bg-[#1b1b22] text-gray-400 hover:text-white rounded"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => toggleReview(seg.id)}
                          className={`p-1 rounded ${seg.needsReview ? 'text-orange-400' : 'text-gray-500'}`}
                          title="Mark for review"
                        >
                          <AlertTriangle size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Text block or edit state */}
                    {editingSegmentId === seg.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full bg-[#1b1b22] border border-border text-foreground rounded-lg p-3 text-sm focus:outline-none focus:border-accent"
                          rows={3}
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingSegmentId(null)}
                            className="p-1.5 bg-[#1b1b22] hover:bg-border rounded text-gray-400"
                          >
                            <X size={14} />
                          </button>
                          <button
                            onClick={() => saveSegmentEdit(seg.id)}
                            className="p-1.5 bg-accent hover:bg-accent-hover text-white rounded"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm leading-relaxed mt-1 whitespace-pre-wrap ${
                        seg.needsReview ? 'text-gray-300' : 'text-foreground'
                      }`}>
                        {seg.text}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Filters, Stats, Speakers (1 Column) */}
        <div className="space-y-6">
          
          {/* Search Box */}
          <div className="bg-card border border-border rounded-2xl p-5 text-left">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Search Transcript</h3>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#16161c] border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Filters Card */}
          <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center">
              <Filter size={12} className="mr-1.5 text-accent"/> Filters
            </h3>
            
            {/* Filter by Speaker */}
            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">Filter by Speaker</label>
              <select
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                className="w-full bg-[#16161c] border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Speakers</option>
                {transcript.speakers.map(spk => (
                  <option key={spk} value={spk}>{spk}</option>
                ))}
              </select>
            </div>

            {/* Filter by Language */}
            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">Filter by Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-[#16161c] border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Languages</option>
                <option value="gu">Gujarati</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Filter by Confidence */}
            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">Filter by Review State</label>
              <select
                value={selectedReviewState}
                onChange={(e) => setSelectedReviewState(e.target.value)}
                className="w-full bg-[#16161c] border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Segments</option>
                <option value="review">Needs Review</option>
                <option value="ok">Reviewed / High Confidence</option>
              </select>
            </div>
          </div>

          {/* Speakers Panel with Rename */}
          <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Speakers Directory</h3>
            <div className="space-y-2">
              {transcript.speakers.map(spk => (
                <div key={spk} className="flex items-center justify-between p-2 bg-[#16161c] rounded-xl border border-border">
                  {renamingSpeaker === spk ? (
                    <div className="flex items-center space-x-1.5 w-full">
                      <input
                        type="text"
                        value={renamingSpeakerValue}
                        onChange={(e) => setRenamingSpeakerValue(e.target.value)}
                        className="bg-[#1b1b22] border border-border text-xs text-foreground px-2 py-1 rounded w-full focus:outline-none focus:border-accent"
                      />
                      <button onClick={() => saveSpeakerRename(spk)} className="p-1 text-green-400 hover:bg-border rounded">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setRenamingSpeaker(null)} className="p-1 text-red-400 hover:bg-border rounded">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-gray-300">{spk}</span>
                      <button
                        onClick={() => startSpeakerRename(spk)}
                        className="text-[10px] text-gray-500 hover:text-white transition"
                      >
                        Rename
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Transcript Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Duration</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{stats.duration}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Speakers</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{stats.speakers}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-gray-500 uppercase">Languages</p>
                <p className="text-xs font-bold text-accent mt-0.5 truncate">{stats.languages}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Words</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{stats.words}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Needs Review</p>
                <p className={`text-sm font-bold mt-0.5 ${stats.needsReview > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {stats.needsReview}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

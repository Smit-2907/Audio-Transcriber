'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileAudio, Trash2, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface UploadZoneProps {
  onStart: (file: File, options: TranscriptionOptions) => void;
}

export interface TranscriptionOptions {
  normalize_volume: boolean;
  reduce_noise: boolean;
  speech_enhance: boolean;
  strength: 'normal' | 'strong' | 'aggressive';
  model_size: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  expected_speakers: number;
}

export default function UploadZone({ onStart }: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [options, setOptions] = useState<TranscriptionOptions>({
    normalize_volume: true,
    reduce_noise: true,
    speech_enhance: true,
    strength: 'normal',
    model_size: 'base',
    expected_speakers: 0, // Auto
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const allowed = ['mp3', 'wav', 'm4a', 'mp4', 'webm', 'flac'];
    if (ext && allowed.includes(ext)) {
      setFile(selectedFile);
    } else {
      alert('Unsupported file format. Please upload MP3, WAV, M4A, MP4, WEBM, or FLAC.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Upload Box */}
      {!file ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center space-y-4 ${
            dragActive
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-gray-500 bg-card hover:bg-card/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.mp4,.webm,.flac"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 bg-[#1b1b22] rounded-full text-gray-400">
            <Upload size={32} />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">Drop your audio here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse local files</p>
          </div>
          <p className="text-xs text-gray-500">MP3 · WAV · M4A · MP4 · FLAC</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-accent/10 text-accent rounded-xl">
              <FileAudio size={28} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground max-w-md truncate">{file.name}</p>
              <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
                <span>{file.name.split('.').pop()?.toUpperCase()}</span>
                <span>•</span>
                <span>{formatSize(file.size)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setFile(null)}
              className="p-2.5 text-gray-400 hover:text-red-400 bg-[#1b1b22] hover:bg-red-950/20 border border-border rounded-xl transition duration-150"
              title="Remove File"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => onStart(file, options)}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition duration-150"
            >
              Start Transcription
            </button>
          </div>
        </div>
      )}

      {/* Advanced Options Toggler */}
      {file && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#16161c] transition duration-150 text-left border-b border-border"
          >
            <div className="flex items-center space-x-2 text-sm font-semibold text-foreground">
              <Sliders size={16} className="text-accent" />
              <span>Audio Enhancement & Model Settings</span>
            </div>
            {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showOptions && (
            <div className="p-6 space-y-6 bg-card/50">
              {/* Audio Enhancement Options */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">FFmpeg Audio Enhancement</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-center space-x-3 p-3.5 bg-[#16161c] border border-border rounded-xl cursor-pointer hover:border-gray-500 transition duration-150">
                    <input
                      type="checkbox"
                      checked={options.normalize_volume}
                      onChange={(e) => setOptions({ ...options, normalize_volume: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <div className="text-left">
                      <span className="text-xs font-semibold block text-foreground">Normalize Volume</span>
                      <span className="text-[10px] text-gray-400">Loudness correction</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3.5 bg-[#16161c] border border-border rounded-xl cursor-pointer hover:border-gray-500 transition duration-150">
                    <input
                      type="checkbox"
                      checked={options.reduce_noise}
                      onChange={(e) => setOptions({ ...options, reduce_noise: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <div className="text-left">
                      <span className="text-xs font-semibold block text-foreground">Noise Reduction</span>
                      <span className="text-[10px] text-gray-400">High/Low pass filtering</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3.5 bg-[#16161c] border border-border rounded-xl cursor-pointer hover:border-gray-500 transition duration-150">
                    <input
                      type="checkbox"
                      checked={options.speech_enhance}
                      onChange={(e) => setOptions({ ...options, speech_enhance: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <div className="text-left">
                      <span className="text-xs font-semibold block text-foreground">Speech Boost</span>
                      <span className="text-[10px] text-gray-400">Dynamic compression</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Profiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                <div className="text-left">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Enhancement Strength</label>
                  <select
                    value={options.strength}
                    onChange={(e) => setOptions({ ...options, strength: e.target.value as any })}
                    className="w-full bg-[#16161c] border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="normal">Normal (Standard)</option>
                    <option value="strong">Strong (Noisy Rooms)</option>
                    <option value="aggressive">Aggressive (Extremely Quiet)</option>
                  </select>
                </div>

                <div className="text-left">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Whisper Model Size</label>
                  <select
                    value={options.model_size}
                    onChange={(e) => setOptions({ ...options, model_size: e.target.value as any })}
                    className="w-full bg-[#16161c] border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="tiny">Tiny (Fastest, CPU-light)</option>
                    <option value="base">Base (Recommended Dev)</option>
                    <option value="small">Small (Balanced)</option>
                    <option value="medium">Medium (Accurate CPU)</option>
                    <option value="large-v3">Large V3 (High Accuracy)</option>
                  </select>
                </div>

                <div className="text-left">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Expected Speakers</label>
                  <select
                    value={options.expected_speakers}
                    onChange={(e) => setOptions({ ...options, expected_speakers: parseInt(e.target.value) })}
                    className="w-full bg-[#16161c] border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="0">Auto-Detect</option>
                    <option value="1">1 Speaker</option>
                    <option value="2">2 Speakers</option>
                    <option value="3">3 Speakers</option>
                    <option value="4">4 Speakers</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

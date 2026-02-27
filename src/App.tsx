import { Camera, Phone, PhoneOff, Video, Users, Mic, MicOff, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWebRTC } from './hooks/useWebRTC';
import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  stream: MediaStream;
  muted?: boolean;
  label: string;
  key?: string | number;
}

function VideoPlayer({ stream, muted = false, label }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container group">
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium border border-white/10">
        {label}
      </div>
    </div>
  );
}

export default function App() {
  const { localStream, remoteStreams, isJoined, joinCall, leaveCall } = useWebRTC();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-bottom border-white/5 bg-zinc-900/50 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Video className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">InstantVideo</h1>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Zero-Auth Conference</p>
          </div>
        </div>
        
        {isJoined && (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full border border-white/5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium">{remoteStreams.length + 1} Učesnika</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 relative p-4 md:p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!isJoined ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8"
            >
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-bold tracking-tighter leading-tight">
                  Spremni za <span className="text-emerald-500">instant</span> razgovor?
                </h2>
                <p className="text-zinc-400 text-lg">
                  Nema registracije. Nema čekanja. Samo klikni na zelenu kameru i pozovi sve koji su trenutno ovde.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={joinCall}
                className="group relative flex items-center justify-center w-24 h-24 bg-emerald-500 rounded-full shadow-2xl shadow-emerald-500/40 cursor-pointer transition-all hover:bg-emerald-400"
              >
                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20 group-hover:opacity-40" />
                <Camera className="w-10 h-10 text-white" />
              </motion.button>
              
              <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                  <h3 className="font-semibold mb-1">Bez Logovanja</h3>
                  <p className="text-xs text-zinc-500">Uđi i odmah počni razgovor.</p>
                </div>
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                  <h3 className="font-semibold mb-1">Konferencija</h3>
                  <p className="text-xs text-zinc-500">Svi u aplikaciji su u istom pozivu.</p>
                </div>
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                  <h3 className="font-semibold mb-1">WebRTC</h3>
                  <p className="text-xs text-zinc-500">Direktna veza, niska latencija.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="call"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col"
            >
              <div className="video-grid">
                {localStream && (
                  <VideoPlayer stream={localStream} muted label="Ti (Ja)" />
                )}
                {remoteStreams.map((remote) => (
                  <VideoPlayer key={remote.id} stream={remote.stream} label={`Učesnik ${remote.id.slice(0, 4)}`} />
                ))}
                
                {remoteStreams.length === 0 && (
                  <div className="video-container flex flex-col items-center justify-center border-dashed border-zinc-800 bg-transparent">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                      <Users className="text-zinc-700 w-8 h-8" />
                    </div>
                    <p className="text-zinc-500 text-sm">Čekamo da se neko pridruži...</p>
                    <p className="text-zinc-600 text-xs mt-2">Podeli link sa prijateljima!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Controls Bar */}
      {isJoined && (
        <motion.footer 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="p-6 bg-zinc-900/80 backdrop-blur-2xl border-t border-white/5 flex items-center justify-center gap-4 z-10"
        >
          <button 
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button 
            onClick={leaveCall}
            className="w-16 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-red-500/20"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </motion.footer>
      )}
    </div>
  );
}

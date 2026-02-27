import { useEffect, useRef, useState } from 'react';
import Peer, { MediaConnection } from 'peerjs';

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ id: string; stream: MediaStream }[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [peerId, setPeerId] = useState<string>('');
  
  const peerRef = useRef<Peer | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const joinCall = async (roomName: string = 'global') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Create a unique ID that includes the room name for "discovery"
      // Note: PeerJS doesn't support room listing, so we use a naming convention
      // or just rely on direct calling if we had a way to share IDs.
      // For this "instant" app, we'll use a simple trick: 
      // We'll use a custom signaling server or just PeerJS cloud with a room-based ID.
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
        setPeerId(id);
        setIsJoined(true);
        console.log('My peer ID is: ' + id);
        
        // In a real app, you'd send this ID to a backend to "list" yourself in the room.
        // On Vercel, we'll use a simple API route to announce presence.
        fetch('/api/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peerId: id, room: roomName })
        });

        // Periodically check for other peers in the same room
        const interval = setInterval(async () => {
          const res = await fetch(`/api/peers?room=${roomName}`);
          const data = await res.json();
          const otherPeers = data.peers.filter((p: string) => p !== id);
          
          otherPeers.forEach((otherId: string) => {
            if (!callsRef.current.has(otherId)) {
              const call = peer.call(otherId, localStreamRef.current!);
              handleCall(call, otherId);
            }
          });
        }, 3000);

        peer.on('close', () => clearInterval(interval));
      });

      peer.on('call', (call) => {
        call.answer(localStreamRef.current!);
        handleCall(call, call.peer);
      });

      const handleCall = (call: MediaConnection, otherId: string) => {
        call.on('stream', (remoteStream) => {
          setRemoteStreams((prev) => {
            if (prev.find((s) => s.id === otherId)) return prev;
            return [...prev, { id: otherId, stream: remoteStream }];
          });
        });

        call.on('close', () => {
          setRemoteStreams((prev) => prev.filter((s) => s.id !== otherId));
          callsRef.current.delete(otherId);
        });

        callsRef.current.set(otherId, call);
      };

    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Molimo dozvolite pristup kameri i mikrofonu.');
    }
  };

  const leaveCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    callsRef.current.forEach((call) => call.close());
    callsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStreams([]);
    setIsJoined(false);
  };

  return { localStream, remoteStreams, isJoined, peerId, joinCall, leaveCall };
}

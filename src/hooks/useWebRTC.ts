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

      let slot = 1;
      const tryConnect = (currentSlot: number) => {
        // Create a predictable ID based on room name and slot
        const id = `${roomName.toLowerCase().trim()}-${currentSlot}`;
        
        const peer = new Peer(id, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          }
        });

        peerRef.current = peer;

        peer.on('open', (id) => {
          setPeerId(id);
          setIsJoined(true);
          console.log('Joined as: ' + id);

          // Periodically try to call other slots in the same room
          const interval = setInterval(() => {
            // Check slots 1 to 10
            for (let i = 1; i <= 10; i++) {
              const targetId = `${roomName.toLowerCase().trim()}-${i}`;
              if (targetId !== id && !callsRef.current.has(targetId)) {
                const call = peer.call(targetId, localStreamRef.current!);
                if (call) handleCall(call, targetId);
              }
            }
          }, 5000);

          peer.on('close', () => clearInterval(interval));
        });

        peer.on('call', (call) => {
          console.log('Receiving call from: ' + call.peer);
          call.answer(localStreamRef.current!);
          handleCall(call, call.peer);
        });

        peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            console.log(`Slot ${currentSlot} taken, trying ${currentSlot + 1}...`);
            peer.destroy();
            if (currentSlot < 10) {
              tryConnect(currentSlot + 1);
            } else {
              alert('Soba je puna (maksimalno 10 ljudi).');
            }
          } else if (err.type === 'peer-unavailable') {
            // This is normal when polling slots that aren't occupied
          } else {
            console.error('PeerJS error:', err);
          }
        });
      };

      tryConnect(slot);

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

        // Handle errors on the call itself
        call.on('error', () => {
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

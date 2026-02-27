import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface PeerConnection {
  id: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ id: string; stream: MediaStream }[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const createPeerConnection = (targetId: string, socket: Socket) => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { to: targetId, signal: { candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        if (prev.find((s) => s.id === targetId)) return prev;
        return [...prev, { id: targetId, stream: event.streams[0] }];
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  const joinCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;

      socketRef.current = io();
      const socket = socketRef.current;

      socket.on('connect', () => {
        socket.emit('join-room');
        setIsJoined(true);
      });

      socket.on('all-users', async (users: string[]) => {
        for (const userId of users) {
          const pc = createPeerConnection(userId, socket);
          peersRef.current.set(userId, pc);
          
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', { to: userId, signal: { offer } });
        }
      });

      socket.on('user-joined', (userId: string) => {
        const pc = createPeerConnection(userId, socket);
        peersRef.current.set(userId, pc);
      });

      socket.on('signal', async (data: { from: string; signal: any }) => {
        const pc = peersRef.current.get(data.from);
        if (!pc) return;

        if (data.signal.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: data.from, signal: { answer } });
        } else if (data.signal.answer) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
        } else if (data.signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      });

      socket.on('user-left', (userId: string) => {
        const pc = peersRef.current.get(userId);
        if (pc) {
          pc.close();
          peersRef.current.delete(userId);
        }
        setRemoteStreams((prev) => prev.filter((s) => s.id !== userId));
      });

    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Molimo dozvolite pristup kameri i mikrofonu.');
    }
  };

  const leaveCall = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStreams([]);
    setIsJoined(false);
  };

  return { localStream, remoteStreams, isJoined, joinCall, leaveCall };
}

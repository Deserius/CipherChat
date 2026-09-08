import type { WsClient } from '../services/wsClient';

export interface PeerMedia {
  id: string;
  stream: MediaStream;
  connectionState: RTCPeerConnectionState;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  stream: MediaStream;
}

export class CallManager {
  private ws: WsClient;
  private selfId = '';
  private iceServers: RTCIceServer[] = [];
  private peers = new Map<string, Peer>();
  localStream: MediaStream | null = null;
  screenStream: MediaStream | null = null;
  cameraOn = false;
  micOn = false;
  screenOn = false;
  audioOnly = false;
  selectedCamera?: string;
  selectedMic?: string;
  selectedSpeaker?: string;
  onPeers: (peers: PeerMedia[]) => void = () => {};
  onLocalStream: (s: MediaStream | null) => void = () => {};
  onError: (msg: string) => void = () => {};
  onQuality: (id: string, score: number) => void = () => {};
  private statsTimer: number | null = null;

  constructor(ws: WsClient) {
    this.ws = ws;
  }

  configure(selfId: string, iceServers: RTCIceServer[]) {
    this.selfId = selfId;
    const fallback: RTCIceServer[] = [
      {
        urls: [
          'stun:stun.cloudflare.com:3478',
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ];
    this.iceServers = iceServers.length ? iceServers : fallback;
  }

  /** Attach a stream already obtained from the permission gate. */
  attachExistingStream(stream: MediaStream) {
    this.localStream = stream;
    this.micOn = stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live');
    this.cameraOn = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
    this.audioOnly = this.micOn && !this.cameraOn;
    this.pushTracksToAll();
    this.onLocalStream(stream);
  }

  peerIds() {
    return [...this.peers.keys()];
  }

  async ensurePeer(id: string) {
    if (this.peers.has(id) || id === this.selfId) return;
    const polite = this.selfId < id;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const stream = new MediaStream();
    const peer: Peer = { id, pc, polite, makingOffer: false, ignoreOffer: false, stream };
    this.peers.set(id, peer);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.ws.send({ type: 'signal', to: id, data: { candidate: ev.candidate } });
      }
    };

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => {
        if (!stream.getTracks().some((x) => x.id === t.id)) stream.addTrack(t);
      });
      if (!ev.streams[0]) {
        if (!stream.getTracks().some((x) => x.id === ev.track.id)) stream.addTrack(ev.track);
      }
      this.emitPeers();
    };

    pc.onconnectionstatechange = () => this.emitPeers();

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.ws.send({ type: 'signal', to: id, data: { description: pc.localDescription } });
      } catch (e) {
        console.warn('negotiation failed', e);
      } finally {
        peer.makingOffer = false;
      }
    };

    this.addLocalTracks(pc);
    this.emitPeers();
  }

  async handleSignal(from: string, data: unknown) {
    await this.ensurePeer(from);
    const peer = this.peers.get(from);
    if (!peer || !data || typeof data !== 'object') return;
    const d = data as { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    const pc = peer.pc;
    try {
      if (d.description) {
        const description = d.description;
        const offerCollision =
          description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.ws.send({ type: 'signal', to: from, data: { description: pc.localDescription } });
        }
      } else if (d.candidate) {
        try {
          await pc.addIceCandidate(d.candidate);
        } catch (err) {
          if (!peer.ignoreOffer) throw err;
        }
      }
    } catch (err) {
      console.warn('signal error', err);
    }
  }

  private addLocalTracks(pc: RTCPeerConnection) {
    const add = (track: MediaStreamTrack, stream: MediaStream) => {
      const existing = pc.getSenders().find((s) => s.track?.kind === track.kind && s.track?.id === track.id);
      if (existing) return;
      // Prefer replacing a same-kind sender that has no live track
      const empty = pc.getSenders().find((s) => s.track?.kind === track.kind && s.track?.readyState !== 'live');
      if (empty) {
        empty.replaceTrack(track).catch(() => pc.addTrack(track, stream));
      } else {
        pc.addTrack(track, stream);
      }
    };
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => add(t, this.localStream!));
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => add(t, this.screenStream!));
    }
  }

  private pushTracksToAll() {
    for (const peer of this.peers.values()) this.addLocalTracks(peer.pc);
  }

  async setMicrophone(on: boolean) {
    if (on) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: this.selectedMic ? { deviceId: { exact: this.selectedMic } } : true,
          video: false,
        });
        const track = stream.getAudioTracks()[0];
        if (!this.localStream) this.localStream = new MediaStream();
        this.localStream.getAudioTracks().forEach((t) => {
          t.stop();
          this.localStream!.removeTrack(t);
        });
        if (track) this.localStream.addTrack(track);
        this.micOn = true;
        this.pushTracksToAll();
        this.onLocalStream(this.localStream);
      } catch {
        this.onError('Microphone permission is required.');
        this.micOn = false;
      }
    } else {
      this.localStream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
        this.localStream?.removeTrack(t);
      });
      for (const peer of this.peers.values()) {
        peer.pc.getSenders().forEach((s) => {
          if (s.track?.kind === 'audio' && !this.screenStream) {
            s.replaceTrack(null).catch(() => undefined);
          }
        });
      }
      this.micOn = false;
      this.onLocalStream(this.localStream);
    }
  }

  async setCamera(on: boolean) {
    if (on) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: this.selectedCamera
            ? { deviceId: { exact: this.selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!this.localStream) this.localStream = new MediaStream();
        this.localStream.getVideoTracks().forEach((t) => {
          t.stop();
          this.localStream!.removeTrack(t);
        });
        if (track) this.localStream.addTrack(track);
        this.cameraOn = true;
        this.audioOnly = false;
        this.pushTracksToAll();
        this.onLocalStream(this.localStream);
      } catch {
        this.onError('Camera permission is required.');
        this.cameraOn = false;
      }
    } else {
      this.localStream?.getVideoTracks().forEach((t) => {
        t.stop();
        this.localStream?.removeTrack(t);
      });
      for (const peer of this.peers.values()) {
        peer.pc.getSenders().forEach((s) => {
          if (s.track?.kind === 'video' && s.track.label !== 'screen') {
            s.replaceTrack(null).catch(() => undefined);
          }
        });
      }
      this.cameraOn = false;
      this.onLocalStream(this.localStream);
    }
  }

  async setScreen(on: boolean) {
    if (on) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15 },
          audio: true,
        });
        this.screenStream = stream;
        this.screenOn = true;
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          this.setScreen(false);
        });
        this.pushTracksToAll();
        this.onLocalStream(this.localStream);
      } catch {
        this.onError('Screen sharing was cancelled or is unavailable.');
        this.screenOn = false;
      }
    } else {
      this.screenStream?.getTracks().forEach((t) => t.stop());
      if (this.screenStream) {
        for (const peer of this.peers.values()) {
          for (const t of this.screenStream.getTracks()) {
            const sender = peer.pc.getSenders().find((s) => s.track?.id === t.id);
            if (sender) peer.pc.removeTrack(sender);
          }
        }
      }
      this.screenStream = null;
      this.screenOn = false;
    }
  }

  async switchCamera(deviceId: string) {
    this.selectedCamera = deviceId;
    if (this.cameraOn) {
      await this.setCamera(false);
      await this.setCamera(true);
    }
  }

  async switchMic(deviceId: string) {
    this.selectedMic = deviceId;
    if (this.micOn) {
      await this.setMicrophone(false);
      await this.setMicrophone(true);
    }
  }

  async switchSpeaker(deviceId: string) {
    this.selectedSpeaker = deviceId;
  }

  removePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    try {
      peer.pc.close();
    } catch {
      /* ignore */
    }
    this.peers.delete(id);
    this.emitPeers();
  }

  emitPeers() {
    const list: PeerMedia[] = [];
    for (const p of this.peers.values()) {
      list.push({
        id: p.id,
        stream: p.stream,
        connectionState: p.pc.connectionState,
        audioEnabled: p.stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live'),
        videoEnabled: p.stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'),
      });
    }
    this.onPeers(list);
  }

  startStats() {
    this.stopStats();
    this.statsTimer = window.setInterval(async () => {
      for (const [id, peer] of this.peers) {
        try {
          const stats = await peer.pc.getStats();
          let rtt = 0;
          let loss = 0;
          stats.forEach((r) => {
            if (r.type === 'candidate-pair' && (r as RTCIceCandidatePairStats).state === 'succeeded') {
              rtt = (r as RTCIceCandidatePairStats).currentRoundTripTime ?? 0;
            }
            if (r.type === 'inbound-rtp') {
              const s = r as RTCInboundRtpStreamStats;
              const packets = s.packetsReceived ?? 0;
              const lost = s.packetsLost ?? 0;
              if (packets + lost > 0) loss = lost / (packets + lost);
            }
          });
          let score = 3;
          if (rtt > 0.4 || loss > 0.08) score = 1;
          else if (rtt > 0.2 || loss > 0.03) score = 2;
          this.onQuality(id, score);
        } catch {
          /* ignore */
        }
      }
    }, 4000);
  }

  stopStats() {
    if (this.statsTimer) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  hangup() {
    this.stopStats();
    this.setCamera(false);
    this.setMicrophone(false);
    this.setScreen(false);
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.onLocalStream(null);
  }
}

export async function listDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter((d) => d.kind === 'videoinput'),
      mics: devices.filter((d) => d.kind === 'audioinput'),
      speakers: devices.filter((d) => d.kind === 'audiooutput'),
    };
  } catch {
    return { cameras: [], mics: [], speakers: [] };
  }
}

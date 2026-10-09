import type { WsClient } from '../services/wsClient';
import { FALLBACK_ICE, rtcConfiguration } from './rtcConfig';
import type { PlanId } from '@shared/billing';
import { limitsForPlan } from '@shared/billing';

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
  recovering: boolean;
  lastRestart: number;
  pendingCandidates: RTCIceCandidateInit[];
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
  plan: PlanId = 'free';
  onPeers: (peers: PeerMedia[]) => void = () => {};
  onLocalStream: (s: MediaStream | null) => void = () => {};
  onError: (msg: string) => void = () => {};
  onQuality: (id: string, score: number) => void = () => {};
  private statsTimer: number | null = null;

  constructor(ws: WsClient) {
    this.ws = ws;
  }

  configure(selfId: string, iceServers: RTCIceServer[], plan: PlanId = 'free') {
    this.selfId = selfId;
    this.iceServers = iceServers.length ? iceServers : FALLBACK_ICE;
    this.plan = plan;
  }

  setPlan(plan: PlanId) {
    this.plan = plan;
  }

  /** Attach a stream already obtained from the permission gate. */
  attachExistingStream(stream: MediaStream) {
    this.localStream = stream;
    this.micOn = stream.getAudioTracks().some((t) => t.enabled && t.readyState === 'live');
    this.cameraOn = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
    this.audioOnly = this.micOn && !this.cameraOn;
    void this.pushTracksToAll();
    this.onLocalStream(stream);
  }

  peerIds() {
    return [...this.peers.keys()];
  }

  async ensurePeer(id: string) {
    if (this.peers.has(id) || id === this.selfId) return;
    const polite = this.selfId < id;
    const pc = new RTCPeerConnection(rtcConfiguration(this.iceServers));
    const stream = new MediaStream();
    const peer: Peer = {
      id,
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      stream,
      recovering: false,
      lastRestart: 0,
      pendingCandidates: [],
    };
    this.peers.set(id, peer);

    // Pre-create m-lines so turning the camera on later is replaceTrack, not a new negotiation.
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });

    pc.onicecandidate = (ev) => {
      this.ws.send({ type: 'signal', to: id, data: { candidate: ev.candidate } });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        void this.restartIce(peer);
      }
      this.emitPeers();
    };

    pc.ontrack = (ev) => {
      const add = (t: MediaStreamTrack) => {
        if (!stream.getTracks().some((x) => x.id === t.id)) stream.addTrack(t);
        t.onunmute = () => this.emitPeers();
        t.onmute = () => this.emitPeers();
        t.onended = () => {
          try {
            stream.removeTrack(t);
          } catch {
            /* ignore */
          }
          this.emitPeers();
        };
      };
      add(ev.track);
      ev.streams[0]?.getTracks().forEach(add);
      this.emitPeers();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        void this.restartIce(peer);
      }
      this.emitPeers();
    };

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

    await this.bindTracks(pc);
    this.emitPeers();
  }

  /** Re-gather ICE so a dropped P2P path can fall over to TURN (or a better pair). */
  private async restartIce(peer: Peer) {
    const now = Date.now();
    if (peer.recovering || now - peer.lastRestart < 4000) return;
    if (peer.pc.signalingState === 'closed') return;
    peer.recovering = true;
    peer.lastRestart = now;
    try {
      peer.pc.restartIce();
      if (peer.pc.signalingState === 'stable') {
        peer.makingOffer = true;
        await peer.pc.setLocalDescription();
        this.ws.send({
          type: 'signal',
          to: peer.id,
          data: { description: peer.pc.localDescription, iceRestart: true },
        });
      }
    } catch (e) {
      console.warn('ice restart failed', e);
    } finally {
      peer.makingOffer = false;
      window.setTimeout(() => {
        peer.recovering = false;
      }, 2500);
    }
  }

  async handleSignal(from: string, data: unknown) {
    await this.ensurePeer(from);
    const peer = this.peers.get(from);
    if (!peer || !data || typeof data !== 'object') return;
    const d = data as { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null };
    const pc = peer.pc;
    try {
      if (d.description) {
        const description = d.description;
        const offerCollision =
          description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        for (const c of peer.pendingCandidates.splice(0)) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            /* stale */
          }
        }
        if (description.type === 'offer') {
          await this.bindTracks(pc);
          await pc.setLocalDescription();
          this.ws.send({ type: 'signal', to: from, data: { description: pc.localDescription } });
        }
      } else if ('candidate' in d) {
        const cand = d.candidate;
        if (!pc.remoteDescription) {
          if (cand) peer.pendingCandidates.push(cand);
          return;
        }
        try {
          await pc.addIceCandidate(cand ?? null);
        } catch (err) {
          if (!peer.ignoreOffer) throw err;
        }
      }
    } catch (err) {
      console.warn('signal error', err);
    }
  }

  private senderOf(pc: RTCPeerConnection, kind: 'audio' | 'video') {
    const byKind = pc.getTransceivers().find((t) => t.receiver.track?.kind === kind)?.sender;
    if (byKind) return byKind;
    return pc.getSenders().find((s) => s.track?.kind === kind) ?? null;
  }

  private async bindTracks(pc: RTCPeerConnection) {
    const audio =
      this.localStream?.getAudioTracks().find((t) => t.readyState === 'live' && t.enabled) ?? null;
    const camera =
      this.localStream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    const screen =
      this.screenStream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    const video = screen ?? camera;

    const audioSender = this.senderOf(pc, 'audio');
    const videoSender = this.senderOf(pc, 'video');
    try {
      if (audioSender) await audioSender.replaceTrack(audio);
      else if (audio && this.localStream) pc.addTrack(audio, this.localStream);
    } catch {
      /* ignore */
    }
    try {
      if (videoSender) await videoSender.replaceTrack(video);
      else if (video) {
        const stream = screen ? this.screenStream! : this.localStream!;
        pc.addTrack(video, stream);
      }
    } catch {
      /* ignore */
    }
  }

  private async pushTracksToAll() {
    await Promise.all([...this.peers.values()].map((p) => this.bindTracks(p.pc)));
    this.emitPeers();
  }

  private videoConstraints(): MediaTrackConstraints {
    const hd = limitsForPlan(this.plan).hdVideo;
    const base: MediaTrackConstraints = {
      width: { ideal: hd ? 1920 : 1280 },
      height: { ideal: hd ? 1080 : 720 },
      frameRate: { ideal: hd ? 30 : 24 },
    };
    if (this.selectedCamera) return { ...base, deviceId: { exact: this.selectedCamera } };
    return { ...base, facingMode: 'user' };
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
        await this.pushTracksToAll();
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
      await this.pushTracksToAll();
      this.micOn = false;
      this.onLocalStream(this.localStream);
    }
  }

  async setCamera(on: boolean) {
    if (on) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: this.videoConstraints(),
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
        await this.pushTracksToAll();
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
      await this.pushTracksToAll();
      this.cameraOn = false;
      this.onLocalStream(this.localStream);
    }
  }

  async setScreen(on: boolean) {
    if (on) {
      try {
        const fps = limitsForPlan(this.plan).screenFps;
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: fps },
          audio: true,
        });
        this.screenStream = stream;
        this.screenOn = true;
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          void this.setScreen(false);
        });
        await this.pushTracksToAll();
        this.onLocalStream(this.localStream);
      } catch {
        this.onError('Screen sharing was cancelled or is unavailable.');
        this.screenOn = false;
      }
    } else {
      this.screenStream?.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
      this.screenOn = false;
      await this.pushTracksToAll();
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
        videoEnabled: p.stream.getVideoTracks().some((t) => t.readyState === 'live'),
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
          void this.adaptBitrate(peer, score);
          if (
            score === 1 &&
            (peer.pc.iceConnectionState === 'disconnected' || peer.pc.connectionState === 'disconnected')
          ) {
            void this.restartIce(peer);
          }
        } catch {
          /* ignore */
        }
      }
    }, 4000);
  }

  private async adaptBitrate(peer: Peer, score: number) {
    const cap = limitsForPlan(this.plan).videoBitrate;
    const max = score >= 3 ? cap : score === 2 ? Math.round(cap * 0.5) : Math.round(cap * 0.25);
    for (const sender of peer.pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        let changed = false;
        for (const enc of params.encodings) {
          if (enc.maxBitrate !== max) {
            enc.maxBitrate = max;
            changed = true;
          }
        }
        if (changed) await sender.setParameters(params);
      } catch {
        /* some browsers reject setParameters mid-call */
      }
    }
  }

  stopStats() {
    if (this.statsTimer) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  hangup() {
    this.stopStats();
    void this.setCamera(false);
    void this.setMicrophone(false);
    void this.setScreen(false);
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

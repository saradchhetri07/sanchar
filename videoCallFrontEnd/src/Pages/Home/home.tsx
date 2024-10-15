import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { FiVideo, FiVideoOff, FiMic, FiMicOff } from "react-icons/fi";

const configuration: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const socket = io("http://localhost:3000", { transports: ["websocket"] });

let pc: RTCPeerConnection | null;
let localStream: MediaStream | null;
let startButton: React.RefObject<HTMLButtonElement>;
let hangUpButton: React.RefObject<HTMLButtonElement>;
let muteAudButton: React.RefObject<HTMLButtonElement>;
let remoteVideo: React.RefObject<HTMLVideoElement>;
let localVideo: React.RefObject<HTMLVideoElement>;

socket.on("message", (e) => {
  if (!localStream) {
    console.log("not ready yet");
    return;
  }
  switch (e.type) {
    case "offer":
      handleOffer(e);
      break;
    case "answer":
      handleAnswer(e);
      break;
    case "candidate":
      handleCandidate(e);
      break;
    case "ready":
      // A second tab joined. This tab will initiate a call unless in a call already.
      if (pc) {
        console.log("already in call, ignoring");
        return;
      }
      makeCall();
      break;
    case "bye":
      if (pc) {
        hangup();
      }
      break;
  }
});

interface Message {
  type: string;
  candidate: string | null; // Allows string or null
  sdpMid?: string; // Optional properties
  sdpMLineIndex?: number; // Optional properties
}

const makeCall = async () => {
  try {
    pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = (e) => {
      const message: Message = {
        type: "candidate",
        candidate: null,
      };

      if (e.candidate) {
        message.candidate = e.candidate.candidate;
        message.sdpMid = e.candidate.sdpMid as string;
        message.sdpMLineIndex = e.candidate.sdpMLineIndex as number;
      }
      socket.emit("message", message);
    };
    pc.ontrack = (e) => (remoteVideo.current!.srcObject = e.streams[0]);
    localStream!
      .getTracks()
      .forEach((track) => pc!.addTrack(track, localStream!));
    const offer = await pc.createOffer();
    socket.emit("message", { type: "offer", sdp: offer.sdp });
    await pc.setLocalDescription(offer);
  } catch (e) {
    console.log(e);
  }
};

const handleOffer = async (offer: RTCSessionDescriptionInit) => {
  if (pc) {
    console.error("existing peerconnection");
    return;
  }
  try {
    pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = (e) => {
      const message: Message = {
        type: "candidate",
        candidate: null,
      };
      if (e.candidate) {
        message.candidate = e.candidate.candidate;
        message.sdpMid = e.candidate.sdpMid as string;
        message.sdpMLineIndex = e.candidate.sdpMLineIndex as number;
      }
      socket.emit("message", message);
    };
    pc.ontrack = (e) => (remoteVideo.current!.srcObject = e.streams[0]);
    localStream!
      .getTracks()
      .forEach((track) => pc!.addTrack(track, localStream!));
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    socket.emit("message", { type: "answer", sdp: answer.sdp });
    await pc.setLocalDescription(answer);
  } catch (e) {
    console.log(e);
  }
};

const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
  if (!pc) {
    console.log("no peer connection");
    return;
  }
  try {
    await pc.setRemoteDescription(answer);
  } catch (e) {
    console.log(e);
  }
};

async function handleCandidate(candidate: RTCIceCandidateInit) {
  try {
    if (!pc) {
      console.error("no peerconnection");
      return;
    }
    if (!candidate) {
      await pc.addIceCandidate(null);
    } else {
      await pc.addIceCandidate(candidate);
    }
  } catch (e) {
    console.log(e);
  }
}

async function hangup() {
  if (pc) {
    pc.close();
    pc = null;
  }
  localStream!.getTracks().forEach((track) => track.stop());
  localStream = null;
  startButton.current!.disabled = false;
  hangUpButton.current!.disabled = true;
  muteAudButton.current!.disabled = true;
}

const Home: React.FC = () => {
  startButton = useRef<HTMLButtonElement>(null);
  hangUpButton = useRef<HTMLButtonElement>(null);
  muteAudButton = useRef<HTMLButtonElement>(null);
  localVideo = useRef<HTMLVideoElement>(null);
  remoteVideo = useRef<HTMLVideoElement>(null);

  const [audioState, setAudio] = useState(false);

  useEffect(() => {
    hangUpButton.current!.disabled = true;
    muteAudButton.current!.disabled = true;
  }, []);

  const startB = async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true },
      });
      localVideo.current!.srcObject = localStream;
    } catch (err) {
      console.log(err);
    }

    startButton.current!.disabled = true;
    hangUpButton.current!.disabled = false;
    muteAudButton.current!.disabled = false;

    socket.emit("message", { type: "ready" });
  };

  const hangB = async () => {
    hangup();
    socket.emit("message", { type: "bye" });
  };

  const muteAudio = () => {
    if (audioState) {
      localVideo.current!.muted = true;
      setAudio(false);
    } else {
      localVideo.current!.muted = false;
      setAudio(true);
    }
  };

  return (
    <main className="container  ">
      <div className="video bg-main">
        <video
          ref={localVideo}
          className="video-item"
          autoPlay
          playsInline
          src=" "
        ></video>
        <video
          ref={remoteVideo}
          className="video-item"
          autoPlay
          playsInline
          src=" "
        ></video>
      </div>

      <div className="btn">
        <button
          className="btn-item btn-start"
          ref={startButton}
          onClick={startB}
        >
          <FiVideo />
        </button>
        <button className="btn-item btn-end" ref={hangUpButton} onClick={hangB}>
          <FiVideoOff />
        </button>
        <button
          className="btn-item btn-start"
          ref={muteAudButton}
          onClick={muteAudio}
        >
          {audioState ? <FiMic /> : <FiMicOff />}
        </button>
      </div>
    </main>
  );
};

export default Home;

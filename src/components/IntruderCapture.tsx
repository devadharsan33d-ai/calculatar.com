import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface IntruderCaptureProps {
  onCaptureComplete: () => void;
}

export const IntruderCapture: React.FC<IntruderCaptureProps> = ({ onCaptureComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        // Wait a bit for the camera to warm up and capture
        setTimeout(() => {
          capture();
        }, 2000);
      } catch (err) {
        console.error("Error accessing camera:", err);
        onCaptureComplete();
      }
    };

    const capture = async () => {
      if (videoRef.current && canvasRef.current && auth.currentUser) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          context.drawImage(videoRef.current, 0, 0);
          
          // Use lower quality to ensure it fits in Firestore (limit 1MB)
          const photo = canvasRef.current.toDataURL('image/jpeg', 0.5);
          
          // Final check on size
          if (new Blob([photo]).size > 1000 * 1024) {
            console.warn("Intruder photo too large, skipping save.");
            onCaptureComplete();
            return;
          }

          // Save to Firestore
          await addDoc(collection(db, 'intruder_alerts'), {
            photo,
            timestamp: new Date().toISOString(),
            userId: auth.currentUser.uid,
            isFake: false
          });

          // Stop camera
          const stream = videoRef.current.srcObject as MediaStream;
          stream?.getTracks().forEach(track => track.stop());
          
          onCaptureComplete();
        }
      }
    };

    startCamera();
  }, []);

  return (
    <div className="hidden">
      <video ref={videoRef} autoPlay playsInline />
      <canvas ref={canvasRef} />
    </div>
  );
};
